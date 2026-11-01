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
import { simulateFinancing } from "@/features/financing/calc";
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
  leadId: string,
  returnKey: string;
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
  expect(lead.interest.reasons.map((r) => r.label)).toContain(
    "Viu todos os ambientes do tour",
  );
  expect((await listLeads(actor))[0].interest).toEqual(lead.interest);
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
  expect(lead.interest.reasons[0]).toEqual({
    label: "Pediu visita presencial",
    points: 35,
  });
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
it("records financing simulations with a server-computed installment only for measured visits", async () => {
  await withTenant(actor, "property:update", (tx) =>
    tx.property.update({
      where: { id: propertyId },
      data: { priceCents: BigInt(50_000_000) },
    }),
  );
  const simulation = {
    downPaymentCents: 10_000_000,
    termMonths: 360,
    rateBps: 1150,
    system: "PRICE" as const,
  };
  const visit = await withTenant(actor, "lead:read", (tx) =>
    tx.tourVisit.findFirstOrThrow({
      where: { leadId, tracking: true },
      orderBy: { createdAt: "asc" },
    }),
  );
  let sequence = visit.lastSequence;
  expect(
    await recordEvent(token, {
      sequence: ++sequence,
      kind: "SIMULATE",
      simulation,
    }),
  ).toBe(true);
  // A down payment equal to the price is rejected and does not consume the sequence.
  expect(
    await recordEvent(token, {
      sequence: sequence + 1,
      kind: "SIMULATE",
      simulation: { ...simulation, downPaymentCents: 50_000_000 },
    }),
  ).toBe(false);
  const lead = await getLead(actor, leadId);
  const stored = lead.visits.flatMap((v) => v.simulations);
  expect(stored).toHaveLength(1);
  expect(Number(stored[0].installmentCents)).toBe(
    simulateFinancing(50_000_000, simulation)!.firstInstallmentCents,
  );
  expect(lead.interest.measured).toBe(true);
  // Opening a room detail is recorded with the room (scored in lead-score tests).
  expect(
    await recordEvent(token, {
      sequence: ++sequence,
      kind: "DETAIL",
      sceneId: sceneA,
    }),
  ).toBe(true);
  expect(
    (await getLead(actor, leadId)).visits
      .flatMap((v) => v.events)
      .filter((e) => e.kind === "DETAIL")
      .map((e) => e.sceneId),
  ).toEqual([sceneA]);
  expect(await analytics(actor, propertyId)).toMatchObject({ simulations: 1 });
  expect(await analytics(other, propertyId)).toMatchObject({ simulations: 0 });
  expect(await db.financingSimulation.findMany()).toEqual([]);
  const [settings] = await db.$queryRaw<
    { purpose: string; financingRateBps: number }[]
  >`SELECT * FROM public.get_financing_settings(${slug})`;
  expect(settings).toMatchObject({ purpose: "SALE", financingRateBps: 1150 });
});
it("recognizes a returning e-mail on the same property without overwriting stored contact data", async () => {
  const before = await getLead(actor, leadId);
  const visit = await beginVisit(
    {
      slug,
      tourId,
      tracking: false,
      contact: {
        ...contact,
        name: "Outra Pessoa",
        email: "FICTICIO@example.com",
        phone: "(11) 98888-7777",
      },
    },
    hashToken(randomUUID()),
  );
  expect(visit.returnKey).toMatch(/^[a-f0-9]{64}$/);
  returnKey = visit.returnKey!;
  const leads = await listLeads(actor);
  expect(leads).toHaveLength(1);
  const lead = await getLead(actor, leadId);
  expect(lead.visits).toHaveLength(before.visits.length + 1);
  expect(lead).toMatchObject({
    name: contact.name,
    phone: contact.phone,
    stage: "WON",
  });
  expect(lead.notes).toContain("Contato informado: Outra Pessoa · 11988887777");
  // Only the hash of the browser key is stored.
  const devices = await withTenant(actor, "lead:read", (tx) =>
    tx.leadDevice.findMany({ where: { leadId } }),
  );
  expect(devices.map((d) => d.keyHash)).toContain(hashToken(returnKey));
  expect(JSON.stringify(devices)).not.toContain(returnKey);
  expect(await db.leadDevice.findMany()).toEqual([]);
});
it("resumes visits with the browser key only on the property that issued it", async () => {
  const before = (await getLead(actor, leadId)).visits.length;
  const resumed = await beginVisit(
    { slug, tourId, tracking: true, returnKey },
    hashToken(randomUUID()),
  );
  expect(resumed.returnKey).toBeUndefined();
  expect(await recordEvent(resumed.token, { sequence: 1, kind: "START" })).toBe(
    true,
  );
  expect((await getLead(actor, leadId)).visits).toHaveLength(before + 1);
  await expect(
    beginVisit(
      { slug, tourId, tracking: true, returnKey: "a".repeat(64) },
      hashToken(randomUUID()),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    beginVisit(
      { slug, tourId, tracking: true, returnKey, contact },
      hashToken(randomUUID()),
    ),
  ).rejects.toThrow();
  const second = await withTenant(actor, "property:create", async (tx) => {
    const property = await tx.property.create({
      data: {
        organizationId: orgId,
        title: "Outra casa",
        slug: randomUUID(),
        status: "PUBLISHED",
      },
    });
    const tour = await tx.tour.create({
      data: {
        organizationId: orgId,
        propertyId: property.id,
        title: "Tour",
        status: "PUBLISHED",
        published: { scenes: [{ id: randomUUID(), title: "Sala" }] },
      },
    });
    return { slug: property.slug, tourId: tour.id };
  });
  await expect(
    beginVisit(
      { ...second, tracking: true, returnKey },
      hashToken(randomUUID()),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("reopens a lost lead that identifies again and scores the return", async () => {
  await updateLead(actor, leadId, { stage: "LOST", notes: "" });
  await beginVisit(
    { slug, tourId, tracking: false, contact },
    hashToken(randomUUID()),
  );
  const lead = await getLead(actor, leadId);
  expect(lead.stage).toBe("NEW");
  expect(lead.notes).toBe("");
  expect(lead.interest.level).not.toBe("LOST");
  expect(lead.interest.reasons.map((r) => r.label)).toContainEqual(
    expect.stringMatching(/^Voltou ao imóvel \(\d+ visitas\)$/),
  );
});
it("reports retention in dry run and removes only expired journey data when applied", async () => {
  const visits = await withTenant(actor, "lead:read", (tx) =>
    tx.tourVisit.findMany({ where: { leadId }, orderBy: { createdAt: "asc" } }),
  );
  await withTenant(actor, "lead:update", (tx) =>
    tx.tourVisit.update({
      where: { id: visits[0].id },
      data: { createdAt: new Date(Date.now() - 100 * 86400000) },
    }),
  );
  const [dry] = await db.$queryRaw<
    { visits: bigint }[]
  >`SELECT * FROM public.purge_journey_data(false)`;
  expect(Number(dry.visits)).toBeGreaterThanOrEqual(1);
  expect((await getLead(actor, leadId)).visits).toHaveLength(visits.length);
  await db.$queryRaw`SELECT * FROM public.purge_journey_data(true)`;
  const lead = await getLead(actor, leadId);
  expect(lead.visits).toHaveLength(visits.length - 1);
  expect(lead.visits.map((v) => v.id)).not.toContain(visits[0].id);
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
  expect(
    await withTenant(actor, "lead:read", (tx) =>
      tx.leadDevice.count({ where: { leadId } }),
    ),
  ).toBe(0);
});
