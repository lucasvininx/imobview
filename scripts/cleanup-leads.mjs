import "dotenv/config";
import { Pool } from "pg";
// Same policy as /api/cron/retention: public.purge_journey_data is the single source of retention windows.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const apply = process.argv.includes("--apply");
try {
  const {
    rows: [result],
  } = await pool.query("SELECT * FROM public.purge_journey_data($1)", [apply]);
  process.stdout.write(
    `${apply ? "Removidos" : "Identificados (simulação)"}: ${result.visits} sessões com mais de 90 dias; ${result.leads} leads sem atualização há mais de 365 dias; ${result.devices} navegadores reconhecidos sem uso há mais de 365 dias.\n`,
  );
} catch {
  process.stderr.write("Falha na limpeza da jornada comercial.\n");
  process.exitCode = 1;
} finally {
  await pool.end();
}
