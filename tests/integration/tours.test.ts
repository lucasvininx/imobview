import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { withTenant, type Actor } from "@/server/tenant";
import {
  createTour,
  getTour,
  saveTour,
  publishTour,
} from "@/features/tours/service";
import type { TourDocument } from "@/features/tours/schema";
let actor: Actor, other: Actor;
let propertyId: string, slug: string, tourId: string, assetId: string;
let document: TourDocument;
beforeAll(async () => {
  const users = await db.user.findMany({
    where: { email: { in: ["admin@imobview.test", "outro@imobview.test"] } },
    include: { memberships: true },
  });
  const first = users.find((u) => u.email === "admin@imobview.test")!;
  const second = users.find((u) => u.email === "outro@imobview.test")!;
  actor = {
    userId: first.id,
    organizationId: first.memberships[0].organizationId,
  };
  other = {
    userId: second.id,
    organizationId: second.memberships[0].organizationId,
  };
  slug = "tour-test-" + randomUUID();
  const property = await withTenant(actor, "property:create", (tx) =>
    tx.property.create({
      data: {
        organizationId: actor.organizationId,
        title: "Imóvel teste tour",
        slug,
        status: "PUBLISHED",
      },
    }),
  );
  propertyId = property.id;
  tourId = (await createTour(actor, propertyId, "Visita original")).id;
  assetId = randomUUID();
  await withTenant(actor, "property:update", (tx) =>
    tx.panoramaAsset.create({
      data: {
        id: assetId,
        organizationId: actor.organizationId,
        tourId,
        storageKey: randomUUID(),
        uploadKey: randomUUID(),
        fileName: "sala.jpg",
        mimeType: "image/jpeg",
        size: 100,
        status: "READY",
        width: 1024,
        height: 512,
      },
    }),
  );
  const sceneId = randomUUID();
  document = {
    initialSceneId: sceneId,
    scenes: [
      {
        id: sceneId,
        assetId,
        title: "Sala",
        initialYaw: 0,
        initialPitch: 0,
        hotspots: [],
        planPosition: null,
        infoPoints: [],
      },
    ],
    floorPlans: [],
  };
});
afterAll(async () => {
  await db.$disconnect();
});
describe("Real PostgreSQL tours", () => {
  it("rejects foreign tours and forged tenant contexts", async () => {
    await expect(getTour(other, tourId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      createTour(other, propertyId, "Invasão"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(publishTour(other, tourId, 1, true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      getTour({ ...actor, organizationId: other.organizationId }, tourId),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("RLS isolates tours and assets without application filters", async () => {
    expect(await db.tour.findMany()).toEqual([]);
    expect(await db.panoramaAsset.findMany()).toEqual([]);
    const rows = await withTenant(other, "property:read", (tx) =>
      tx.tour.findMany(),
    );
    expect(rows.some((row) => row.id === tourId)).toBe(false);
    await expect(
      withTenant(actor, "property:create", (tx) =>
        tx.tour.create({
          data: {
            title: "Wrong tenant",
            propertyId,
            organizationId: other.organizationId,
          },
        }),
      ),
    ).rejects.toThrow();
  });
  it("rejects missing panoramas and concurrent edits", async () => {
    const bad = structuredClone(document);
    bad.scenes[0].assetId = randomUUID();
    await expect(
      saveTour(actor, { id: tourId, version: 1, title: "Tour", document: bad }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(
      await saveTour(actor, {
        id: tourId,
        version: 1,
        title: "Tour",
        document,
      }),
    ).toBe(2);
    await expect(
      saveTour(actor, { id: tourId, version: 1, title: "Stale", document }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("publishes only a snapshot and hides it when unpublished", async () => {
    expect(
      await db.$queryRaw`SELECT * FROM public.get_published_tours(${slug})`,
    ).toEqual([]);
    expect(await publishTour(actor, tourId, 2, true)).toBe(3);
    const changed = structuredClone(document);
    changed.scenes[0].title = "Rascunho privado";
    await saveTour(actor, {
      id: tourId,
      version: 3,
      title: "Tour",
      document: changed,
    });
    const rows = await db.$queryRaw<
      { document: TourDocument }[]
    >`SELECT * FROM public.get_published_tours(${slug})`;
    expect(rows).toHaveLength(1);
    expect(rows[0].document.scenes[0].title).toBe("Sala");
    await publishTour(actor, tourId, 4, false);
    expect(
      await db.$queryRaw`SELECT * FROM public.get_published_tours(${slug})`,
    ).toEqual([]);
  });
  it("accepts only floor plan assets as plans and publishes their images", async () => {
    const asset = (kind: string) => {
      const id = randomUUID();
      return withTenant(actor, "property:update", (tx) =>
        tx.panoramaAsset.create({
          data: {
            id,
            organizationId: actor.organizationId,
            tourId,
            kind,
            storageKey: randomUUID(),
            uploadKey: randomUUID(),
            fileName: `${kind}.webp`,
            mimeType: "image/png",
            size: 100,
            status: "READY",
          },
        }),
      );
    };
    const plan = await asset("FLOOR_PLAN");
    const unused = await asset("FLOOR_PLAN");
    const panorama = await asset("PANORAMA");
    const planId = randomUUID();
    const withPlan = (planAsset: string): TourDocument => ({
      ...document,
      floorPlans: [{ id: planId, assetId: planAsset, title: "Térreo" }],
      scenes: document.scenes.map((scene) => ({
        ...scene,
        planPosition: { planId, x: 0.4, y: 0.6 },
      })),
    });
    const tour = await getTour(actor, tourId);
    await expect(
      saveTour(actor, {
        id: tourId,
        version: tour.version,
        title: "Tour",
        document: withPlan(panorama.id),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const saved = await saveTour(actor, {
      id: tourId,
      version: tour.version,
      title: "Tour",
      document: withPlan(plan.id),
    });
    await publishTour(actor, tourId, saved, true);
    const [row] = await db.$queryRaw<
      { document: TourDocument; assets: { id: string }[] }[]
    >`SELECT * FROM public.get_published_tours(${slug})`;
    expect(row.document.floorPlans).toHaveLength(1);
    const exposed = row.assets.map((item) => item.id);
    expect(exposed).toContain(plan.id);
    expect(exposed).not.toContain(unused.id);
    expect(exposed).not.toContain(panorama.id);
  });
});
