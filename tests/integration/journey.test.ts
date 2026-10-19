import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant";
import {
  beginVisit,
  hashToken,
  recordEvent,
  requestVisit,
} from "@/features/leads/public-service";
import {
  getLead,
  listLeads,
  updateLead,
  analytics,
  deleteLead,
} from "@/features/leads/service";
import { createBroker } from "@/features/organizations/brokers";
import { saveCommercial } from "@/features/properties/commercial-service";
const userId = randomUUID(),
  orgId = randomUUID(),
  otherOrg = randomUUID(),
  sceneA = randomUUID(),
  sceneB = randomUUID();
const actor = { userId, organizationId: orgId },
  other = { userId, organizationId: otherOrg };
let propertyId: string,
  tourId: string,
  slug: string,
  token: string,
  leadId: string;
const contact = {
  name: "Visitante fictício",
  email: "ficticio@example.com",
  phone: "11999999999",
  consent: true,
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
        members: { create: { userId, role: "OWNER" } },
      },
    });
  await withTenant(actor, "property:create", async (tx) => {
    const property = await tx.property.create({
      data: {
        organizationId: orgId,
        title: "Casa jornada",
        slug: randomUUID(),
        status: "PUBLISHED",
      },
    });
    propertyId = property.id;
    slug = property.slug;
    const tour = await tx.tour.create({
      data: {
        organizationId: orgId,
        propertyId,
        title: "Tour",
        status: "PUBLISHED",
        published: {
          scenes: [
            { id: sceneA, title: "Sala" },
            { id: sceneB, title: "Quarto" },
          ],
        },
      },
    });
    tourId = tour.id;
  });
});
afterAll(async () => {
  await db.organization.deleteMany({
    where: { id: { in: [orgId, otherOrg] } },
  });
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});
it("captures contact only for the published property's own tenant and stores no bearer token", async () => {
  const result = await beginVisit(
    { slug, tourId, tracking: true, contact, source: "instagram" },
    hashToken(randomUUID()),
  );
  token = result.token;
  const leads = await listLeads(actor);
  leadId = leads[0].id;
  expect(leads).toHaveLength(1);
  expect(leads[0].organizationId).toBe(orgId);
  expect(await db.lead.findMany()).toEqual([]);
  expect(await listLeads(other)).toEqual([]);
  await expect(getLead(other, leadId)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(
    updateLead(other, leadId, { stage: "WON", notes: "" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  const visit = await withTenant(actor, "lead:read", (tx) =>
    tx.tourVisit.findFirstOrThrow({ where: { leadId } }),
  );
  expect(visit.tokenHash).toBe(hashToken(token));
  expect(visit.tokenHash).not.toBe(token);
});
it("deduplicates events, rejects forged sessions and scene ids, and only completes after all rooms", async () => {
  expect(
    await recordEvent("a".repeat(64), { sequence: 1, kind: "START" }),
  ).toBe(false);
  expect(await recordEvent(token, { sequence: 1, kind: "START" })).toBe(true);
  expect(await recordEvent(token, { sequence: 1, kind: "START" })).toBe(true);
  expect(
    await recordEvent(token, {
      sequence: 2,
      kind: "SCENE",
      sceneId: randomUUID(),
    }),
  ).toBe(false);
  expect(await recordEvent(token, { sequence: 2, kind: "COMPLETE" })).toBe(
    false,
  );
  expect(
    await recordEvent(token, { sequence: 2, kind: "SCENE", sceneId: sceneA }),
  ).toBe(true);
  expect(
    await recordEvent(token, { sequence: 3, kind: "SCENE", sceneId: sceneB }),
  ).toBe(true);
  expect(await recordEvent(token, { sequence: 4, kind: "COMPLETE" })).toBe(
    true,
  );
  const lead = await getLead(actor, leadId);
  expect(lead.stage).toBe("TOUR_COMPLETED");
  expect(lead.visits[0].events).toHaveLength(4);
});
it("does not record behavioral events without measurement consent", async () => {
  const visit = await beginVisit(
    { slug, tourId, tracking: false, contact },
    hashToken(randomUUID()),
  );
  expect(await recordEvent(visit.token, { sequence: 1, kind: "START" })).toBe(
    false,
  );
});
it("records idempotent visit requests and keeps commercial stage and analytics tenant scoped", async () => {
  const input = {
    preferredDate: new Date(Date.now() + 86400000 * 2)
      .toISOString()
      .slice(0, 10),
    period: "AFTERNOON",
  };
  await requestVisit(token, input);
  await requestVisit(token, input);
  const lead = await getLead(actor, leadId);
  expect(lead.requests).toHaveLength(1);
  expect(lead.stage).toBe("VISIT_REQUESTED");
  await updateLead(actor, leadId, {
    stage: "PROPOSAL",
    notes: "Atendimento fictício",
  });
  await updateLead(actor, leadId, { stage: "WON", notes: "" });
  expect(await analytics(actor, propertyId)).toMatchObject({
    started: 1,
    completed: 1,
    requests: 1,
    proposals: 1,
    sales: 1,
  });
  expect(await analytics(other, propertyId)).toMatchObject({
    sessions: 0,
    leads: 0,
    requests: 0,
  });
});
it("rejects new sessions for unpublished properties and prevents viewer access to lead PII", async () => {
  await withTenant(actor, "property:update", (tx) =>
    tx.property.update({
      where: { id: propertyId },
      data: { status: "DRAFT" },
    }),
  );
  await expect(
    beginVisit({ slug, tourId, tracking: true }, hashToken(randomUUID())),
  ).rejects.toThrow();
  await db.organizationMember.update({
    where: { organizationId_userId: actor },
    data: { role: "VIEWER" },
  });
  await expect(listLeads(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    createBroker(actor, {
      name: "Corretor",
      email: "teste@example.com",
      phone: "11999999999",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await db.organizationMember.update({
    where: { organizationId_userId: actor },
    data: { role: "OWNER" },
  });
});
it("customizes draft URLs and rejects another tenant's responsible broker", async () => {
  const ownBroker = await createBroker(actor, {
    name: "Corretor A",
    email: "a@example.com",
    phone: "11999999999",
  });
  const otherBroker = await createBroker(other, {
    name: "Corretor B",
    email: "b@example.com",
    phone: "11999999998",
  });
  const input = {
    slug: `casa-${randomUUID()}`,
    internalCode: "CASA01",
    address: "Endereço interno",
    condominium: "Residencial",
    suites: 2,
    commercialNotes: "Somente equipe",
    captureLeads: true,
    brokerId: otherBroker.id,
  };
  await expect(saveCommercial(actor, propertyId, input)).rejects.toMatchObject({
    code: "VALIDATION",
  });
  await saveCommercial(actor, propertyId, { ...input, brokerId: ownBroker.id });
  const property = await withTenant(actor, "property:read", (tx) =>
    tx.property.findFirstOrThrow({ where: { id: propertyId } }),
  );
  expect(property.slug).toBe(input.slug);
  expect(property.suites).toBe(2);
  await expect(
    saveCommercial(other, propertyId, { ...input, brokerId: otherBroker.id }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await withTenant(actor, "property:update", (tx) =>
    tx.property.update({
      where: { id: propertyId },
      data: { status: "PUBLISHED" },
    }),
  );
  await expect(
    saveCommercial(actor, propertyId, {
      ...input,
      slug: "outra-url",
      brokerId: ownBroker.id,
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
it("deletes personal data and related history together without touching another tenant", async () => {
  await deleteLead(other, leadId);
  expect((await getLead(actor, leadId)).id).toBe(leadId);
  await deleteLead(actor, leadId);
  await expect(getLead(actor, leadId)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(
    await withTenant(actor, "lead:read", (tx) =>
      tx.tourVisit.count({ where: { leadId } }),
    ),
  ).toBe(0);
});
