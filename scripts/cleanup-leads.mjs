import "dotenv/config";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const apply = process.argv.includes("--apply");
try {
  const organizations = await pool.query(
    'SELECT m."organizationId",m."userId" FROM "OrganizationMember" m WHERE m.role=\'OWNER\' ORDER BY m."createdAt"',
  );
  const seen = new Set();
  let visits = 0,
    leads = 0;
  for (const actor of organizations.rows) {
    if (seen.has(actor.organizationId)) continue;
    seen.add(actor.organizationId);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)",
        [actor.organizationId, actor.userId],
      );
      const oldVisits = await client.query(
        `SELECT id FROM "TourVisit" WHERE "organizationId"=$1 AND "createdAt"<now()-interval '90 days'`,
        [actor.organizationId],
      );
      const oldLeads = await client.query(
        `SELECT id FROM "Lead" WHERE "organizationId"=$1 AND "updatedAt"<now()-interval '365 days'`,
        [actor.organizationId],
      );
      visits += oldVisits.rowCount;
      leads += oldLeads.rowCount;
      if (apply) {
        await client.query('DELETE FROM "TourVisit" WHERE id=ANY($1::uuid[])', [
          oldVisits.rows.map((r) => r.id),
        ]);
        await client.query('DELETE FROM "Lead" WHERE id=ANY($1::uuid[])', [
          oldLeads.rows.map((r) => r.id),
        ]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  process.stdout.write(
    `${apply ? "Removidos" : "Identificados (simulação)"}: ${visits} sessões com mais de 90 dias; ${leads} leads sem atualização há mais de 365 dias.\n`,
  );
} catch {
  process.stderr.write("Falha na limpeza da jornada comercial.\n");
  process.exitCode = 1;
} finally {
  await pool.end();
}
