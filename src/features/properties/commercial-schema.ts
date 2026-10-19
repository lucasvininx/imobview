import { z } from "zod";
export const commercialSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(220)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use letras minúsculas, números e hífens.",
    ),
  internalCode: z.string().trim().max(80),
  address: z.string().trim().max(240),
  condominium: z.string().trim().max(160),
  suites: z.coerce.number().int().min(0).max(100),
  commercialNotes: z.string().trim().max(2000),
  captureLeads: z.boolean(),
  brokerId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
});
