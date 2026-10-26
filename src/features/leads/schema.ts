import { z } from "zod";
import { financingInputSchema } from "@/features/financing/calc";

export const stageLabels = {
  NEW: "Novo lead",
  TOUR_STARTED: "Tour iniciado",
  TOUR_COMPLETED: "Tour concluído",
  INTERESTED: "Interessado",
  VISIT_REQUESTED: "Visita solicitada",
  NEGOTIATION: "Negociação",
  PROPOSAL: "Proposta",
  WON: "Venda",
  LOST: "Perdido",
} as const;
export const stageSchema = z.enum([
  "NEW",
  "TOUR_STARTED",
  "TOUR_COMPLETED",
  "INTERESTED",
  "VISIT_REQUESTED",
  "NEGOTIATION",
  "PROPOSAL",
  "WON",
  "LOST",
]);
export const contactSchema = z.object({
  name: z.string().trim().min(3).max(160),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{10,15}$/)),
  consent: z.literal(true),
});
export const startVisitSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{1,220}$/),
    tourId: z.uuid(),
    tracking: z.boolean(),
    contact: contactSchema.optional(),
    // Random browser key issued after identification; only its hash is stored.
    returnKey: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    source: z
      .string()
      .max(120)
      .regex(/^[a-zA-Z0-9._ -]*$/)
      .default("direct"),
    website: z.string().max(0).default(""),
  })
  .refine(
    (v) => v.tracking || !!v.contact || !!v.returnKey,
    "Escolha o que deseja compartilhar.",
  )
  .refine(
    (v) => !(v.contact && v.returnKey),
    "Informe os dados ou continue como visitante reconhecido.",
  );
export const eventSchema = z
  .object({
    sequence: z.number().int().min(1).max(2500),
    kind: z.enum([
      "START",
      "SCENE",
      "HEARTBEAT",
      "EXIT",
      "COMPLETE",
      "CONTACT",
      "SHARE",
      "HOTSPOT",
      "SIMULATE",
      "DETAIL",
    ]),
    sceneId: z.uuid().nullable().default(null),
    durationMs: z.number().int().min(0).max(30000).default(0),
    simulation: financingInputSchema.optional(),
  })
  .refine(
    (event) => (event.kind === "SIMULATE") === !!event.simulation,
    "Simulação inválida.",
  );
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const visitRequestSchema = z.object({
  preferredDate: z.iso.date().refine((v) => {
    const date = Date.parse(v + "T12:00:00Z");
    return date >= Date.now() - 86400000 && date <= Date.now() + 180 * 86400000;
  }, "Escolha uma data nos próximos 180 dias."),
  period: z.enum(["MORNING", "AFTERNOON", "EVENING"]),
});
export const periodLabels = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
  EVENING: "Noite",
} as const;
export function sourceFromLocation(search: string, referrer: string) {
  const raw = new URLSearchParams(search).get("utm_source");
  if (raw)
    return raw.replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 120) || "direct";
  try {
    return new URL(referrer).hostname.slice(0, 120);
  } catch {
    return "direct";
  }
}
