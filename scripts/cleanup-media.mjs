import "dotenv/config";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
const pool = new Pool({ connectionString: process.env.DIRECT_DATABASE_URL });
const apply = process.argv.includes("--apply");
try {
  const storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } },
  ).storage.from(process.env.SUPABASE_TOUR_BUCKET || "imobview-tours");
  let count = 0;
  for (const table of ["PanoramaAsset", "PropertyPhoto"]) {
    // Signed upload URLs expire before this cutoff. Active finalizations hold row locks.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `SELECT id,"uploadKey","storageKey" FROM "${table}" WHERE status IN ('PENDING','FAILED') AND "updatedAt" < now()-interval '24 hours' ORDER BY "updatedAt" LIMIT 100 FOR UPDATE SKIP LOCKED`,
      );
      count += rows.length;
      if (apply)
        for (const row of rows) {
          const { error } = await storage.remove([
            row.uploadKey,
            row.storageKey,
          ]);
          if (error) throw new Error("Storage removal failed");
          await client.query(`DELETE FROM "${table}" WHERE id=$1`, [row.id]);
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
    `${count} envios abandonados ${apply ? "removidos" : "identificados (simulação; use --apply)"}. Nenhum arquivo READY é removido por esta rotina.\n`,
  );
} catch {
  process.stderr.write(
    "Limpeza não concluída. A reserva dos arquivos não removidos é mantida; execute novamente após verificar a conexão.\n",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
