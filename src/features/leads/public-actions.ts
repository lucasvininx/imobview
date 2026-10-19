"use server";
import { headers } from "next/headers";
import { createHmac } from "node:crypto";
import { readEnv } from "@/config/env";
import { beginVisit, requestVisit } from "./public-service";
import { DomainError } from "@/domain/errors";
export async function beginVisitAction(input: unknown) {
  const h = await headers();
  // Vercel supplies this header; locally use one shared bucket instead of trusting arbitrary forwarding headers.
  const address = process.env.VERCEL
    ? (h.get("x-vercel-forwarded-for") ?? "unknown")
    : "local";
  const abuseKey = createHmac("sha256", readEnv().BETTER_AUTH_SECRET)
    .update(`${new Date().toISOString().slice(0, 10)}:${address}`)
    .digest("hex");
  try {
    return { success: true as const, ...(await beginVisit(input, abuseKey)) };
  } catch {
    return {
      success: false as const,
      error:
        "Não foi possível registrar agora. Confira os dados ou continue sem se identificar.",
    };
  }
}
export async function requestVisitAction(token: unknown, input: unknown) {
  try {
    await requestVisit(token, input);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof DomainError
          ? error.message
          : "Confira a data e tente novamente.",
    };
  }
}
