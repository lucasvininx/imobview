"use server";
import { headers } from "next/headers";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { readEnv } from "@/config/env";
import { contactSchema } from "@/features/leads/schema";
const schema = contactSchema.extend({
  slug: z.string().regex(/^[a-z0-9-]{1,220}$/),
  website: z.string().max(0).default(""),
});
export async function registerInterestAction(input: unknown) {
  const data = schema.safeParse(input);
  if (!data.success)
    return {
      success: false as const,
      error: "Preencha nome, e-mail, celular e autorize o contato.",
    };
  const h = await headers();
  const address = process.env.VERCEL
    ? (h.get("x-vercel-forwarded-for") ?? "unknown")
    : "local";
  const abuseKey = createHmac("sha256", readEnv().BETTER_AUTH_SECRET)
    .update(`marketplace:${address}`)
    .digest("hex");
  try {
    const [row] = await db.$queryRaw<
      { ok: boolean }[]
    >`SELECT public.register_marketplace_interest(${JSON.stringify(data.data)}::jsonb,${abuseKey}) AS ok`;
    return row.ok
      ? { success: true as const }
      : {
          success: false as const,
          error:
            "Não foi possível enviar agora. Aguarde e tente novamente ou use o contato da imobiliária.",
        };
  } catch {
    return {
      success: false as const,
      error: "Não foi possível enviar agora. Tente novamente em instantes.",
    };
  }
}
