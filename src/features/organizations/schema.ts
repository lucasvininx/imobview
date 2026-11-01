import { z } from "zod";

export const organizationContactSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da imobiliária.").max(120),
  contactEmail: z.union([z.email().max(254), z.literal("")]),
  whatsapp: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s()+-]/g, ""))
    .refine(
      (value) => !value || /^55[1-9]\d{9,10}$/.test(value),
      "Use 55 + DDD + número, por exemplo 5511999999999.",
    ),
});

// Annual rate typed as "11,5" or "11.50" and stored in basis points.
export const financingSettingsSchema = z.object({
  financingRate: z
    .string()
    .trim()
    .regex(/^\d{1,2}([.,]\d{1,2})?$/, "Use um número como 11,50.")
    .transform((value) => Math.round(Number(value.replace(",", ".")) * 100))
    .pipe(
      z
        .number()
        .int()
        .min(100, "Use uma taxa entre 1% e 40% ao ano.")
        .max(4000, "Use uma taxa entre 1% e 40% ao ano."),
    ),
});

export function whatsappUrl(phone: string, message: string) {
  return /^55[1-9]\d{9,10}$/.test(phone)
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : null;
}
