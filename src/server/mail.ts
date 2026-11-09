import "server-only";
import nodemailer from "nodemailer";
import { readEnv } from "@/config/env";

export function createMailTransport() {
  const env = readEnv();
  if (env.SMTP_ENABLED !== "true") return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: !["localhost", "127.0.0.1", "mailpit"].includes(
      env.SMTP_HOST ?? "",
    ),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    ...(env.SMTP_USER
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
  });
}
