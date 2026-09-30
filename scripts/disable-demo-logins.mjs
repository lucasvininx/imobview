import "dotenv/config";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const { rows } = await pool.query(
    "SELECT id FROM \"User\" WHERE email LIKE '%@imobview.test'",
  );
  if (process.argv.includes("--apply")) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ids = rows.map((row) => row.id);
      await client.query(
        'DELETE FROM "Session" WHERE "userId"=ANY($1::text[])',
        [ids],
      );
      await client.query(
        'DELETE FROM "Account" WHERE "userId"=ANY($1::text[])',
        [ids],
      );
      await client.query(
        "DELETE FROM \"Verification\" WHERE value=ANY($1::text[]) AND identifier LIKE 'reset-password:%'",
        [ids],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  process.stdout.write(
    `${rows.length} contas demonstrativas ${process.argv.includes("--apply") ? "sem acesso (sessões e credenciais removidas)" : "identificadas. Use --apply somente após provisionar sua conta real"}. Imóveis e tours foram preservados.\n`,
  );
} catch {
  process.stderr.write(
    "Não foi possível desativar os acessos de demonstração.\n",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
