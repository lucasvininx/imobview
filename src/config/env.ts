import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine((url) => url.startsWith("postgresql://"), "Use PostgreSQL"),
  NEXT_PUBLIC_APP_URL: z.url(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .refine(
      (value) => !value.startsWith("replace-"),
      "Generate a random secret",
    ),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().min(1),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

export function readEnv(source: NodeJS.ProcessEnv = process.env) {
  const result = envSchema.safeParse(source);
  if (!result.success)
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}. See .env.example.`,
    );
  return result.data;
}
