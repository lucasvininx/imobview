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

export function whatsappUrl(phone: string, message: string) {
  return /^55[1-9]\d{9,10}$/.test(phone)
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : null;
}
