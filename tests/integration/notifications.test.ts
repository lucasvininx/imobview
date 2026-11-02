import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant";
import {
  createBroker,
  deactivateBroker,
} from "@/features/organizations/brokers";
import { saveDistribution } from "@/features/organizations/distribution";
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
  updateRequest,
} from "@/features/leads/service";
import {
  listNotifications,
  readNotifications,
} from "@/features/notifications/service";
import { deliverWhatsApp } from "@/features/notifications/whatsapp";

const orgId = randomUUID(),
  otherOrg = randomUUID();
const ownerId = randomUUID(),
  brokerUser = randomUUID(),
  secondUser = randomUUID(),
  viewerUser = randomUUID();
const actor = { userId: ownerId, organizationId: orgId };
const member = { userId: brokerUser, organizationId: orgId };
const otherMember = { userId: secondUser, organizationId: orgId };
const viewer = { userId: viewerUser, organizationId: orgId };
const outsider = { userId: ownerId, organizationId: otherOrg };
let propertyId: string, slug: string, tourId: string, a: string, b: string;
const scene = randomUUID();
async function register(email = `${randomUUID()}@example.test`) {
  const result = await beginVisit(
    {
      slug,
      tourId,
      tracking: true,
      contact: {
        name: "Cliente Teste",
        email,
        phone: "11999999999",
        consent: true,
      },
    },
    hashToken(randomUUID()),
  );
  const leads = await listLeads(actor);
  return { ...result, lead: leads.find((l) => l.email === email)! };
}
beforeAll(async () => {
  for (const [id, email] of [
    [ownerId, `${ownerId}@test.local`],
    [brokerUser, "broker-a@test.local"],
    [secondUser, "broker-b@test.local"],
    [viewerUser, `${viewerUser}@test.local`],
  ])
    await db.user.create({ data: { id, name: "Teste", email } });
  for (const id of [orgId, otherOrg])
    await db.organization.create({
      data: {
        id,
        name: "Imobiliária",
        slug: id,
        members: { create: { userId: ownerId, role: "OWNER" } },
      },
    });
  for (const [userId, role] of [
    [brokerUser, "MEMBER"],
    [secondUser, "MEMBER"],
    [viewerUser, "VIEWER"],
  ] as const)
    await db.organizationMember.create({
      data: { organizationId: orgId, userId, role },
    });
  a = (
    await createBroker(actor, {
      name: "Corretor A",
      email: "broker-a@test.local",
      phone: "11999999991",
    })
  ).id;
  b = (
    await createBroker(actor, {
      name: "Corretor B",
      email: "broker-b@test.local",
      phone: "11999999992",
    })
  ).id;
  await withTenant(actor, "property:create", async (tx) => {
    const p = await tx.property.create({
      data: {
        organizationId: orgId,
        title: "Casa",
        slug: randomUUID(),
        status: "PUBLISHED",
        brokerId: a,
      },
    });
    propertyId = p.id;
    slug = p.slug;
    tourId = (
      await tx.tour.create({
        data: {
          organizationId: orgId,
          propertyId,
          title: "Tour",
          status: "PUBLISHED",
          published: { scenes: [{ id: scene, title: "Sala" }] },
        },
      })
    ).id;
  });
});
afterAll(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await db.organization.deleteMany({
    where: { id: { in: [orgId, otherOrg] } },
  });
  await db.user.deleteMany({
    where: { id: { in: [ownerId, brokerUser, secondUser, viewerUser] } },
  });
  await db.$disconnect();
});
it("requires registration at both application and database boundaries", async () => {
  expect(
    await db.$queryRaw`SELECT r.rolname FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') AND (has_function_privilege(r.oid,'public.claim_whatsapp_deliveries(text)','EXECUTE') OR has_function_privilege(r.oid,'public.notify_lead_team(uuid,text,text,text)','EXECUTE') OR has_function_privilege(r.oid,'public.begin_identified_tour_visit(jsonb,text,text)','EXECUTE'))`,
  ).toEqual([]);
  await expect(
    beginVisit({ slug, tourId, tracking: true }, hashToken(randomUUID())),
  ).rejects.toThrow();
  await expect(
    db.$queryRaw`SELECT public.begin_tour_visit(${JSON.stringify({ slug, tourId, tracking: true })}::jsonb,${hashToken(randomUUID())},${hashToken(randomUUID())})`,
  ).rejects.toThrow();
  await expect(
    db.$queryRaw`SELECT public.begin_identified_tour_visit('{}'::jsonb,'a','b')`,
  ).rejects.toThrow();
  expect(
    await db.$queryRaw`SELECT * FROM public.get_identified_tour(${"a".repeat(64)})`,
  ).toEqual([]);
});
it("persists contact and incomplete metrics without a physical visit request", async () => {
  const visit = await register();
  expect(visit.lead.brokerId).toBe(a);
  await recordEvent(visit.token, { sequence: 1, kind: "START" });
  await recordEvent(visit.token, {
    sequence: 2,
    kind: "SCENE",
    sceneId: scene,
  });
  await recordEvent(visit.token, {
    sequence: 3,
    kind: "HEARTBEAT",
    sceneId: scene,
    durationMs: 10000,
  });
  const lead = await getLead(actor, visit.lead.id);
  expect(lead.requests).toHaveLength(0);
  expect(lead.visits[0].completedAt).toBeNull();
  expect(lead.visits[0].events).toHaveLength(3);
  expect(
    await db.$queryRaw`SELECT * FROM public.get_identified_tour(${hashToken(visit.token)})`,
  ).toHaveLength(1);
});
it("notifies administrators and the assigned broker, with private read state", async () => {
  const visit = await register();
  const owners = await listNotifications(actor),
    assigned = await listNotifications(member);
  expect(owners.items.some((n) => n.leadId === visit.lead.id)).toBe(true);
  expect(assigned.items.some((n) => n.leadId === visit.lead.id)).toBe(true);
  expect(
    (await listNotifications(otherMember)).items.some(
      (n) => n.leadId === visit.lead.id,
    ),
  ).toBe(false);
  expect((await listNotifications(outsider)).items).toEqual([]);
  expect(await db.notification.findMany()).toEqual([]);
  await expect(listNotifications(viewer)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  const notification = owners.items.find((n) => n.leadId === visit.lead.id)!;
  await readNotifications(member, notification.id);
  expect(
    (await listNotifications(actor)).items.find((n) => n.id === notification.id)
      ?.readAt,
  ).toBeNull();
  await readNotifications(actor, notification.id);
  expect(
    (await listNotifications(actor)).items.find((n) => n.id === notification.id)
      ?.readAt,
  ).not.toBeNull();
});
it("distributes simultaneous new leads one by one and preserves the broker on return", async () => {
  await saveDistribution(actor, {
    leadDistribution: "ROUND_ROBIN",
    whatsappVisitAlerts: false,
  });
  const visits = await Promise.all(Array.from({ length: 8 }, () => register()));
  expect(visits.filter((v) => v.lead.brokerId === a)).toHaveLength(4);
  expect(visits.filter((v) => v.lead.brokerId === b)).toHaveLength(4);
  const first = visits[0];
  const returned = await beginVisit(
    { slug, tourId, tracking: true, returnKey: first.returnKey },
    hashToken(randomUUID()),
  );
  expect((await getLead(actor, first.lead.id)).brokerId).toBe(
    first.lead.brokerId,
  );
  expect(
    (await listNotifications(actor)).items.some(
      (n) => n.kind === "TOUR_RETURNED" && n.leadId === first.lead.id,
    ),
  ).toBe(true);
  expect(returned.token).not.toBe(first.token);
});
it("weights sales and rentals while still sending leads to brokers without wins", async () => {
  await withTenant(actor, "lead:update", (tx) =>
    tx.lead.updateMany({
      where: { organizationId: orgId },
      data: { stage: "NEW", wonAt: null },
    }),
  );
  const prior = (await listLeads(actor)).find((l) => l.brokerId === a)!;
  await updateLead(actor, prior.id, { stage: "WON", notes: "" });
  await saveDistribution(actor, {
    leadDistribution: "PERFORMANCE",
    whatsappVisitAlerts: false,
  });
  const visits = [];
  for (let i = 0; i < 9; i++) visits.push(await register());
  expect(visits.filter((v) => v.lead.brokerId === a)).toHaveLength(6);
  expect(visits.filter((v) => v.lead.brokerId === b)).toHaveLength(3);
  await deactivateBroker(actor, b);
  expect((await register()).lead.brokerId).toBe(a);
  await withTenant(actor, "organization:manage", (tx) =>
    tx.broker.update({ where: { id: b }, data: { active: true } }),
  );
});
it("rejects foreign broker assignment and settings changes by ordinary members", async () => {
  await expect(
    saveDistribution(member, {
      leadDistribution: "PROPERTY",
      whatsappVisitAlerts: false,
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const foreign = await createBroker(outsider, {
    name: "Corretor C",
    email: "c@test.local",
    phone: "11999999993",
  });
  await expect(
    updateLead(actor, (await listLeads(actor))[0].id, {
      stage: "NEW",
      notes: "",
      brokerId: foreign.id,
    }),
  ).rejects.toMatchObject({ code: "VALIDATION" });
});
it("notifies the receiving broker after a manual reassignment", async () => {
  const visit = await register();
  const next = visit.lead.brokerId === a ? b : a;
  await updateLead(actor, visit.lead.id, {
    stage: "NEW",
    notes: "",
    brokerId: next,
  });
  const target = next === a ? member : otherMember;
  expect(
    (await listNotifications(target)).items.some(
      (n) => n.leadId === visit.lead.id && n.kind === "LEAD_ASSIGNED",
    ),
  ).toBe(true);
});
it("queues once per request/status, retries provider failures and prevents duplicate claims", async () => {
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "test-token");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1234");
  vi.stubEnv("WHATSAPP_API_VERSION", "v25.0");
  vi.stubEnv("WHATSAPP_VISIT_TEMPLATE", "aviso_visita");
  await saveDistribution(actor, {
    leadDistribution: "PROPERTY",
    whatsappVisitAlerts: true,
  });
  const visit = await register();
  const input = {
    preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    period: "MORNING",
  };
  await requestVisit(visit.token, input);
  await requestVisit(visit.token, input);
  const lead = await getLead(actor, visit.lead.id);
  let jobs = await withTenant(actor, "lead:read", (tx) =>
    tx.whatsAppDelivery.findMany({ where: { requestId: lead.requests[0].id } }),
  );
  expect(jobs).toHaveLength(1);
  expect(jobs[0].phone).toBe("5511999999991");
  const calls = vi
    .fn()
    .mockResolvedValueOnce(new Response("", { status: 503 }))
    .mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "accepted" }] }), {
        status: 200,
      }),
    );
  vi.stubGlobal("fetch", calls);
  expect(await deliverWhatsApp(hashToken(visit.token))).toMatchObject({
    failed: 1,
  });
  expect(await deliverWhatsApp(hashToken(visit.token))).toMatchObject({
    accepted: 0,
    failed: 0,
  });
  // Only the test's isolated database administrative connection may advance retry times.
  const { Pool } = await import("pg");
  const { testAdminUrl } = await import("../database-url");
  const pool = new Pool({ connectionString: testAdminUrl() });
  try {
    await pool.query(
      'UPDATE "WhatsAppDelivery" SET "availableAt"=now() WHERE "requestId"=$1',
      [lead.requests[0].id],
    );
  } finally {
    await pool.end();
  }
  const concurrent = await Promise.all([
    deliverWhatsApp(hashToken(visit.token)),
    deliverWhatsApp(hashToken(visit.token)),
  ]);
  expect(concurrent.reduce((sum, r) => sum + r.accepted, 0)).toBe(1);
  expect(calls).toHaveBeenCalledTimes(2);
  await updateRequest(actor, lead.requests[0].id, "CONFIRMED");
  await updateRequest(actor, lead.requests[0].id, "CONFIRMED");
  jobs = await withTenant(actor, "lead:read", (tx) =>
    tx.whatsAppDelivery.findMany({ where: { requestId: lead.requests[0].id } }),
  );
  expect(jobs).toHaveLength(2);
  expect(jobs.filter((j) => j.kind === "VISIT_CONFIRMED")).toHaveLength(1);
  await updateRequest(actor, lead.requests[0].id, "CANCELLED");
  expect(await deliverWhatsApp(hashToken(visit.token))).toMatchObject({
    accepted: 0,
  });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
