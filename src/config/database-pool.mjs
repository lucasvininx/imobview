/**
 * Shared by the application and administrative Node scripts.
 * @param {string} connectionString
 * @param {string | undefined} certificate
 * @returns {import("pg").PoolConfig}
 */
export function databasePoolConfig(connectionString, certificate) {
  if (!certificate) return { connectionString };
  const url = new URL(connectionString);
  // URL SSL flags override pg's explicit TLS options, including its trusted CA.
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
