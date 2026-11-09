import { z } from "zod";

export const businessMessageSchema = z.object({
  name: z.string().trim().min(3).max(160),
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  message: z.string().trim().min(20).max(4000),
  consent: z.literal(true),
  website: z.string().max(0).default(""),
});
