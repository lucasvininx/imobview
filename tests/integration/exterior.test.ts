import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { withTenant, type Actor } from "@/server/tenant";
import { publicExterior, saveExterior } from "@/features/exterior/service";

let actor: Actor, other: Actor, propertyId: string, slug: string;
const config = {
  enabled: true,
  buildingName: "Residencial Teste",
  latitude: -23.561347,
  longitude: -46.656512,
  utcOffset: -3,
  towers: 2,
  floors: 18,
  unitTower: 1,
  unitFloor: 12,
  unitFacade: "N",
  amenities: ["pool", "garden"],
};
beforeAll(async () => {
  const users = await db.user.findMany({
    where: { email: { in: ["admin@imobview.test", "outro@imobview.test"] } },
    include: { memberships: true },
  });
  const [a, b] = ["admin@imobview.test", "outro@imobview.test"].map((email) =>
    users.find((u) => u.email === email)!,
  );
  actor = { userId: a.id, organizationId: a.memberships[0].organizationId };
  other = { userId: b.id, organizationId: b.memberships[0].organizationId };
  slug = `exterior-${randomUUID()}`;
  propertyId = (
    await withTenant(actor, "property:create", (tx) =>
      tx.property.create({
        data: {
          organizationId: actor.organizationId,
          title: "Apartamento vista 3D",
          slug,
          status: "DRAFT",
        },
      }),
    )
  ).id;
});
afterAll(async () => {
  // The runtime role cannot delete properties; archive the test fixture instead.
  await withTenant(actor, "property:archive", (tx) =>
    tx.property.update({
      where: { id: propertyId },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    }),
  );
  await db.$disconnect();
});

it("saves the 3D view only for the owning tenant and validates the apartment", async () => {
  await expect(saveExterior(other, propertyId, config)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(
    saveExterior(actor, propertyId, { ...config, unitFloor: 30 }),
  ).rejects.toThrow();
  expect(await saveExterior(actor, propertyId, config)).toBe(slug);
  const stored = await withTenant(actor, "property:read", (tx) =>
    tx.property.findFirstOrThrow({ where: { id: propertyId } }),
  );
  expect(stored.exterior).toMatchObject({ latitude: -23.561347, floors: 18 });
});

it("exposes the view publicly only when published and enabled, with rounded coordinates", async () => {
  expect(await publicExterior(slug)).toBeNull();
  await withTenant(actor, "property:publish", (tx) =>
    tx.property.update({
      where: { id: propertyId },
      data: { status: "PUBLISHED" },
    }),
  );
  expect(await publicExterior(slug)).toMatchObject({
    latitude: -23.56,
    longitude: -46.66,
    unitFloor: 12,
    buildingName: "Residencial Teste",
  });
  await saveExterior(actor, propertyId, { ...config, enabled: false });
  expect(await publicExterior(slug)).toBeNull();
  expect(await publicExterior("../../etc")).toBeNull();
});
