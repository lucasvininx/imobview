import "dotenv/config";
import { resolve, join } from "node:path";
import { Pool } from "pg";
import { readEncrypted, pgTool } from "./ops-lib.mjs";
const folder = resolve(process.argv[2] || "");
const target = new URL(
  process.env.RESTORE_TEST_DATABASE_URL || "postgresql://invalid/invalid",
);
if (
  !process.argv[2] ||
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  !target.pathname.endsWith("_restore_test")
)
  throw new Error(
    "Informe o backup e RESTORE_TEST_DATABASE_URL local terminado em _restore_test. Nunca restaura sobre produção.",
  );
const admin = new URL(target);
admin.pathname = "/postgres";
const pool = new Pool({ connectionString: admin.href });
try {
  const name = target.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error("Invalid database name");
  const exists = await pool.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    [name],
  );
  if (exists.rowCount)
    throw new Error(
      "Use a new, empty database name; existing databases are never overwritten.",
    );
  const manifest = JSON.parse(
    (await readEncrypted(join(folder, "manifest.enc"))).toString(),
  );
  const dump = await readEncrypted(join(folder, "database.enc"));
  await pool.query(`CREATE DATABASE "${name}"`);
  // This database was just created above; --clean removes its empty default public schema.
  await pgTool(
    "pg_restore",
    [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      "--dbname",
      name,
    ],
    target.href,
    dump,
  );
  const restored = new Pool({ connectionString: target.href });
  try {
    for (const table of [
      "User",
      "Organization",
      "OrganizationMember",
      "Property",
      "Tour",
      "PanoramaAsset",
      "PropertyPhoto",
    ]) {
      const result = await restored.query(
        `SELECT count(*)::int AS count FROM "${table}"`,
      );
      if (result.rows[0].count !== manifest.counts[table])
        throw new Error("Restored count mismatch");
    }
    for (const object of manifest.objects) {
      if (!/^object-\d+\.enc$/.test(object.file))
        throw new Error("Invalid manifest");
      const bytes = await readEncrypted(join(folder, object.file));
      if (!bytes.length) throw new Error("Empty object");
    }
  } finally {
    await restored.end();
  }
  process.stdout.write(
    "Restauração local validada: tabelas e objetos íntegros. O banco isolado foi preservado para inspeção. Nenhum dado foi enviado ao Storage.\n",
  );
} catch {
  process.stderr.write(
    "Teste de restauração falhou. Confira se o destino é novo e se o backup, a chave e as ferramentas estão disponíveis.\n",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
