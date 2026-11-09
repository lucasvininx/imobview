import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { withTenant, type Actor } from "@/server/tenant";
import { DomainError } from "@/domain/errors";
import { seal, unseal } from "./crypto";
import {
  emailSettings,
  googleSettings,
  providerSchema,
  scheduleSchema,
  whatsappSettings,
  type GoogleSettings,
  type EmailSettings,
  type WhatsAppSettings,
} from "./schema";
import {
  googleAccess,
  googleCalendars,
  sendEmail,
  validateWhatsApp,
} from "./providers";

export const credentialContext = (org: string, provider: string) =>
  `integration:${org}:${provider}`;
export const calendarContext = (org: string, user: string) =>
  `calendar:${org}:${user}`;

export async function integrationOverview(actor: Actor) {
  return withTenant(actor, "lead:read", async (tx) => {
    const settings = await tx.organizationIntegration.findMany({
      where: { organizationId: actor.organizationId },
      select: { provider: true, config: true, enabled: true, verifiedAt: true },
    });
    const calendar = await tx.calendarConnection.findUnique({
      where: { organizationId_userId: actor },
      select: {
        connected: true,
        accountEmail: true,
        calendarId: true,
        calendarName: true,
      },
    });
    const deliveries = await tx.integrationDelivery.findMany({
      where: { organizationId: actor.organizationId },
      select: {
        id: true,
        channel: true,
        state: true,
        lastError: true,
        createdAt: true,
        attempts: true,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return { settings, calendar, deliveries };
  });
}
export async function getSettings<T>(
  actor: Actor,
  provider: "GOOGLE" | "WHATSAPP" | "EMAIL",
  manage = false,
) {
  const row = await withTenant(
    actor,
    manage ? "organization:manage" : "lead:update",
    (tx) =>
      tx.organizationIntegration.findUnique({
        where: {
          organizationId_provider: {
            organizationId: actor.organizationId,
            provider,
          },
        },
      }),
  );
  return row
    ? {
        ...row,
        credentials: unseal<T>(
          row.secret,
          credentialContext(actor.organizationId, provider),
        ),
      }
    : null;
}
export async function saveIntegration(
  actor: Actor,
  providerInput: unknown,
  input: unknown,
  testEmail: string,
) {
  const provider = providerSchema.parse(providerInput);
  const data = z.record(z.string(), z.unknown()).parse(input);
  const previous = await getSettings<Record<string, unknown>>(
    actor,
    provider,
    true,
  );
  const merged = { ...data };
  for (const key of [
    "accessToken",
    "appSecret",
    "clientSecret",
    "apiKey",
    "webhookSecret",
  ])
    if (!merged[key] && previous?.credentials[key])
      merged[key] = previous.credentials[key];
  let credentials: GoogleSettings | EmailSettings | WhatsAppSettings;
  let config: Record<string, unknown>;
  let verified = false;
  let verifyToken: string | undefined;
  if (provider === "GOOGLE") {
    credentials = googleSettings.parse(merged);
    const previousConfig = (previous?.config ?? {}) as Record<string, unknown>;
    config = {
      clientId: credentials.clientId,
      credentialVersion:
        previous &&
        JSON.stringify(previous.credentials) === JSON.stringify(credentials)
          ? (previousConfig.credentialVersion ?? randomUUID())
          : randomUUID(),
    };
  } else if (provider === "WHATSAPP") {
    const parsed = whatsappSettings.parse(merged);
    const display = await validateWhatsApp(parsed);
    verifyToken =
      typeof previous?.credentials.verifyToken === "string"
        ? previous.credentials.verifyToken
        : randomBytes(24).toString("base64url");
    credentials = { ...parsed, verifyToken };
    config = {
      phoneNumberId: parsed.phoneNumberId,
      businessAccountId: parsed.businessAccountId,
      apiVersion: parsed.apiVersion,
      template: parsed.template,
      language: parsed.language,
      display,
    };
    verified = true;
  } else {
    credentials = emailSettings.parse(merged);
    await integrationTestBudget(actor, "EMAIL");
    config = {
      fromEmail: credentials.fromEmail,
      fromName: credentials.fromName,
      replyTo: credentials.replyTo,
      notifyTeam: credentials.notifyTeam,
      notifyClient: credentials.notifyClient,
      webhookConfigured: Boolean(credentials.webhookSecret),
    };
  }
  await withTenant(actor, "organization:manage", async (tx) => {
    await tx.organizationIntegration.upsert({
      where: {
        organizationId_provider: {
          organizationId: actor.organizationId,
          provider,
        },
      },
      create: {
        organizationId: actor.organizationId,
        provider,
        secret: seal(
          credentials,
          credentialContext(actor.organizationId, provider),
        ),
        config: config as never,
        enabled: provider !== "EMAIL",
        verifiedAt: verified ? new Date() : null,
      },
      update: {
        secret: seal(
          credentials,
          credentialContext(actor.organizationId, provider),
        ),
        config: config as never,
        enabled: provider !== "EMAIL",
        verifiedAt: verified ? new Date() : null,
      },
    });
    if (provider === "WHATSAPP")
      await tx.organization.update({
        where: { id: actor.organizationId },
        data: { whatsappVisitAlerts: true },
      });
  });
  if (provider === "EMAIL") {
    await sendEmail(
      credentials as EmailSettings,
      testEmail,
      "Teste de conexão — ImobView",
      "Sua integração de e-mail foi configurada. As notificações de visitas seguirão as opções escolhidas na ImobView.",
      `imobview-test-${randomUUID()}`,
    );
    await withTenant(actor, "organization:manage", (tx) =>
      tx.organizationIntegration.update({
        where: {
          organizationId_provider: {
            organizationId: actor.organizationId,
            provider,
          },
        },
        data: { enabled: true, verifiedAt: new Date() },
      }),
    );
  }
  return { verifyToken };
}

export async function integrationTestBudget(actor: Actor, provider: string) {
  const key =
    "integration-test:" +
    createHash("sha256")
      .update(`${actor.organizationId}:${actor.userId}:${provider}`)
      .digest("hex");
  const [row] = await withTenant(
    actor,
    "organization:manage",
    (tx) => tx.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" (id,key,count,"lastRequest") VALUES(gen_random_uuid()::text,${key},1,(extract(epoch from now())*1000)::bigint)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN "RateLimit"."lastRequest"<(extract(epoch from now())*1000)::bigint-3600000 THEN 1 ELSE "RateLimit".count+1 END,
    "lastRequest"=CASE WHEN "RateLimit"."lastRequest"<(extract(epoch from now())*1000)::bigint-3600000 THEN (extract(epoch from now())*1000)::bigint ELSE "RateLimit"."lastRequest" END RETURNING count`,
  );
  if (row.count > 5)
    throw new DomainError(
      "CONFLICT",
      "Limite de cinco testes por hora atingido. Aguarde para tentar novamente.",
    );
}
export function disableIntegration(actor: Actor, provider: unknown) {
  return withTenant(actor, "organization:manage", async (tx) => {
    const name = providerSchema.parse(provider);
    await tx.organizationIntegration.updateMany({
      where: { organizationId: actor.organizationId, provider: name },
      data: { enabled: false },
    });
    if (name === "WHATSAPP")
      await tx.organization.update({
        where: { id: actor.organizationId },
        data: { whatsappVisitAlerts: false },
      });
  });
}
export async function personalCalendar(actor: Actor) {
  return withTenant(actor, "lead:update", (tx) =>
    tx.calendarConnection.findUnique({
      where: { organizationId_userId: actor },
    }),
  );
}
export async function calendarsForUser(actor: Actor) {
  const [settings, connection] = await Promise.all([
    getSettings<GoogleSettings>(actor, "GOOGLE"),
    personalCalendar(actor),
  ]);
  if (!settings?.enabled || !connection?.connected)
    throw new DomainError("CONFLICT", "Conecte sua conta Google primeiro.");
  const token = unseal<{ refreshToken: string }>(
    connection.secret,
    calendarContext(actor.organizationId, actor.userId),
  );
  return googleCalendars(
    await googleAccess(settings.credentials, token.refreshToken),
  );
}
export async function selectCalendar(actor: Actor, id: unknown) {
  const calendarId = z.string().min(1).max(1024).parse(id);
  const calendars = await calendarsForUser(actor);
  const selected = calendars.find((calendar) => calendar.id === calendarId);
  if (!selected)
    throw new DomainError(
      "VALIDATION",
      "Escolha uma agenda que permita criar eventos.",
    );
  await withTenant(actor, "lead:update", (tx) =>
    tx.calendarConnection.update({
      where: { organizationId_userId: actor },
      data: { calendarId: selected.id, calendarName: selected.summary },
    }),
  );
}
export function disconnectCalendar(actor: Actor) {
  return withTenant(actor, "lead:update", (tx) =>
    tx.calendarConnection.updateMany({
      where: { organizationId: actor.organizationId, userId: actor.userId },
      data: { connected: false, secret: "" },
    }),
  );
}
export async function scheduleVisit(
  actor: Actor,
  input: unknown,
  requestId?: string,
  leadId?: string,
) {
  if (!requestId && !leadId)
    throw new DomainError("VALIDATION", "Escolha um cliente para agendar.");
  const data = scheduleSchema.parse(input);
  if (requestId) z.uuid().parse(requestId);
  if (leadId) z.uuid().parse(leadId);
  return withTenant(actor, "lead:update", async (tx) => {
    // Serialize bookings by organization; overlap checks and writes share this transaction.
    await tx.$executeRaw`SELECT id FROM "Organization" WHERE id=${actor.organizationId}::uuid FOR UPDATE`;
    const connection = await tx.calendarConnection.findUnique({
      where: { organizationId_userId: actor },
    });
    if (data.syncCalendar && !connection?.connected)
      throw new DomainError(
        "CONFLICT",
        "Conecte o Google Agenda antes de sincronizar.",
      );
    const current = requestId
      ? await tx.visitRequest.findFirst({
          where: { id: requestId, organizationId: actor.organizationId },
        })
      : null;
    if (requestId && !current)
      throw new DomainError("NOT_FOUND", "Visita não encontrada.");
    const lead = await tx.lead.findFirst({
      where: {
        id: current?.leadId ?? leadId,
        organizationId: actor.organizationId,
      },
    });
    if (!lead)
      throw new DomainError(
        "NOT_FOUND",
        "Escolha um cliente desta imobiliária.",
      );
    if (
      data.syncCalendar &&
      (await tx.visitRequest.findFirst({
        where: {
          organizationId: actor.organizationId,
          calendarUserId: actor.userId,
          status: "CONFIRMED",
          id: { not: requestId },
          scheduledStartAt: { lt: data.end },
          scheduledEndAt: { gt: data.start },
        },
      }))
    )
      throw new DomainError(
        "CONFLICT",
        "Você já tem uma visita confirmada nesse intervalo.",
      );
    const hour = Number(data.localStart.slice(11, 13));
    const update = {
      scheduledStartAt: data.start,
      scheduledEndAt: data.end,
      timeZone: data.timeZone,
      preferredDate: data.localStart.slice(0, 10),
      period: hour < 12 ? "MORNING" : hour < 18 ? "AFTERNOON" : "EVENING",
      status: "CONFIRMED",
      calendarUserId: data.syncCalendar ? actor.userId : null,
      calendarTargetId: data.syncCalendar ? connection!.calendarId : "",
    };
    const duplicate = await tx.visitRequest.findFirst({
      where: {
        organizationId: actor.organizationId,
        leadId: lead.id,
        preferredDate: update.preferredDate,
        period: update.period,
        id: { not: requestId },
      },
    });
    if (duplicate)
      throw new DomainError(
        "CONFLICT",
        "Este cliente já tem uma solicitação nesse período. Edite a visita existente.",
      );
    return current
      ? tx.visitRequest.update({ where: { id: current.id }, data: update })
      : tx.visitRequest.create({
          data: {
            ...update,
            organizationId: actor.organizationId,
            leadId: lead.id,
          },
        });
  });
}
export function retryIntegrations(actor: Actor) {
  return withTenant(actor, "organization:manage", (tx) =>
    tx.integrationDelivery.updateMany({
      where: {
        organizationId: actor.organizationId,
        state: { in: ["PENDING", "FAILED"] },
        lastError: {
          notIn: [
            "PROVIDER_DELIVERY_FAILED",
            "SOURCE_REMOVED",
            "DISCONNECTED",
            "DELIVERY_UNKNOWN",
          ],
        },
      },
      data: { state: "PENDING", attempts: 0, availableAt: new Date() },
    }),
  );
}
