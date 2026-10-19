import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/server/db";
import {
  startVisitSchema,
  eventSchema,
  tokenSchema,
  visitRequestSchema,
} from "./schema";
import { DomainError } from "@/domain/errors";
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function beginVisit(input: unknown, abuseKey: string) {
  const data = startVisitSchema.parse(input);
  const token = randomBytes(32).toString("hex");
  await db.$queryRaw`SELECT public.begin_tour_visit(${JSON.stringify(data)}::jsonb,${hashToken(token)},${abuseKey})`;
  return { token };
}
export async function recordEvent(token: unknown, input: unknown) {
  const key = hashToken(tokenSchema.parse(token));
  const event = eventSchema.parse(input);
  const [result] = await db.$queryRaw<
    { ok: boolean }[]
  >`SELECT public.record_tour_event(${key},${JSON.stringify(event)}::jsonb) AS ok`;
  return result.ok;
}
export async function requestVisit(token: unknown, input: unknown) {
  const key = hashToken(tokenSchema.parse(token));
  const data = visitRequestSchema.parse(input);
  const [result] = await db.$queryRaw<
    { ok: boolean }[]
  >`SELECT public.request_property_visit(${key},${data.preferredDate},${data.period}) AS ok`;
  if (!result.ok)
    throw new DomainError(
      "CONFLICT",
      "Não foi possível solicitar esta visita. Reabra a página e confira a data.",
    );
}
