import "dotenv/config";
import { Pool } from "pg";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
const failures = [];
function check(ok, name) {
  process.stdout.write(`${ok ? "OK" : "PENDENTE"}: ${name}\n`);
  if (!ok) failures.push(name);
}
check(
  process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://"),
  "URL pública HTTPS",
);
check(
  Boolean(process.env.BUSINESS_LEGAL_NAME && process.env.BUSINESS_EMAIL),
  "Identificação e contato comercial",
);
check(
  Boolean(process.env.BACKUP_ENCRYPTION_KEY?.match(/^[a-f0-9]{64}$/i)),
  "Chave de backup configurada",
);
check(
  process.env.LEGAL_REVIEWED === "true",
  "Termos, privacidade e retenção revisados pelo responsável",
);
check(
  process.env.OPERATIONS_MONITOR_URL?.startsWith("https://"),
  "Destino HTTPS para verificação operacional",
);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  const role = await pool.query(
    "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
  );
  check(
    role.rows.length === 1 &&
      !role.rows[0].rolsuper &&
      !role.rows[0].rolbypassrls,
    "Banco com role restrita",
  );
  const owners = await pool.query(
    'SELECT count(*)::int AS count FROM "OrganizationMember" m JOIN "User" u ON u.id=m."userId" WHERE m.role=\'OWNER\' AND u.email NOT LIKE \'%@imobview.test\'',
  );
  check(owners.rows[0].count > 0, "Conta real de proprietário provisionada");
  const demoAccounts = await pool.query(
    'SELECT count(*)::int AS count FROM "Account" a JOIN "User" u ON u.id=a."userId" WHERE u.email LIKE \'%@imobview.test\' AND a.password IS NOT NULL',
  );
  check(demoAccounts.rows[0].count === 0, "Acessos demonstrativos desativados");
  const demo = await pool.query("SELECT * FROM get_published_tours($1)", [
    process.env.DEMO_PROPERTY_SLUG || "casa-modelo-tour-360",
  ]);
  check(demo.rows.length > 0, "Demonstração 360 publicada");
} catch {
  check(false, "Conexão e estrutura do banco");
} finally {
  await pool.end();
}
try {
  const smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    requireTLS: Number(process.env.SMTP_PORT) !== 465,
    connectionTimeout: 10000,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  check(
    !["localhost", "127.0.0.1"].includes(process.env.SMTP_HOST),
    "Servidor SMTP externo",
  );
  await smtp.verify();
  check(true, "Conexão SMTP autenticada (sem envio de mensagem)");
  smtp.close();
} catch {
  check(false, "Conexão SMTP");
}
try {
  const storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } },
  ).storage;
  const { data, error } = await storage.getBucket(
    process.env.SUPABASE_TOUR_BUCKET || "imobview-tours",
  );
  check(
    !error &&
      data?.public === false &&
      Number(data.file_size_limit) <= 20971520,
    "Storage privado com limite de upload",
  );
} catch {
  check(false, "Storage configurado");
}
process.stdout.write(
  "Verifique também: restauração de backup, DNS do remetente, alertas e fluxos reais no ambiente publicado. Este comando não substitui testes em produção.\n",
);
if (failures.length) process.exitCode = 1;
