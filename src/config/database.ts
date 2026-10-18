import type { PoolConfig } from "pg";

export function databasePoolConfig(
  connectionString: string,
  certificate?: string,
): PoolConfig {
  if (!certificate) return { connectionString };
  const url = new URL(connectionString);
  // pg connection-string TLS parameters replace the explicit SSL configuration.
  // Remove file paths and SSL flags when a portable CA is provided.
  for (const key of [
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "ssl",
    "uselibpqcompat",
  ])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: { ca: certificate.replace(/\\n/g, "\n"), rejectUnauthorized: true },
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  };
}
