import { timingSafeEqual } from "node:crypto";
import { deliverWhatsApp } from "@/features/notifications/whatsapp";
import { reportError } from "@/server/logger";
import { deliverIntegrations } from "@/features/integrations/delivery";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    secret.length < 32 ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    return new Response(null, { status: 401 });
  try {
    const results = await Promise.allSettled([
      deliverWhatsApp(),
      deliverIntegrations(),
    ]);
    if (results[0].status === "rejected") throw results[0].reason;
    if (results[1].status === "rejected") throw results[1].reason;
    const legacy = results[0].value,
      integrations = results[1].value;
    return Response.json(
      { ...legacy, integrations },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    await reportError("notifications.dispatch.failed", error);
    return Response.json(
      { error: "Falha ao processar avisos." },
      { status: 500 },
    );
  }
}
