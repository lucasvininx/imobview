import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import nodemailer from "nodemailer";
import { db } from "@/server/db";
import { readEnv } from "@/config/env";
import { logError } from "@/server/logger";

const env = readEnv();
const mail = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  ...(env.SMTP_USER
    ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
    : {}),
});

export const auth = betterAuth({
  appName: "ImobView",
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  logger: { disabled: true },
  onAPIError: { onError: (error) => logError("auth.request.failed", error) },
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await mail.sendMail({
        from: env.SMTP_FROM,
        to: user.email,
        subject: "Redefina sua senha — ImobView°",
        text: `Para redefinir sua senha, acesse: ${url}\nSe você não solicitou a alteração, ignore este e-mail.`,
      });
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  advanced: { database: { generateId: "uuid" } },
  plugins: [nextCookies()],
});
