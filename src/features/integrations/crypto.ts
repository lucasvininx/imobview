import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function integrationsReady() {
  return /^[a-f0-9]{64}$/i.test(process.env.INTEGRATIONS_ENCRYPTION_KEY ?? "");
}
function key() {
  if (!integrationsReady())
    throw new Error("IntegrationsEncryptionUnavailable");
  return Buffer.from(process.env.INTEGRATIONS_ENCRYPTION_KEY!, "hex");
}
export function seal(value: unknown, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function unseal<T>(value: string, context: string): T {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data)
    throw new Error("InvalidIntegrationSecret");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      cipher.update(Buffer.from(data, "base64url")),
      cipher.final(),
    ]).toString(),
  );
}
