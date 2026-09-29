import "dotenv/config";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const apply = process.argv.includes("--apply");
  for (const table of ["Session", "Verification"]) {
    const sql = apply
      ? `DELETE FROM "${table}" WHERE "expiresAt" < now()-interval '1 day'`
      : `SELECT id FROM "${table}" WHERE "expiresAt" < now()-interval '1 day'`;
    const result = await pool.query(sql);
    process.stdout.write(
      `${table}: ${result.rowCount} registros expirados ${apply ? "removidos" : "identificados"}.\n`,
    );
  }
  if (apply)
    await pool.query('DELETE FROM "RateLimit" WHERE "lastRequest" < $1', [
      Date.now() - 86400000,
    ]);
} catch {
  process.stderr.write("Falha na limpeza de autenticação.\n");
  process.exitCode = 1;
} finally {
  await pool.end();
}
