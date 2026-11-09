"use server";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { readEnv } from "@/config/env";
import { businessContact } from "@/config/business";
import { createMailTransport } from "@/server/mail";
import { logError } from "@/server/logger";
import { businessMessageSchema } from "./schema";

export async function sendBusinessMessage(input: unknown) {
  const parsed = businessMessageSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false as const,
      error:
        "Confira seu nome, e-mail e uma mensagem de 20 a 4.000 caracteres. Autorize o contato para continuar.",
    };
  const destination = businessContact().email;
  const mail = createMailTransport();
  if (!destination || !mail)
    return {
      success: false as const,
      error:
        "Não foi possível enviar sua mensagem. Tente novamente em instantes.",
    };
  try {
    const h = await headers();
    const address = process.env.VERCEL
      ? (h.get("x-vercel-forwarded-for") ?? "unknown")
      : "local";
    const key =
      "business-contact:" +
      createHmac("sha256", readEnv().BETTER_AUTH_SECRET)
        .update(address)
        .digest("hex");
    // Atomic limit shared across instances; never store the visitor's IP.
    const [limit] = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" (id,key,count,"lastRequest")
      VALUES (gen_random_uuid()::text,${key},1,(extract(epoch from now())*1000)::bigint)
      ON CONFLICT (key) DO UPDATE SET
        count=CASE WHEN "RateLimit"."lastRequest"<(extract(epoch from now())*1000)::bigint-3600000 THEN 1 ELSE "RateLimit".count+1 END,
        "lastRequest"=CASE WHEN "RateLimit"."lastRequest"<(extract(epoch from now())*1000)::bigint-3600000 THEN (extract(epoch from now())*1000)::bigint ELSE "RateLimit"."lastRequest" END
      RETURNING count`;
    if (limit.count > 3)
      return {
        success: false as const,
        error:
          "Você já enviou algumas mensagens. Aguarde uma hora para tentar novamente.",
      };
    const { name, email, message } = parsed.data;
    const result = await mail.sendMail({
      from: readEnv().SMTP_FROM,
      to: destination,
      replyTo: { name, address: email },
      subject: "Novo contato pelo site — ImobView",
      text: `Nome: ${name}\nE-mail: ${email}\n\n${message}`,
    });
    if (!result.accepted?.length) throw new Error("ContactEmailNotAccepted");
    return { success: true as const };
  } catch (error) {
    logError("business.contact.failed", error);
    return {
      success: false as const,
      error:
        "Não foi possível enviar sua mensagem. Tente novamente em instantes.",
    };
  }
}
