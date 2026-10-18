import { z } from "zod";

export const envSchema = z
  .object({
    DATABASE_URL: z
      .url()
      .refine((url) => url.startsWith("postgresql://"), "Use PostgreSQL"),
    NEXT_PUBLIC_APP_URL: z.url(),
    DATABASE_CA_CERT: z
      .string()
      .refine(
        (value) =>
          value.includes("-----BEGIN CERTIFICATE-----") &&
          value.includes("-----END CERTIFICATE-----"),
        "Use a PEM certificate",
      )
      .optional(),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32)
      .refine(
        (value) => !value.startsWith("replace-"),
        "Generate a random secret",
      ),
    SMTP_ENABLED: z.enum(["true", "false"]).default("true"),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_FROM: z.string().min(1).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (env.SMTP_ENABLED === "true") {
      for (const field of ["SMTP_HOST", "SMTP_FROM"] as const) {
        if (!env[field])
          context.addIssue({
            code: "custom",
            path: [field],
            message: "Required when SMTP_ENABLED=true",
          });
      }
    }
  });

export function readEnv(source: NodeJS.ProcessEnv = process.env) {
  const result = envSchema.safeParse(source);
  if (!result.success)
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}. See .env.example.`,
    );
  return result.data;
}
