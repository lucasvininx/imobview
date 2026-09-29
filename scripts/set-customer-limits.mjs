import "dotenv/config";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const input = z
    .object({
      slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
      maxProperties: z.number().int().min(1).max(10000),
      maxPanoramas: z.number().int().min(1).max(100000),
      maxStorageMB: z.number().int().min(40).max(1048576),
    })
    .parse(JSON.parse(readFileSync(process.argv[2], "utf8")));
  if (!process.argv.includes("--apply"))
    process.stdout.write(
      "Limites válidos. Use --apply para aplicar à organização indicada. Não altera cobrança nem exclui conteúdo existente.\n",
    );
  else {
    const result = await pool.query(
      'UPDATE "Organization" SET "maxProperties"=$2,"maxPanoramas"=$3,"maxStorageBytes"=$4,"updatedAt"=now() WHERE slug=$1',
      [
        input.slug,
        input.maxProperties,
        input.maxPanoramas,
        BigInt(input.maxStorageMB) * 1048576n,
      ],
    );
    if (result.rowCount !== 1) throw new Error("Organization not found");
    process.stdout.write("Limites atualizados.\n");
  }
} catch {
  process.stderr.write(
    "Não foi possível ajustar os limites. Confira o arquivo, slug e conexão.\n",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
