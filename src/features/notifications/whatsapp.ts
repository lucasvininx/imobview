import "server-only";
import { db } from "@/server/db";
import { logError } from "@/server/logger";

export function whatsappConfigured() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    /^\d+$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID ?? "") &&
    /^v\d+\.\d+$/.test(process.env.WHATSAPP_API_VERSION ?? "") &&
    /^[a-z0-9_]+$/.test(process.env.WHATSAPP_VISIT_TEMPLATE ?? ""),
  );
}
export type WhatsAppJob = {
  id: string;
  lease: string;
  phone: string;
  kind: string;
  name: string;
  property: string;
  date: string;
  period: string;
};
export function visitMessage(job: WhatsAppJob) {
  const periods: Record<string, string> = {
    MORNING: "Manhã",
    AFTERNOON: "Tarde",
    EVENING: "Noite",
  };
  return {
    messaging_product: "whatsapp",
    to: job.phone,
    type: "template",
    template: {
      name: process.env.WHATSAPP_VISIT_TEMPLATE,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR" },
      components: [
        {
          type: "body",
          parameters: [
            job.kind === "VISIT_CONFIRMED"
              ? "Visita confirmada"
              : "Nova solicitação de visita",
            job.name,
            job.property,
            job.date.split("-").reverse().join("/"),
            periods[job.period] ?? job.period,
          ].map((text) => ({ type: "text", text })),
        },
      ],
    },
  };
}

export async function deliverWhatsApp(visitTokenHash: string | null = null) {
  if (!whatsappConfigured())
    return { configured: false, accepted: 0, failed: 0 };
  const jobs = await db.$queryRaw<
    WhatsAppJob[]
  >`SELECT * FROM public.claim_whatsapp_deliveries(${visitTokenHash})`;
  let accepted = 0,
    failed = 0;
  await Promise.all(
    jobs.map(async (job) => {
      let errorCode: string | null = null;
      try {
        const response = await fetch(
          `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(visitMessage(job)),
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !("messages" in body) ||
          !Array.isArray(body.messages) ||
          !body.messages[0]?.id
        )
          throw new Error("INVALID_RESPONSE");
        accepted++;
      } catch (error) {
        errorCode =
          error instanceof Error && /^HTTP_\d{3}$/.test(error.message)
            ? error.message
            : "PROVIDER_UNAVAILABLE";
        failed++;
        logError("whatsapp.delivery.failed", new Error(errorCode));
      }
      await db.$executeRaw`SELECT public.finish_whatsapp_delivery(${job.id}::uuid,${job.lease}::uuid,${errorCode})`;
    }),
  );
  return { configured: true, accepted, failed };
}
