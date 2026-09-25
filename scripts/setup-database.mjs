import "dotenv/config";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
if (process.env.NODE_ENV === "production")
  throw new Error("Local setup is forbidden in production.");
const adminUrl = new URL(process.env.DIRECT_DATABASE_URL);
const runtimeUrl = new URL(process.env.DATABASE_URL);
const testUrl = new URL(process.env.TEST_DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(adminUrl.hostname) ||
  !["localhost", "127.0.0.1"].includes(testUrl.hostname) ||
  !testUrl.pathname.endsWith("_test")
)
  throw new Error("Only local development and *_test databases are supported.");
if (
  runtimeUrl.username !== "imobview_app" ||
  testUrl.username !== "imobview_app"
)
  throw new Error("Use the imobview_app runtime role.");
const pool = new Pool({ connectionString: adminUrl.toString() });
try {
  const exists = await pool.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [
    "imobview_app",
  ]);
  if (!exists.rowCount) {
    const statement = await pool.query(
      "SELECT format('CREATE ROLE imobview_app LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', $1::text) AS sql",
      [decodeURIComponent(runtimeUrl.password)],
    );
    await pool.query(statement.rows[0].sql);
  }
  const name = testUrl.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error("Invalid test database name");
  if (
    !(await pool.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
      .rowCount
  )
    await pool.query('CREATE DATABASE "' + name + '"');
} finally {
  await pool.end();
}
for (const pathname of [adminUrl.pathname, testUrl.pathname]) {
  const target = new URL(adminUrl);
  target.pathname = pathname;
  const env = { ...process.env, DIRECT_DATABASE_URL: target.toString() };
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env, stdio: "inherit" },
  );
  const database = new Pool({ connectionString: target.toString() });
  try {
    await database.query(readFileSync("scripts/database-grants.sql", "utf8"));
  } finally {
    await database.end();
  }
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
    { env, stdio: "inherit" },
  );
}
process.stdout.write("Bancos de desenvolvimento e testes preparados.\n");
