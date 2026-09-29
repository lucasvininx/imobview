import "dotenv/config";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { Pool } from "pg";

// Assisted onboarding deliberately has no public administrator endpoint.
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  organization: z.string().trim().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
  maxProperties: z.number().int().min(1).max(10000).default(30),
  maxPanoramas: z.number().int().min(1).max(100000).default(300),
  maxStorageMB: z.number().int().min(40).max(1048576).default(2048),
});
const path = process.argv[2];
if (!path) {
  process.stderr.write(
    "Uso: npm run customer:create -- caminho/cliente.json [--apply]\n",
  );
  process.exit(1);
}
let pool;
try {
  const data = schema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (!process.argv.includes("--apply")) {
    process.stdout.write(
      "Dados válidos. Use --apply para criar a conta e a organização. Nenhuma senha ou mensagem será enviada.\n",
    );
  } else {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const userId = randomUUID(),
        orgId = randomUUID();
      // Nobody knows this password. The owner establishes their password using the existing reset flow.
      const password = await hashPassword(
        randomBytes(48).toString("base64url"),
      );
      await client.query(
        'INSERT INTO "User" (id,name,email,"emailVerified","updatedAt") VALUES ($1,$2,$3,false,now())',
        [userId, data.name, data.email.toLowerCase()],
      );
      await client.query(
        'INSERT INTO "Account" (id,"accountId","providerId","userId",password,"updatedAt") VALUES ($1,$2,\'credential\',$2,$3,now())',
        [randomUUID(), userId, password],
      );
      await client.query(
        'INSERT INTO "Organization" (id,name,slug,"maxProperties","maxPanoramas","maxStorageBytes","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())',
        [
          orgId,
          data.organization,
          data.slug,
          data.maxProperties,
          data.maxPanoramas,
          BigInt(data.maxStorageMB) * 1048576n,
        ],
      );
      await client.query(
        'INSERT INTO "OrganizationMember" ("organizationId","userId",role) VALUES ($1,$2,\'OWNER\')',
        [orgId, userId],
      );
      await client.query("COMMIT");
      process.stdout.write(
        "Conta e organização criadas. O titular deve acessar /recuperar-senha para definir sua senha pelo e-mail cadastrado. Nenhuma mensagem foi enviada por este comando.\n",
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} catch {
  process.stderr.write(
    "Falha na criação: confira os dados, conexão e se o e-mail/slug já existem. Nenhuma credencial é registrada.\n",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
