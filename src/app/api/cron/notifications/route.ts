import { timingSafeEqual } from "node:crypto";
import { deliverWhatsApp } from "@/features/notifications/whatsapp";
import { reportError } from "@/server/logger";
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
    return Response.json(await deliverWhatsApp(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    await reportError("notifications.dispatch.failed", error);
    return Response.json(
      { error: "Falha ao processar avisos." },
      { status: 500 },
    );
  }
}
