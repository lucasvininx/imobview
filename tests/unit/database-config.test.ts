import { it, expect } from "vitest";
import { databasePoolConfig } from "@/config/database";
import { envSchema } from "@/config/env";

it("uses a portable CA without allowing connection URL flags to disable TLS verification", () => {
  const config = databasePoolConfig(
    "postgresql://test:test@db.example/postgres?sslmode=no-verify&sslrootcert=C%3A%2Fmissing.crt&ssl=false&application_name=imobview",
    "-----BEGIN CERTIFICATE-----\\ncertificate\\n-----END CERTIFICATE-----",
  );
  expect(config.ssl).toEqual({
    ca: "-----BEGIN CERTIFICATE-----\ncertificate\n-----END CERTIFICATE-----",
    rejectUnauthorized: true,
  });
  const url = new URL(config.connectionString!);
  expect(url.searchParams.has("sslrootcert")).toBe(false);
  expect(url.searchParams.has("sslmode")).toBe(false);
  expect(url.searchParams.has("ssl")).toBe(false);
  expect(url.searchParams.get("application_name")).toBe("imobview");
});
it("keeps existing local connections unchanged without a portable CA", () => {
  const connectionString =
    "postgresql://local:local@127.0.0.1:55432/imobview_test";
  expect(databasePoolConfig(connectionString)).toEqual({ connectionString });
});
it("requires SMTP configuration unless email delivery is explicitly disabled", () => {
  const base = {
    DATABASE_URL: "postgresql://user:pass@localhost/db",
    NEXT_PUBLIC_APP_URL: "https://imobview.example",
    BETTER_AUTH_SECRET: "a".repeat(48),
  };
  expect(envSchema.safeParse(base).success).toBe(false);
  expect(envSchema.safeParse({ ...base, SMTP_ENABLED: "false" }).success).toBe(
    true,
  );
  expect(
    envSchema.safeParse({
      ...base,
      SMTP_HOST: "smtp.example",
      SMTP_FROM: "ImobView <sender@example.com>",
    }).success,
  ).toBe(true);
});
