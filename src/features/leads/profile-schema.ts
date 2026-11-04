import { z } from "zod";

export function validCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  for (const length of [9, 10]) {
    const sum = [...value.slice(0, length)].reduce(
      (total, digit, i) => total + Number(digit) * (length + 1 - i),
      0,
    );
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(value[length])) return false;
  }
  return true;
}
export const leadProfileSchema = z
  .object({
    name: z.string().trim().min(3, "Informe o nome completo.").max(160),
    email: z
      .union([z.email().max(254), z.literal("")])
      .transform((v) => v.toLowerCase()),
    phone: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .pipe(
        z.union([
          z.string().regex(/^\d{10,15}$/, "Informe um celular válido."),
          z.literal(""),
        ]),
      ),
    cpf: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => !v || validCpf(v), "CPF inválido."),
    birthDate: z
      .union([z.iso.date(), z.literal("")])
      .refine(
        (v) =>
          !v ||
          (v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)),
        "Confira a data de nascimento.",
      ),
    propertyId: z.union([z.uuid(), z.literal("")]),
  })
  .refine(
    (v) => !!v.email || !!v.phone,
    "Informe pelo menos e-mail ou celular.",
  );

export function isCompleteLead(lead: {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: Date | string | null;
}) {
  return !!(
    lead.name &&
    lead.email &&
    lead.phone &&
    lead.cpf &&
    lead.birthDate
  );
}
