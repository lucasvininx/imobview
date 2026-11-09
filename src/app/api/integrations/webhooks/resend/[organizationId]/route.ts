import { z } from "zod";
import {
  rawWebhook,
  recordReceipt,
  verifyResend,
  webhookCredentials,
  webhookFailure,
} from "@/features/integrations/webhooks";
import type { EmailSettings } from "@/features/integrations/schema";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const settings = await webhookCredentials<EmailSettings>(
      organizationId,
      "EMAIL",
    );
    const body = await rawWebhook(request);
    if (
      !settings?.webhookSecret ||
      !verifyResend(body, request.headers, settings.webhookSecret)
    )
      return new Response(null, { status: 403 });
    const event = z
      .object({
        type: z.string(),
        created_at: z.string(),
        data: z.object({ email_id: z.string().max(1024) }),
      })
      .parse(JSON.parse(body));
    if (
      [
        "email.delivered",
        "email.bounced",
        "email.failed",
        "email.complained",
      ].includes(event.type)
    )
      await recordReceipt(
        organizationId,
        "EMAIL",
        event.data.email_id,
        event.type === "email.delivered" ? "DELIVERED" : "FAILED",
        new Date(event.created_at),
      );
    return Response.json({ received: true });
  } catch (error) {
    return webhookFailure(error);
  }
}
