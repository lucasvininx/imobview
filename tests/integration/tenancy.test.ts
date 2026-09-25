import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { withTenant, type Actor } from "@/server/tenant";
import {
  saveProperty,
  getProperty,
  listProperties,
  changePropertyStatus,
} from "@/features/properties/service";
import { getPublicProperty } from "@/features/properties/public-service";
let actorA: Actor;
let actorB: Actor;
let viewer: Actor;
let member: Actor;
let propertyId: string;
let slug: string;
const input = {
  title: "Imóvel de teste de isolamento",
  description: "Descrição completa do imóvel fictício",
  type: "HOUSE",
  purpose: "SALE",
  city: "São Paulo",
  state: "SP",
  neighborhood: "Centro",
  price: "980000,99",
  area: 150,
  bedrooms: 3,
  bathrooms: 2,
  parkingSpaces: 2,
};
const viewerId = randomUUID(),
  memberId = randomUUID();
beforeAll(async () => {
  const users = await db.user.findMany({
    where: { email: { in: ["admin@imobview.test", "outro@imobview.test"] } },
    include: { memberships: true },
  });
  const first = users.find((u) => u.email === "admin@imobview.test")!;
  const second = users.find((u) => u.email === "outro@imobview.test")!;
  actorA = {
    userId: first.id,
    organizationId: first.memberships[0].organizationId,
  };
  actorB = {
    userId: second.id,
    organizationId: second.memberships[0].organizationId,
  };
  for (const [id, role] of [
    [viewerId, "VIEWER"],
    [memberId, "MEMBER"],
  ] as const) {
    await db.user.create({
      data: { id, name: "Usuário teste", email: `${id}@imobview.test` },
    });
    await db.organizationMember.create({
      data: { userId: id, organizationId: actorA.organizationId, role },
    });
  }
  viewer = { userId: viewerId, organizationId: actorA.organizationId };
  member = { userId: memberId, organizationId: actorA.organizationId };
});
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [viewerId, memberId] } } });
  await db.$disconnect();
});
describe("PostgreSQL real: tenant boundary and publication", () => {
  it("uses a runtime role without superuser or bypassrls", async () => {
    const [role] = await db.$queryRaw<
      { rolsuper: boolean; rolbypassrls: boolean }[]
    >`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
    expect(role.rolsuper).toBe(false);
    expect(role.rolbypassrls).toBe(false);
    const [ownership] = await db.$queryRaw<
      { owner: boolean }[]
    >`SELECT tableowner = current_user AS owner FROM pg_tables WHERE schemaname='public' AND tablename='Property'`;
    expect(ownership.owner).toBe(false);
  });
  it("creates a draft with exact monetary value", async () => {
    const property = await saveProperty(actorA, input);
    propertyId = property.id;
    slug = property.slug;
    expect(property.status).toBe("DRAFT");
    expect(property.priceCents).toBe(BigInt(98000099));
  });
  it("denies organization A access to organization B property", async () => {
    const foreign = await listProperties(actorB);
    expect(foreign.length).toBeGreaterThan(0);
    await expect(getProperty(actorA, foreign[0].id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      saveProperty(actorA, input, foreign[0].id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      changePropertyStatus(actorA, foreign[0].id, "PUBLISHED"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("refuses a forged organization context", async () => {
    await expect(
      listProperties({ ...actorA, organizationId: actorB.organizationId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("RLS hides rows even when a developer forgets the tenant filter", async () => {
    const rows = await withTenant(actorA, "property:read", (tx) =>
      tx.property.findMany(),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((row) => row.organizationId === actorA.organizationId),
    ).toBe(true);
    expect(await db.property.findMany()).toEqual([]);
  });
  it("RLS rejects inserts into another organization", async () => {
    await expect(
      withTenant(actorA, "property:create", (tx) =>
        tx.property.create({
          data: {
            title: "Cross tenant",
            slug: randomUUID(),
            organizationId: actorB.organizationId,
          },
        }),
      ),
    ).rejects.toThrow();
  });
  it("viewer cannot create or edit, member cannot publish", async () => {
    await expect(saveProperty(viewer, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(saveProperty(viewer, input, propertyId)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
    await expect(
      changePropertyStatus(member, propertyId, "PUBLISHED"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("does not expose draft data through public projection", async () => {
    expect(await getPublicProperty(slug)).toBeNull();
    expect(await getPublicProperty("' OR 1=1 --")).toBeNull();
  });
  it("edits, publishes and returns only allowlisted public fields", async () => {
    await saveProperty(
      actorA,
      { ...input, title: "Título atualizado" },
      propertyId,
    );
    await changePropertyStatus(actorA, propertyId, "PUBLISHED");
    const published = await getPublicProperty(slug);
    expect(published?.title).toBe("Título atualizado");
    expect(published).not.toHaveProperty("organizationId");
    expect(published).not.toHaveProperty("id");
  });
  it("archive immediately removes public access and prevents edits", async () => {
    await changePropertyStatus(actorA, propertyId, "ARCHIVED");
    expect(await getPublicProperty(slug)).toBeNull();
    await expect(saveProperty(actorA, input, propertyId)).rejects.toMatchObject(
      { code: "CONFLICT" },
    );
  });
  it("requires publication details", async () => {
    const draft = await saveProperty(actorA, { ...input, description: "" });
    await expect(
      changePropertyStatus(actorA, draft.id, "PUBLISHED"),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await changePropertyStatus(actorA, draft.id, "ARCHIVED");
  });
});
