import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { withTenant, type Actor } from "@/server/tenant";
import { saveOrganizationContact } from "@/features/organizations/service";
import { saveProperty } from "@/features/properties/service";
import { getPublicProperty } from "@/features/properties/public-service";
import { reserveUpload } from "@/domain/entitlements";
import {
  getTour,
  removePanorama,
  saveTour,
  createTour,
  publishTour,
} from "@/features/tours/service";
import { finalizePanorama } from "@/features/tours/service";
vi.mock("@/server/supabase/storage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/supabase/storage")>();
  return {
    ...actual,
    removeTemporaryPanorama: vi.fn().mockResolvedValue(undefined),
  };
});

const userId = randomUUID(),
  orgId = randomUUID(),
  otherOrg = randomUUID();
const actor: Actor = { userId, organizationId: orgId };
const other: Actor = { userId, organizationId: otherOrg };
const input = {
  title: "Casa teste",
  description: "Casa fictícia para testes",
  type: "HOUSE",
  purpose: "SALE",
  city: "São Paulo",
  state: "SP",
  neighborhood: "Centro",
  price: "100000",
  area: 100,
  bedrooms: 2,
  bathrooms: 1,
  parkingSpaces: 1,
};
beforeAll(async () => {
  await db.user.create({
    data: { id: userId, name: "Teste", email: `${userId}@imobview.test` },
  });
  for (const id of [orgId, otherOrg])
    await db.organization.create({
      data: {
        id,
        name: "Teste",
        slug: id,
        maxProperties: 1,
        maxPanoramas: 1,
        maxStorageBytes: BigInt(41943040),
        members: { create: { userId, role: "OWNER" } },
      },
    });
});
afterAll(async () => {
  await db.organization.deleteMany({
    where: { id: { in: [orgId, otherOrg] } },
  });
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});
it("serializes simultaneous property creation at the organization limit", async () => {
  const results = await Promise.allSettled([
    saveProperty(actor, input),
    saveProperty(actor, input),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
});
it("publishes only the property's own organization contacts", async () => {
  await saveOrganizationContact(actor, {
    name: "Agência A",
    contactEmail: "a@example.com",
    whatsapp: "+55 (11) 99999-9999",
  });
  await saveOrganizationContact(other, {
    name: "Agência B",
    contactEmail: "b@example.com",
    whatsapp: "",
  });
  const property = await withTenant(actor, "property:update", async (tx) => {
    const p = await tx.property.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    return tx.property.update({
      where: { id: p.id },
      data: { status: "PUBLISHED" },
    });
  });
  const result = await getPublicProperty(property.slug);
  expect(result?.contactEmail).toBe("a@example.com");
  expect(result?.whatsapp).toBe("5511999999999");
  await db.organizationMember.update({
    where: { organizationId_userId: actor },
    data: { role: "VIEWER" },
  });
  await expect(
    saveOrganizationContact(actor, {
      name: "Hacked",
      contactEmail: "",
      whatsapp: "",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await db.organizationMember.update({
    where: { organizationId_userId: actor },
    data: { role: "OWNER" },
  });
});
it("keeps photo metadata behind RLS and enforces reserved storage", async () => {
  await withTenant(actor, "property:update", async (tx) => {
    const property = await tx.property.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    await reserveUpload(tx, orgId, false);
    await tx.propertyPhoto.create({
      data: {
        organizationId: orgId,
        propertyId: property.id,
        fileName: "test.jpg",
        size: 100,
        uploadKey: randomUUID(),
        storageKey: randomUUID(),
      },
    });
  });
  expect(await db.propertyPhoto.findMany()).toEqual([]);
  expect(
    await withTenant(other, "property:read", (tx) =>
      tx.propertyPhoto.findMany(),
    ),
  ).toEqual([]);
  await expect(
    withTenant(actor, "property:update", (tx) =>
      reserveUpload(tx, orgId, true),
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
it("refuses deletion of draft or published panoramas and cross-tenant files", async () => {
  const property = await withTenant(actor, "property:read", (tx) =>
    tx.property.findFirstOrThrow({ where: { organizationId: orgId } }),
  );
  const tour = await createTour(actor, property.id, "Tour de teste");
  const assetId = randomUUID(),
    sceneId = randomUUID();
  await withTenant(actor, "property:update", (tx) =>
    tx.panoramaAsset.create({
      data: {
        id: assetId,
        organizationId: orgId,
        tourId: tour.id,
        storageKey: randomUUID(),
        uploadKey: randomUUID(),
        fileName: "room.jpg",
        size: 100,
        mimeType: "image/jpeg",
        status: "READY",
      },
    }),
  );
  const document = {
    initialSceneId: sceneId,
    scenes: [
      {
        id: sceneId,
        assetId,
        title: "Sala",
        initialYaw: 0,
        initialPitch: 0,
        hotspots: [],
      },
    ],
  };
  await saveTour(actor, { id: tour.id, version: 1, title: "Tour", document });
  await expect(removePanorama(actor, assetId)).rejects.toMatchObject({
    code: "CONFLICT",
  });
  await expect(removePanorama(other, assetId)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await publishTour(actor, tour.id, 2, true);
  await saveTour(actor, {
    id: tour.id,
    version: 3,
    title: "Tour",
    document: { initialSceneId: null, scenes: [] },
  });
  await expect(removePanorama(actor, assetId)).rejects.toMatchObject({
    code: "CONFLICT",
  });
  expect((await getTour(actor, tour.id)).assets).toHaveLength(1);
});

it("retains a discarded upload reservation until its signed URL has expired", async () => {
  const property = await withTenant(actor, "property:read", (tx) =>
    tx.property.findFirstOrThrow({ where: { organizationId: orgId } }),
  );
  const tour = await createTour(actor, property.id, "Reserva descartada");
  const assetId = randomUUID();
  await withTenant(actor, "property:update", (tx) =>
    tx.panoramaAsset.create({
      data: {
        id: assetId,
        organizationId: orgId,
        tourId: tour.id,
        storageKey: randomUUID(),
        uploadKey: randomUUID(),
        fileName: "pending.jpg",
        size: 100,
        mimeType: "image/jpeg",
      },
    }),
  );
  await removePanorama(actor, assetId);
  const asset = await withTenant(actor, "property:read", (tx) =>
    tx.panoramaAsset.findFirst({
      where: { id: assetId, organizationId: orgId },
    }),
  );
  expect(asset?.status).toBe("FAILED");
  await expect(finalizePanorama(actor, assetId)).rejects.toMatchObject({
    code: "CONFLICT",
  });
});
