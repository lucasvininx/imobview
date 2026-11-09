import { z } from "zod";
import {
  equalSignature,
  rawWebhook,
  recordReceipt,
  verifyMeta,
  webhookCredentials,
  webhookFailure,
} from "@/features/integrations/webhooks";
import type { WhatsAppSettings } from "@/features/integrations/schema";
type Context = { params: Promise<{ organizationId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const settings = await webhookCredentials<WhatsAppSettings>(
      organizationId,
      "WHATSAPP",
    );
    const params = new URL(request.url).searchParams;
    if (
      !settings ||
      params.get("hub.mode") !== "subscribe" ||
      !equalSignature(
        params.get("hub.verify_token") ?? "",
        settings.verifyToken,
      )
    )
      return new Response(null, { status: 403 });
    const challenge = params.get("hub.challenge") ?? "";
    if (!/^\d{1,100}$/.test(challenge))
      return new Response(null, { status: 400 });
    return new Response(challenge, {
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return webhookFailure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const settings = await webhookCredentials<WhatsAppSettings>(
      organizationId,
      "WHATSAPP",
    );
    const body = await rawWebhook(request);
    if (
      !settings ||
      !verifyMeta(
        body,
        request.headers.get("x-hub-signature-256") ?? "",
        settings.appSecret,
      )
    )
      return new Response(null, { status: 403 });
    const data = z
      .object({
        entry: z.array(
          z.object({
            id: z.string(),
            changes: z.array(
              z.object({
                value: z.object({
                  metadata: z
                    .object({ phone_number_id: z.string() })
                    .optional(),
                  statuses: z
                    .array(
                      z.object({
                        id: z.string().max(1024),
                        status: z.string(),
                        timestamp: z.string(),
                      }),
                    )
                    .optional(),
                }),
              }),
            ),
          }),
        ),
      })
      .parse(JSON.parse(body));
    for (const entry of data.entry)
      if (entry.id === settings.businessAccountId)
        for (const change of entry.changes)
          if (change.value.metadata?.phone_number_id === settings.phoneNumberId)
            for (const status of change.value.statuses ?? [])
              if (["delivered", "read", "failed"].includes(status.status))
                await recordReceipt(
                  organizationId,
                  "WHATSAPP",
                  status.id,
                  status.status === "failed" ? "FAILED" : "DELIVERED",
                  new Date(Number(status.timestamp) * 1000),
                );
    return Response.json({ received: true });
  } catch (error) {
    return webhookFailure(error);
  }
}
