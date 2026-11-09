import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { logError } from "@/server/logger";
import { unseal, integrationsReady } from "./crypto";
import { calendarContext, credentialContext } from "./service";
import type { GoogleSettings, EmailSettings, WhatsAppSettings } from "./schema";
import {
  deleteGoogleEvent,
  googleAccess,
  ProviderError,
  putGoogleEvent,
  sendEmail,
  sendWhatsApp,
} from "./providers";

const connection = z
  .object({ userId: z.string(), secret: z.string(), connected: z.boolean() })
  .nullable();
const jobSchema = z.object({
  organizationId: z.uuid(),
  requestId: z.uuid(),
  channel: z.enum(["CALENDAR", "EMAIL_TEAM", "EMAIL_CLIENT", "WHATSAPP"]),
  revision: z.number(),
  payload: z.object({
    operation: z.string(),
    kind: z.string(),
    userId: z.string().nullable(),
    calendarId: z.string(),
    previousUserId: z.string().nullable(),
    previousCalendarId: z.string().nullable(),
  }),
  request: z
    .object({
      leadId: z.uuid(),
      status: z.string(),
      scheduledStartAt: z.string().nullable(),
      scheduledEndAt: z.string().nullable(),
      timeZone: z.string(),
      preferredDate: z.string(),
      period: z.string(),
    })
    .nullable(),
  lead: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  property: z.object({
    title: z.string().nullable(),
    slug: z.string().nullable(),
    address: z.string().nullable(),
    city: z.string().nullable(),
  }),
  organization: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    whatsappAlerts: z.boolean(),
  }),
  broker: z.object({
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  integration: z
    .object({ secret: z.string(), enabled: z.boolean() })
    .nullable(),
  calendar: connection,
  previousCalendar: connection,
  bindings: z.array(
    z.object({
      userId: z.string(),
      calendarId: z.string(),
      secret: z.string().nullable(),
      connected: z.boolean().nullable(),
    }),
  ),
});
type Job = z.infer<typeof jobSchema>;
type Outcome = {
  state: "SUCCEEDED" | "ACCEPTED" | "SKIPPED" | "PENDING" | "FAILED";
  providerId?: string;
  url?: string;
  error?: string;
};
const kinds: Record<string, string> = {
  REQUESTED: "Nova solicitação de visita",
  CONFIRMED: "Visita confirmada",
  RESCHEDULED: "Visita reagendada",
  CANCELLED: "Visita cancelada",
};
export function appointmentTime(request: NonNullable<Job["request"]>) {
  if (request.scheduledStartAt && request.scheduledEndAt) {
    const options = {
      timeZone: request.timeZone,
      hour: "2-digit",
      minute: "2-digit",
    } as const;
    return `${new Date(request.scheduledStartAt).toLocaleTimeString("pt-BR", options)}–${new Date(request.scheduledEndAt).toLocaleTimeString("pt-BR", options)} (${request.timeZone})`;
  }
  return (
    (
      { MORNING: "Manhã", AFTERNOON: "Tarde", EVENING: "Noite" } as Record<
        string,
        string
      >
    )[request.period] ?? request.period
  );
}
async function perform(id: string, job: Job, lease: string): Promise<Outcome> {
  if (!job.integration?.enabled)
    return { state: "SKIPPED", error: "DISCONNECTED" };
  const org = job.organizationId;
  if (job.channel === "CALENDAR") {
    const settings = unseal<GoogleSettings>(
      job.integration.secret,
      credentialContext(org, "GOOGLE"),
    );
    const eventId = job.requestId.replaceAll("-", "");
    const access = async (calendar: NonNullable<Job["calendar"]>) => {
      if (!calendar.connected || !calendar.secret)
        throw new ProviderError("GOOGLE_RECONNECT");
      const saved = unseal<{ refreshToken: string }>(
        calendar.secret,
        calendarContext(org, calendar.userId),
      );
      return googleAccess(settings, saved.refreshToken);
    };
    const p = job.payload;
    const removeAll =
      p.operation === "DELETE" ||
      !job.request ||
      job.request.status !== "CONFIRMED" ||
      !p.userId;
    for (const binding of job.bindings) {
      if (
        !removeAll &&
        binding.userId === p.userId &&
        binding.calendarId === p.calendarId
      )
        continue;
      if (binding.connected && binding.secret)
        await deleteGoogleEvent(
          await access({ ...binding, secret: binding.secret, connected: true }),
          binding.calendarId,
          eventId,
        );
      await db.$executeRaw`SELECT public.clear_calendar_binding(${id}::uuid,${lease}::uuid,${binding.userId},${binding.calendarId})`;
    }
    if (
      p.operation === "DELETE" ||
      !job.request ||
      job.request.status !== "CONFIRMED" ||
      !p.userId
    )
      return { state: "SUCCEEDED", url: "" };
    if (
      !job.calendar?.connected ||
      !job.request.scheduledStartAt ||
      !job.request.scheduledEndAt
    )
      throw new ProviderError("GOOGLE_RECONNECT");
    const event = await putGoogleEvent(
      await access(job.calendar),
      p.calendarId,
      eventId,
      {
        summary: `Visita — ${job.property.title ?? "Imóvel"}`,
        description: `Visita organizada por ${job.organization.name}.\nAtendimento: ${process.env.NEXT_PUBLIC_APP_URL}/app/leads/${job.request.leadId}`,
        location: [job.property.address, job.property.city]
          .filter(Boolean)
          .join(", "),
        start: {
          dateTime: job.request.scheduledStartAt,
          timeZone: job.request.timeZone,
        },
        end: {
          dateTime: job.request.scheduledEndAt,
          timeZone: job.request.timeZone,
        },
      },
    );
    return { state: "SUCCEEDED", ...event };
  }
  if (!job.request) return { state: "SKIPPED", error: "SOURCE_REMOVED" };
  const title = kinds[job.payload.kind] ?? "Atualização de visita";
  const date = job.request.preferredDate.split("-").reverse().join("/");
  const when = appointmentTime(job.request);
  if (job.channel === "WHATSAPP") {
    if (!job.organization.whatsappAlerts)
      return { state: "SKIPPED", error: "DISCONNECTED" };
    const settings = unseal<WhatsAppSettings>(
      job.integration.secret,
      credentialContext(org, "WHATSAPP"),
    );
    let phone = (job.broker.phone || job.organization.phone).replace(/\D/g, "");
    if (phone.length === 10 || phone.length === 11) phone = "55" + phone;
    if (!/^[1-9]\d{10,14}$/.test(phone))
      return { state: "SKIPPED", error: "NO_RECIPIENT" };
    return {
      state: "ACCEPTED",
      providerId: await sendWhatsApp(settings, phone, [
        title,
        job.lead.name ?? "Cliente",
        job.property.title ?? "Imóvel a definir",
        date,
        when,
      ]),
    };
  }
  const settings = unseal<EmailSettings>(
    job.integration.secret,
    credentialContext(org, "EMAIL"),
  );
  if (
    (job.channel === "EMAIL_CLIENT" && !settings.notifyClient) ||
    (job.channel === "EMAIL_TEAM" && !settings.notifyTeam)
  )
    return { state: "SKIPPED", error: "DISCONNECTED" };
  const to =
    job.channel === "EMAIL_CLIENT"
      ? job.lead.email
      : job.broker.email || job.organization.email;
  if (!to || !z.email().safeParse(to).success)
    return { state: "SKIPPED", error: "NO_RECIPIENT" };
  const text = `${title}\n\nCliente: ${job.lead.name ?? "Cliente"}\nImóvel: ${job.property.title ?? "A definir"}\nData: ${date}\nHorário: ${when}\n\n${job.organization.name}\n${job.channel === "EMAIL_CLIENT" ? "Em caso de dúvidas, fale com a imobiliária." : `Atendimento: ${process.env.NEXT_PUBLIC_APP_URL}/app/leads/${job.request.leadId}`}`;
  return {
    state: "ACCEPTED",
    providerId: await sendEmail(
      settings,
      to,
      `${title} — ${job.organization.name}`,
      text,
      `imobview-visit-${id}`,
    ),
  };
}
export async function deliverIntegrations(
  organizationId: string | null = null,
  requestId: string | null = null,
) {
  if (!integrationsReady())
    return { processed: 0, failed: 0, configured: false };
  let processed = 0,
    failed = 0;
  for (let round = 0; round < 2; round++) {
    const jobs = await db.$queryRaw<
      { id: string; lease: string; data: unknown }[]
    >`SELECT * FROM public.claim_integration_deliveries(${organizationId}::uuid,${requestId}::uuid)`;
    if (!jobs.length) break;
    // Sequential bounded dispatch avoids rate bursts and keeps retry ordering predictable.
    for (const row of jobs) {
      let outcome: Outcome;
      try {
        outcome = await perform(row.id, jobSchema.parse(row.data), row.lease);
      } catch (error) {
        const channel = jobSchema.safeParse(row.data).data?.channel;
        const provider = error instanceof ProviderError ? error : null;
        const uncertain =
          provider?.code === "PROVIDER_UNAVAILABLE" && channel !== "CALENDAR";
        outcome = {
          state: provider?.retryable && !uncertain ? "PENDING" : "FAILED",
          error: uncertain
            ? "DELIVERY_UNKNOWN"
            : (provider?.code ?? "INVALID_CONFIGURATION"),
        };
        failed++;
        logError("integration.dispatch.failed", new Error(outcome.error));
      }
      await db.$executeRaw`SELECT public.finish_integration_delivery(${row.id}::uuid,${row.lease}::uuid,${JSON.stringify(outcome)}::jsonb)`;
      processed++;
    }
  }
  return { processed, failed, configured: true };
}
