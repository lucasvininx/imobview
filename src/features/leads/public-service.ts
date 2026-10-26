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
  const { returnKey, ...data } = startVisitSchema.parse(input);
  const token = randomBytes(32).toString("hex");
  const deviceKey = data.contact ? randomBytes(32).toString("hex") : null;
  const payload = {
    ...data,
    ...(returnKey ? { returnKeyHash: hashToken(returnKey) } : {}),
    ...(deviceKey ? { deviceKeyHash: hashToken(deviceKey) } : {}),
  };
  const [row] = await db.$queryRaw<
    { id: string | null }[]
  >`SELECT public.begin_tour_visit(${JSON.stringify(payload)}::jsonb,${hashToken(token)},${abuseKey}) AS id`;
  if (!row?.id)
    throw new DomainError(
      "NOT_FOUND",
      "Não encontramos seu cadastro anterior. Informe seus dados novamente.",
    );
  return { token, ...(deviceKey ? { returnKey: deviceKey } : {}) };
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
