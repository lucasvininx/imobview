import { beforeAll, afterAll, afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { withTenant } from "@/server/tenant";
import {
  credentialContext,
  calendarContext,
  integrationOverview,
  saveIntegration,
  scheduleVisit,
  retryIntegrations,
  disableIntegration,
} from "@/features/integrations/service";
import { seal } from "@/features/integrations/crypto";
import { deliverIntegrations } from "@/features/integrations/delivery";
import { updateRequest, deleteLead } from "@/features/leads/service";
import { recordReceipt } from "@/features/integrations/webhooks";

const org = randomUUID(),
  otherOrg = randomUUID(),
  owner = randomUUID(),
  memberId = randomUUID(),
  viewerId = randomUUID();
const actor = { organizationId: org, userId: owner },
  member = { organizationId: org, userId: memberId },
  viewer = { organizationId: org, userId: viewerId },
  other = { organizationId: otherOrg, userId: owner };
const settings = {
  clientId: "testing.apps.googleusercontent.com",
  clientSecret: "private-client-secret",
};
const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const schedule = {
  localStart: date + "T10:30",
  duration: 60,
  timeZone: "America/Sao_Paulo",
  syncCalendar: true,
};
let propertyId: string, leadId: string, visitId: string;
const calls: {
  url: string;
  method: string;
  body: Record<string, unknown>;
  key: string;
}[] = [];
const events = new Set<string>();
let emailFailure = 0;
let receiptBeforeAccept = false;
const fetcher = vi.fn(
  async (urlInput: string | URL | Request, options?: RequestInit) => {
    const url = String(urlInput),
      method = options?.method ?? "GET";
    const body =
      typeof options?.body === "string" ? JSON.parse(options.body) : {};
    const headers = new Headers(options?.headers);
    const key = headers.get("Idempotency-Key") ?? "";
    calls.push({ url, method, body, key });
    if (url.includes("oauth2.googleapis.com/token"))
      return Response.json({ access_token: "google-access-test" });
    if (url.includes("googleapis.com/calendar")) {
      const id = String(body.id ?? url.split("/").at(-1)?.split("?")[0]);
      const key =
        (url.match(/calendars\/([^/]+)\/events/)?.[1] ?? "") + ":" + id;
      if (method === "DELETE") {
        const existed = events.delete(key);
        return new Response(null, { status: existed ? 204 : 404 });
      }
      if (method === "POST" && events.has(key))
        return new Response(null, { status: 409 });
      events.add(key);
      return Response.json({
        id,
        htmlLink: "https://www.google.com/calendar/event?eid=" + id,
      });
    }
    if (url.includes("graph.facebook.com") && method === "GET") {
      if (url.includes("message_templates"))
        return Response.json({
          data: [
            {
              name: "aviso_visita",
              status: "APPROVED",
              language: "pt_BR",
              components: [
                { type: "BODY", text: "{{1}} {{2}} {{3}} {{4}} {{5}}" },
              ],
            },
          ],
        });
      return Response.json({
        id: "1234567",
        display_phone_number: "+55 11 99999-9999",
      });
    }
    if (url.includes("graph.facebook.com"))
      return Response.json({ messages: [{ id: "wamid." + randomUUID() }] });
    if (url === "https://api.resend.com/emails") {
      if (emailFailure) {
        const status = emailFailure;
        emailFailure = 0;
        return new Response(null, { status });
      }
      const id = randomUUID();
      if (receiptBeforeAccept && key.startsWith("imobview-visit-"))
        await recordReceipt(org, "EMAIL", id, "DELIVERED", new Date());
      return Response.json({ id });
    }
    throw new Error("Unexpected external request");
  },
);
beforeAll(async () => {
  vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", "7".repeat(64));
  vi.stubGlobal("fetch", fetcher);
  await db.user.createMany({
    data: [owner, memberId, viewerId].map((id) => ({
      id,
      name: "Pessoa de teste",
      email: id + "@example.test",
    })),
  });
  for (const id of [org, otherOrg])
    await db.organization.create({
      data: {
        id,
        slug: id,
        name: "Agência de integração",
        contactEmail: "equipe@example.test",
        whatsapp: "5511999999999",
        members: {
          create: [
            { userId: owner, role: "OWNER" },
            ...(id === org
              ? [
                  { userId: memberId, role: "MEMBER" as const },
                  { userId: viewerId, role: "VIEWER" as const },
                ]
              : []),
          ],
        },
      },
    });
  await saveIntegration(actor, "GOOGLE", settings, owner + "@example.test");
  for (const person of [actor, member])
    await withTenant(person, "lead:update", (tx) =>
      tx.calendarConnection.create({
        data: {
          ...person,
          secret: seal(
            { refreshToken: "refresh-test" },
            calendarContext(org, person.userId),
          ),
          accountEmail: person.userId + "@example.test",
          calendarId: "primary",
        },
      }),
    );
  await withTenant(actor, "lead:update", async (tx) => {
    const property = await tx.property.create({
      data: {
        organizationId: org,
        title: "Casa das visitas",
        slug: randomUUID(),
        priceCents: 50000000,
      },
    });
    propertyId = property.id;
    const lead = await tx.lead.create({
      data: {
        organizationId: org,
        propertyId,
        name: "Cliente das visitas",
        email: "cliente@example.test",
        phone: "11999999999",
      },
    });
    leadId = lead.id;
  });
});
afterEach(() => {
  emailFailure = 0;
  receiptBeforeAccept = false;
});
afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: [org, otherOrg] } } });
  await db.user.deleteMany({
    where: { id: { in: [owner, memberId, viewerId] } },
  });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("isolates secrets by organization and personal calendars by user, without serializing credentials", async () => {
  const config = await withTenant(actor, "lead:read", (tx) =>
    tx.organizationIntegration.findFirstOrThrow({
      where: { provider: "GOOGLE" },
    }),
  );
  expect(config.secret).not.toContain(settings.clientSecret);
  expect(JSON.stringify(await integrationOverview(actor))).not.toContain(
    config.secret,
  );
  expect((await integrationOverview(other)).settings).toEqual([]);
  expect(
    await withTenant(member, "lead:read", (tx) =>
      tx.calendarConnection.findMany({ where: { userId: owner } }),
    ),
  ).toEqual([]);
  await expect(integrationOverview(viewer)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    saveIntegration(member, "GOOGLE", settings, "member@example.test"),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    withTenant(member, "lead:update", (tx) =>
      tx.organizationIntegration.create({
        data: {
          organizationId: otherOrg,
          provider: "GOOGLE",
          secret: "forged",
        },
      }),
    ),
  ).rejects.toThrow();
});
it("stores the exact instant in UTC even when the database host uses São Paulo time", async () => {
  const visit = await scheduleVisit(actor, schedule, undefined, leadId);
  visitId = visit.id;
  expect(visit.scheduledStartAt?.toISOString()).toBe(date + "T13:30:00.000Z");
  expect(visit.scheduledEndAt?.toISOString()).toBe(date + "T14:30:00.000Z");
  const jobs = await withTenant(actor, "lead:read", (tx) =>
    tx.integrationDelivery.findMany({ where: { requestId: visitId } }),
  );
  expect(jobs.map((j) => j.channel)).toEqual(["CALENDAR"]);
  await expect(scheduleVisit(other, schedule, visitId)).rejects.toThrow();
  expect((await deliverIntegrations(otherOrg)).processed).toBe(0);
});
it("creates and updates one Google event, then cancels it without duplicate calendar entries", async () => {
  expect((await deliverIntegrations(org)).failed).toBe(0);
  expect(events.size).toBe(1);
  await scheduleVisit(
    actor,
    { ...schedule, localStart: date + "T11:30" },
    visitId,
  );
  expect((await deliverIntegrations(org)).failed).toBe(0);
  expect(events.size).toBe(1);
  expect(calls.some((c) => c.method === "PATCH")).toBe(true);
  await withTenant(actor, "lead:update", (tx) =>
    tx.calendarConnection.update({
      where: { organizationId_userId: actor },
      data: { calendarId: "secondary" },
    }),
  );
  await scheduleVisit(
    actor,
    { ...schedule, localStart: date + "T11:35" },
    visitId,
  );
  await withTenant(actor, "lead:update", (tx) =>
    tx.calendarConnection.update({
      where: { organizationId_userId: actor },
      data: { calendarId: "third" },
    }),
  );
  await scheduleVisit(
    actor,
    { ...schedule, localStart: date + "T11:40" },
    visitId,
  );
  expect((await deliverIntegrations(org)).failed).toBe(0);
  expect(events.size).toBe(1);
  expect([...events][0].startsWith("third:")).toBe(true);
  const second = await withTenant(actor, "lead:update", (tx) =>
    tx.lead.create({
      data: {
        organizationId: org,
        name: "Outro cliente",
        email: "outro@example.test",
        phone: "11999999999",
      },
    }),
  );
  await expect(
    scheduleVisit(
      actor,
      { ...schedule, localStart: date + "T11:45" },
      undefined,
      second.id,
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await updateRequest(actor, visitId, "CANCELLED");
  expect((await deliverIntegrations(org)).failed).toBe(0);
  expect(events.size).toBe(0);
  await withTenant(actor, "lead:update", (tx) =>
    tx.calendarConnection.update({
      where: { organizationId_userId: actor },
      data: { calendarId: "primary" },
    }),
  );
});
it("validates tenant WhatsApp and Resend settings and uses each tenant's provider credentials", async () => {
  await saveIntegration(
    actor,
    "WHATSAPP",
    {
      accessToken: "tenant-token",
      appSecret: "b".repeat(32),
      phoneNumberId: "1234567",
      businessAccountId: "7654321",
      apiVersion: "v25.0",
      template: "aviso_visita",
      language: "pt_BR",
    },
    owner + "@example.test",
  );
  await saveIntegration(
    actor,
    "EMAIL",
    {
      apiKey: "private-resend-key",
      fromEmail: "visitas@example.test",
      fromName: "Agência",
      notifyTeam: true,
      notifyClient: true,
      webhookSecret: "",
    },
    owner + "@example.test",
  );
  const newLead = await withTenant(actor, "lead:update", (tx) =>
    tx.lead.create({
      data: {
        organizationId: org,
        propertyId,
        name: "Novo cliente",
        email: "novo@example.test",
        phone: "11999999999",
      },
    }),
  );
  const visit = await scheduleVisit(
    actor,
    { ...schedule, localStart: date + "T15:00" },
    undefined,
    newLead.id,
  );
  const jobs = await withTenant(actor, "lead:read", (tx) =>
    tx.integrationDelivery.findMany({ where: { requestId: visit.id } }),
  );
  expect(jobs.map((j) => j.channel).sort()).toEqual([
    "CALENDAR",
    "EMAIL_CLIENT",
    "EMAIL_TEAM",
    "WHATSAPP",
  ]);
  expect(
    await withTenant(actor, "lead:read", (tx) =>
      tx.whatsAppDelivery.count({ where: { requestId: visit.id } }),
    ),
  ).toBe(0);
  receiptBeforeAccept = true;
  expect((await deliverIntegrations(org, visit.id)).failed).toBe(0);
  const done = await withTenant(actor, "lead:read", (tx) =>
    tx.integrationDelivery.findMany({ where: { requestId: visit.id } }),
  );
  expect(
    done
      .filter((j) => j.channel.startsWith("EMAIL"))
      .every((j) => j.state === "DELIVERED"),
  ).toBe(true);
  const wa = done.find((j) => j.channel === "WHATSAPP")!;
  expect(wa.state).toBe("ACCEPTED");
  await recordReceipt(org, "WHATSAPP", wa.providerId!, "DELIVERED", new Date());
  await recordReceipt(
    org,
    "WHATSAPP",
    wa.providerId!,
    "FAILED",
    new Date(Date.now() - 60000),
  );
  expect(
    (
      await withTenant(actor, "lead:read", (tx) =>
        tx.integrationDelivery.findUniqueOrThrow({ where: { id: wa.id } }),
      )
    ).state,
  ).toBe("DELIVERED");
  expect(JSON.stringify(await integrationOverview(actor))).not.toContain(
    "private-resend-key",
  );
});
it("queues a transient provider failure and retries it without changing the appointment", async () => {
  const lead = await withTenant(actor, "lead:update", (tx) =>
    tx.lead.create({
      data: {
        organizationId: org,
        name: "Cliente retry",
        email: "retry@example.test",
        phone: "11999999999",
      },
    }),
  );
  const visit = await scheduleVisit(
    actor,
    { ...schedule, localStart: date + "T18:00", syncCalendar: false },
    undefined,
    lead.id,
  );
  emailFailure = 429;
  expect((await deliverIntegrations(org, visit.id)).failed).toBe(1);
  expect(
    await withTenant(actor, "lead:read", (tx) =>
      tx.integrationDelivery.count({
        where: { requestId: visit.id, state: "PENDING" },
      }),
    ),
  ).toBe(1);
  await retryIntegrations(actor);
  expect((await deliverIntegrations(org, visit.id)).failed).toBe(0);
  expect(
    await withTenant(actor, "lead:read", (tx) =>
      tx.integrationDelivery.count({
        where: { requestId: visit.id, state: "PENDING" },
      }),
    ),
  ).toBe(0);
});
it("does not resend messages after a sender crashes with an unknown delivery result", async () => {
  const lead = await withTenant(actor, "lead:update", (tx) =>
    tx.lead.create({
      data: {
        organizationId: org,
        name: "Cliente recuperação",
        email: "recovery@example.test",
        phone: "11999999999",
      },
    }),
  );
  const visit = await scheduleVisit(
    actor,
    { ...schedule, localStart: date + "T19:00", syncCalendar: false },
    undefined,
    lead.id,
  );
  const claimed = await db.$queryRaw<
    { id: string }[]
  >`SELECT * FROM public.claim_integration_deliveries(${org}::uuid,${visit.id}::uuid)`;
  expect(claimed.length).toBe(3);
  await withTenant(actor, "organization:manage", (tx) =>
    tx.integrationDelivery.updateMany({
      where: { requestId: visit.id },
      data: { availableAt: new Date(Date.now() - 1000) },
    }),
  );
  const count = calls.length;
  expect((await deliverIntegrations(org, visit.id)).processed).toBe(0);
  expect(calls.length).toBe(count);
  const results = await withTenant(actor, "lead:read", (tx) =>
    tx.integrationDelivery.findMany({ where: { requestId: visit.id } }),
  );
  expect(
    results.every(
      (job) => job.state === "FAILED" && job.lastError === "DELIVERY_UNKNOWN",
    ),
  ).toBe(true);
});
it("retains a calendar cancellation task when personal lead data is deleted", async () => {
  const active = await withTenant(actor, "lead:update", (tx) =>
    tx.lead.create({
      data: {
        organizationId: org,
        propertyId,
        name: "Cliente exclusão",
        email: "exclusao@example.test",
        phone: "11999999999",
      },
    }),
  );
  const visit = await scheduleVisit(
    actor,
    { ...schedule, localStart: date + "T20:00" },
    undefined,
    active.id,
  );
  await deliverIntegrations(org, visit.id);
  const before = events.size;
  await deleteLead(actor, active.id);
  expect((await deliverIntegrations(org, visit.id)).failed).toBe(0);
  expect(events.size).toBe(before - 1);
  expect(
    await withTenant(actor, "lead:read", (tx) =>
      tx.lead.count({ where: { id: active.id } }),
    ),
  ).toBe(0);
});
it("invalidates every personal authorization after the agency changes its Google app credentials", async () => {
  await saveIntegration(
    actor,
    "GOOGLE",
    { ...settings, clientSecret: "changed-client-secret" },
    owner + "@example.test",
  );
  for (const person of [actor, member])
    expect((await integrationOverview(person)).calendar?.connected).toBe(false);
  await disableIntegration(actor, "EMAIL");
  expect(
    (await integrationOverview(actor)).settings.find(
      (s) => s.provider === "EMAIL",
    )?.enabled,
  ).toBe(false);
  expect(credentialContext(org, "EMAIL")).not.toBe(
    credentialContext(otherOrg, "EMAIL"),
  );
});
