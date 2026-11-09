import { z } from "zod";

const secret = z.string().trim().min(1).max(10000);
export const googleSettings = z.object({
  clientId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/),
  clientSecret: secret,
});
export const whatsappSettings = z.object({
  accessToken: secret,
  appSecret: z
    .string()
    .trim()
    .regex(
      /^[a-f0-9]{32}$/i,
      "Informe o App Secret de 32 caracteres do aplicativo Meta.",
    ),
  phoneNumberId: z.string().regex(/^\d{5,30}$/),
  businessAccountId: z.string().regex(/^\d{5,30}$/),
  apiVersion: z.string().regex(/^v\d{2,3}\.\d+$/),
  template: z.string().regex(/^[a-z0-9_]{1,100}$/),
  language: z.string().regex(/^[a-z]{2}(?:_[A-Z]{2})?$/),
});
export const emailSettings = z.object({
  apiKey: secret,
  fromEmail: z.email().max(254),
  fromName: z.string().trim().min(2).max(120),
  replyTo: z.union([z.email(), z.literal("")]).default(""),
  webhookSecret: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => !value || /^whsec_[a-zA-Z0-9+/=_-]+$/.test(value),
      "Informe o Signing secret iniciado por whsec_.",
    )
    .default(""),
  notifyTeam: z.boolean().default(true),
  notifyClient: z.boolean().default(false),
});
export type GoogleSettings = z.infer<typeof googleSettings>;
export type WhatsAppSettings = z.infer<typeof whatsappSettings> & {
  verifyToken: string;
};
export type EmailSettings = z.infer<typeof emailSettings>;
export const providerSchema = z.enum(["GOOGLE", "WHATSAPP", "EMAIL"]);

export function localDateTime(value: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Informe data e horário válidos.");
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error("Escolha um fuso horário válido.");
  }
  const parts = (date: Date) =>
    Object.fromEntries(
      format.formatToParts(date).map((p) => [p.type, p.value]),
    );
  const display = (date: Date) => {
    const p = parts(date);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  };
  const target = Date.parse(value + ":00Z");
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(instant));
    const wall = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`,
    );
    instant += target - wall;
  }
  const date = new Date(instant);
  if (!Number.isFinite(instant) || display(date) !== value)
    throw new Error("Este horário não existe no fuso escolhido.");
  if (
    [-120, -60, 60, 120].some(
      (delta) => display(new Date(instant + delta * 60000)) === value,
    )
  )
    throw new Error(
      "Horário ambíguo por mudança de fuso. Escolha outro horário.",
    );
  return date;
}
export const scheduleSchema = z
  .object({
    localStart: z.string(),
    timeZone: z.string().min(1).max(80),
    duration: z.coerce.number().int().min(15).max(240),
    syncCalendar: z.boolean(),
  })
  .transform((input, ctx) => {
    try {
      const start = localDateTime(input.localStart, input.timeZone);
      if (
        start.getTime() < Date.now() - 60000 ||
        start.getTime() > Date.now() + 366 * 86400000
      )
        throw new Error(
          "Escolha uma data futura dentro dos próximos 12 meses.",
        );
      return {
        ...input,
        start,
        end: new Date(start.getTime() + input.duration * 60000),
      };
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Confira o horário.",
      });
      return z.NEVER;
    }
  });
