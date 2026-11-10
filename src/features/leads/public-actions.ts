"use server";
import { headers } from "next/headers";
import { createHmac } from "node:crypto";
import { readEnv } from "@/config/env";
import { beginVisit, requestVisit } from "./public-service";
import { DomainError } from "@/domain/errors";
import { identifiedTour } from "@/features/tours/presentation";
import { hashToken } from "./public-service";
import { deliverWhatsApp } from "@/features/notifications/whatsapp";
import { after } from "next/server";
import { logError } from "@/server/logger";
import { deliverIntegrations } from "@/features/integrations/delivery";
import { measuredVisitSchema } from "./schema";
export async function beginVisitAction(input: unknown) {
  const parsed = measuredVisitSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false as const,
      error:
        parsed.error.issues[0]?.message ??
        "Confira os dados para iniciar o tour.",
    };
  const h = await headers();
  // Vercel supplies this header; locally use one shared bucket instead of trusting arbitrary forwarding headers.
  const address = process.env.VERCEL
    ? (h.get("x-vercel-forwarded-for") ?? "unknown")
    : "local";
  const abuseKey = createHmac("sha256", readEnv().BETTER_AUTH_SECRET)
    .update(`${new Date().toISOString().slice(0, 10)}:${address}`)
    .digest("hex");
  try {
    const visit = await beginVisit(parsed.data, abuseKey);
    const tour = await identifiedTour(hashToken(visit.token));
    if (!tour) throw new Error("TourUnavailable");
    return { success: true as const, ...visit, tour };
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND")
      return {
        success: false as const,
        forget: true as const,
        error: error.message,
      };
    return {
      success: false as const,
      error:
        "Não foi possível registrar agora. Confira os dados e tente novamente para liberar o tour.",
    };
  }
}
export async function requestVisitAction(token: unknown, input: unknown) {
  try {
    await requestVisit(token, input);
    after(async () => {
      try {
        const outcomes = await Promise.allSettled([
          deliverWhatsApp(hashToken(String(token))),
          deliverIntegrations(),
        ]);
        for (const outcome of outcomes)
          if (outcome.status === "rejected")
            logError("visit.dispatch.failed", outcome.reason);
      } catch (error) {
        logError("whatsapp.dispatch.failed", error);
      }
    });
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
