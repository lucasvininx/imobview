import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { logError } from "@/server/logger";
import { unseal } from "./crypto";
import { credentialContext } from "./service";

class WebhookInputError extends Error {}

export function webhookFailure(error: unknown) {
  if (
    error instanceof z.ZodError ||
    error instanceof SyntaxError ||
    error instanceof WebhookInputError
  )
    return new Response(null, { status: 400 });
  logError("integration.webhook.failed", new Error("WEBHOOK_UNAVAILABLE"));
  return new Response(null, { status: 503, headers: { "Retry-After": "60" } });
}

export function equalSignature(actual: string, expected: string) {
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function verifyMeta(body: string, signature: string, secret: string) {
  return equalSignature(
    signature,
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
  );
}
export function verifyResend(
  body: string,
  headers: Headers,
  secret: string,
  now = Date.now(),
) {
  const stamp = headers.get("svix-timestamp") ?? "",
    id = headers.get("svix-id") ?? "";
  if (
    !id ||
    !/^\d+$/.test(stamp) ||
    Math.abs(now / 1000 - Number(stamp)) > 300 ||
    !secret.startsWith("whsec_")
  )
    return false;
  const expected = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
    .update(`${id}.${stamp}.${body}`)
    .digest("base64");
  return (headers.get("svix-signature") ?? "")
    .split(" ")
    .some(
      (value) =>
        value.startsWith("v1,") && equalSignature(value.slice(3), expected),
    );
}
export async function webhookCredentials<T>(
  org: string,
  provider: "WHATSAPP" | "EMAIL",
) {
  z.uuid().parse(org);
  const [row] = await db.$queryRaw<
    { secret: string | null }[]
  >`SELECT public.integration_webhook_secret(${org}::uuid,${provider}) AS secret`;
  return row?.secret
    ? unseal<T>(row.secret, credentialContext(org, provider))
    : null;
}
export async function rawWebhook(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new WebhookInputError("EmptyWebhook");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.length;
    if (size > 65536) {
      await reader.cancel();
      throw new WebhookInputError("WebhookTooLarge");
    }
    chunks.push(item.value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function recordReceipt(
  org: string,
  provider: string,
  id: string,
  state: string,
  when: Date,
) {
  if (!Number.isFinite(when.getTime()) || when.getTime() > Date.now() + 300000)
    return;
  await db.$executeRaw`SELECT public.integration_receipt(${org}::uuid,${provider},${id},${state},${when})`;
}
