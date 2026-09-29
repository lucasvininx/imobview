import "dotenv/config";
import { join } from "node:path";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { backupFolder, pgTool, writeEncrypted, key } from "./ops-lib.mjs";
key();
const connection = process.env.DIRECT_DATABASE_URL;
const pool = new Pool({ connectionString: connection });
const snapshotClient = await pool.connect();
try {
  await snapshotClient.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const snapshot = await snapshotClient.query(
    "SELECT pg_export_snapshot() AS id",
  );
  const folder = await backupFolder();
  const dump = await pgTool(
    "pg_dump",
    [
      "--format=custom",
      "--schema=public",
      "--no-owner",
      "--no-privileges",
      `--snapshot=${snapshot.rows[0].id}`,
    ],
    connection,
  );
  await writeEncrypted(join(folder, "database.enc"), dump);
  const { rows } = await snapshotClient.query(
    'SELECT "storageKey" AS key FROM "PanoramaAsset" WHERE status=\'READY\' UNION SELECT "storageKey" AS key FROM "PropertyPhoto" WHERE status=\'READY\'',
  );
  const storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } },
  ).storage.from(process.env.SUPABASE_TOUR_BUCKET || "imobview-tours");
  const manifest = {
    createdAt: new Date().toISOString(),
    objects: [],
    counts: {},
  };
  for (const table of [
    "User",
    "Organization",
    "OrganizationMember",
    "Property",
    "Tour",
    "PanoramaAsset",
    "PropertyPhoto",
  ]) {
    const result = await snapshotClient.query(
      `SELECT count(*)::int AS count FROM "${table}"`,
    );
    manifest.counts[table] = result.rows[0].count;
  }
  for (const [index, row] of rows.entries()) {
    const { data, error } = await storage.download(row.key);
    if (error || !data)
      throw new Error("Cannot back up a referenced media object.");
    const file = `object-${index}.enc`;
    await writeEncrypted(
      join(folder, file),
      Buffer.from(await data.arrayBuffer()),
    );
    manifest.objects.push({ key: row.key, file });
  }
  await snapshotClient.query("COMMIT");
  await writeEncrypted(
    join(folder, "manifest.enc"),
    Buffer.from(JSON.stringify(manifest)),
  );
  process.stdout.write(
    `Backup criptografado concluído: ${folder}\n${rows.length} objetos copiados. Guarde a chave separadamente e replique o backup fora deste computador.\n`,
  );
} catch {
  process.stderr.write(
    "Backup incompleto. Não use esta cópia para recuperação. Confira conexão, permissões e ferramentas PostgreSQL.\n",
  );
  process.exitCode = 1;
} finally {
  await snapshotClient.query("ROLLBACK").catch(() => {});
  snapshotClient.release();
  await pool.end();
}
