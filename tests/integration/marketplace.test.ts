import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant";
import {
  saveLeadProfile,
  getLead,
  leadDirectory,
  analytics,
  moveLeadStage,
} from "@/features/leads/service";
import { searchMarketplace } from "@/features/marketplace/service";
import { searchSchema } from "@/features/marketplace/search";
import { isCompleteLead } from "@/features/leads/profile-schema";
const userId = randomUUID(),
  org = randomUUID(),
  otherOrg = randomUUID(),
  viewerId = randomUUID();
const actor = { userId, organizationId: org },
  other = { userId, organizationId: otherOrg },
  viewer = { userId: viewerId, organizationId: org };
let propertyId: string, slug: string;
const contact = {
  name: "Cliente de teste",
  email: "cliente-marketplace@example.com",
  phone: "11999999999",
  consent: true,
};
beforeAll(async () => {
  await db.user.createMany({
    data: [
      { id: userId, name: "Teste", email: `${userId}@imobview.test` },
      { id: viewerId, name: "Viewer", email: `${viewerId}@imobview.test` },
    ],
  });
  for (const id of [org, otherOrg])
    await db.organization.create({
      data: {
        id,
        name: "Imobiliária de teste",
        slug: id,
        members: {
          create: [
            { userId, role: "OWNER" },
            ...(id === org
              ? [{ userId: viewerId, role: "VIEWER" as const }]
              : []),
          ],
        },
      },
    });
  await withTenant(actor, "property:create", async (tx) => {
    const p = await tx.property.create({
      data: {
        organizationId: org,
        title: "Casa exclusiva marketplace",
        slug: randomUUID(),
        type: "HOUSE",
        purpose: "RENT",
        city: "Campinas",
        neighborhood: "Cambuí",
        state: "SP",
        bedrooms: 3,
        bathrooms: 2,
        parkingSpaces: 4,
        priceCents: 350000,
        area: 180,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    propertyId = p.id;
    slug = p.slug;
    await tx.property.create({
      data: {
        organizationId: org,
        title: "Imóvel privado marketplace",
        slug: randomUUID(),
        status: "DRAFT",
      },
    });
  });
});
afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: [org, otherOrg] } } });
  await db.user.deleteMany({ where: { id: { in: [userId, viewerId] } } });
  await db.$disconnect();
});
it("searches all published stock with accented locations and numeric constraints, excluding drafts", async () => {
  const result = await searchMarketplace(
    searchSchema.parse({
      q: "alugar casa em Campinas no bairro Cambui com tres quartos dois banheiros quatro vagas até 4 mil",
    }),
  );
  expect(result.items.map((p) => p.slug)).toContain(slug);
  expect(JSON.stringify(result)).not.toContain("Imóvel privado marketplace");
  expect(result.items.find((p) => p.slug === slug)).not.toHaveProperty(
    "organizationId",
  );
  expect(
    (
      await searchMarketplace(
        searchSchema.parse({
          q: "Casa exclusiva marketplace",
          parkingSpaces: 5,
        }),
      )
    ).total,
  ).toBe(0);
  expect(
    (
      await searchMarketplace(
        searchSchema.parse({
          q: "Casa exclusiva marketplace",
          purpose: "SALE",
        }),
      )
    ).total,
  ).toBe(0);
});
it("creates a client without a property and completes it while preserving tenant access", async () => {
  const lead = await saveLeadProfile(actor, {
    ...contact,
    cpf: "",
    birthDate: "",
    propertyId: "",
  });
  expect(lead.propertyId).toBeNull();
  expect(isCompleteLead(lead)).toBe(false);
  expect((await leadDirectory(actor, {})).items.map((p) => p.id)).toContain(
    lead.id,
  );
  expect((await leadDirectory(other, {})).total).toBe(0);
  await expect(getLead(other, lead.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(
    saveLeadProfile(
      other,
      { ...contact, cpf: "", birthDate: "", propertyId },
      lead.id,
    ),
  ).rejects.toBeDefined();
  await expect(
    saveLeadProfile(viewer, {
      ...contact,
      cpf: "",
      birthDate: "",
      propertyId: "",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const updated = await saveLeadProfile(
    actor,
    { ...contact, cpf: "529.982.247-25", birthDate: "1990-01-01", propertyId },
    lead.id,
  );
  expect(isCompleteLead(updated)).toBe(true);
  expect(
    (await leadDirectory(actor, { completeness: "complete" })).items.map(
      (p) => p.id,
    ),
  ).toContain(lead.id);
});
it("captures portal interest into the property's tenant and deduplicates repeated submissions", async () => {
  const payload = { ...contact, slug };
  const submit = (data: unknown) =>
    db.$queryRaw<
      { ok: boolean }[]
    >`SELECT public.register_marketplace_interest(${JSON.stringify(data)}::jsonb,${"a".repeat(64)}) AS ok`;
  expect((await submit({ ...payload, consent: false }))[0].ok).toBe(false);
  expect((await submit({ ...payload, slug: "missing-property" }))[0].ok).toBe(
    false,
  );
  const portalPayload = {
    ...payload,
    email: "portal-marketplace@example.com",
    organizationId: otherOrg,
  };
  expect((await submit(portalPayload))[0].ok).toBe(true);
  expect((await submit(portalPayload))[0].ok).toBe(true);
  const leads = (await leadDirectory(actor, { source: "marketplace" })).items;
  expect(leads.filter((p) => p.email === portalPayload.email)).toHaveLength(1);
  expect(leads[0].organizationId).toBe(org);
  expect(isCompleteLead(leads[0])).toBe(false);
  expect((await leadDirectory(other, { source: "marketplace" })).total).toBe(0);
});
it("returns a 30 day analytics series without leaking other tenants", async () => {
  const data = await analytics(actor);
  expect(data.daily).toHaveLength(30);
  expect(data.leads).toBeGreaterThanOrEqual(2);
  expect(data.daily.reduce((sum, day) => sum + day.leads, 0)).toBe(data.leads);
  expect((await analytics(other)).leads).toBe(0);
});
it("lists and identifies demonstration properties without treating them as real offers", async () => {
  const demo = await withTenant(actor, "property:create", (tx) =>
    tx.property.create({
      data: {
        organizationId: org,
        title: "Oferta demonstrativa marketplace",
        slug: randomUUID(),
        status: "PUBLISHED",
        isDemo: true,
        city: "Campinas",
        priceCents: 100000,
        area: 100,
      },
    }),
  );
  const result = await searchMarketplace(
    searchSchema.parse({ q: "Oferta demonstrativa marketplace" }),
  );
  expect(result.total).toBe(1);
  expect(result.items[0].isDemo).toBe(true);
  expect(
    await withTenant(actor, "property:read", (tx) =>
      tx.property.count({ where: { id: demo.id } }),
    ),
  ).toBe(1);
});
it("moves CRM status without overwriting notes, records milestones and rejects stale or cross-tenant moves", async () => {
  const lead = await saveLeadProfile(actor, {
    ...contact,
    email: "crm-move@example.com",
    cpf: "",
    birthDate: "",
    propertyId: "",
  });
  await withTenant(actor, "lead:update", (tx) =>
    tx.lead.update({
      where: { id: lead.id },
      data: { notes: "Manter estas anotações" },
    }),
  );
  await expect(
    moveLeadStage(other, lead.id, { stage: "PROPOSAL", expectedStage: "NEW" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    moveLeadStage(viewer, lead.id, { stage: "PROPOSAL", expectedStage: "NEW" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await moveLeadStage(actor, lead.id, {
    stage: "PROPOSAL",
    expectedStage: "NEW",
  });
  const proposal = await getLead(actor, lead.id);
  expect(proposal.proposalAt).not.toBeNull();
  expect(proposal.notes).toBe("Manter estas anotações");
  await expect(
    moveLeadStage(actor, lead.id, { stage: "LOST", expectedStage: "NEW" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await moveLeadStage(actor, lead.id, {
    stage: "WON",
    expectedStage: "PROPOSAL",
  });
  const won = await getLead(actor, lead.id);
  expect(won.wonAt).not.toBeNull();
  await moveLeadStage(actor, lead.id, { stage: "NEW", expectedStage: "WON" });
  const reopened = await getLead(actor, lead.id);
  expect(reopened.proposalAt).toEqual(proposal.proposalAt);
  expect(reopened.wonAt).toEqual(won.wonAt);
  expect(reopened.notes).toBe(proposal.notes);
});
it("lists every sale or rental across pages without requiring location or text", async () => {
  const prefix = `pagination-${randomUUID()}`;
  await withTenant(actor, "property:create", (tx) =>
    tx.property.createMany({
      data: Array.from({ length: 28 }, (_, i) => ({
        organizationId: org,
        title: `${prefix} ${i}`,
        slug: `${prefix}-${i}`,
        status: "PUBLISHED" as const,
        purpose: i < 14 ? ("RENT" as const) : ("SALE" as const),
        city: "Campinas",
        area: 100,
        priceCents: 100000 + i,
        isDemo: true,
      })),
    }),
  );
  const first = await searchMarketplace(
    searchSchema.parse({ q: prefix, purpose: "RENT", sort: "price-asc" }),
  );
  const second = await searchMarketplace(
    searchSchema.parse({
      q: prefix,
      purpose: "RENT",
      sort: "price-asc",
      page: 2,
    }),
  );
  expect(first.total).toBe(14);
  expect(first.items).toHaveLength(12);
  expect(second.items).toHaveLength(2);
  expect(
    new Set([...first.items, ...second.items].map((p) => p.slug)).size,
  ).toBe(14);
  const rentals = await searchMarketplace(
    searchSchema.parse({ purpose: "RENT" }),
  );
  const sales = await searchMarketplace(
    searchSchema.parse({ purpose: "SALE" }),
  );
  expect(rentals.total).toBeGreaterThanOrEqual(14);
  expect(rentals.items.every((p) => p.purpose === "RENT")).toBe(true);
  expect(sales.total).toBeGreaterThanOrEqual(14);
  expect(sales.items.every((p) => p.purpose === "SALE")).toBe(true);
});
