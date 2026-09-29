import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export function key() {
  if (!/^[a-f0-9]{64}$/i.test(process.env.BACKUP_ENCRYPTION_KEY || ""))
    throw new Error("Configure BACKUP_ENCRYPTION_KEY (32 bytes hex).");
  return Buffer.from(process.env.BACKUP_ENCRYPTION_KEY, "hex");
}
export async function writeEncrypted(path, bytes) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  await writeFile(path, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), {
    mode: 0o600,
    flag: "wx",
  });
}
export async function readEncrypted(path) {
  const data = await readFile(path),
    decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]);
}
export function pgEnv(connection) {
  const url = new URL(connection);
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
    PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
    ...(url.searchParams.get("sslrootcert")
      ? { PGSSLROOTCERT: url.searchParams.get("sslrootcert") }
      : {}),
  };
}
export async function pgTool(command, args, connection, stdin) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: pgEnv(connection),
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const chunks = [];
    let length = 0;
    child.stdout.on("data", (chunk) => {
      length += chunk.length;
      if (length > 512 * 1024 * 1024) {
        child.kill();
        reject(new Error("Database backup exceeds beta memory limit."));
      } else chunks.push(chunk);
    });
    child.stderr.resume();
    child.on("error", () => reject(new Error("PostgreSQL tool unavailable.")));
    child.on("close", (code) =>
      code === 0
        ? resolvePromise(Buffer.concat(chunks))
        : reject(
            new Error(
              "PostgreSQL operation failed. Check credentials, version and privileges.",
            ),
          ),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(stdin);
  });
}
export async function backupFolder() {
  const root = resolve(process.env.BACKUP_DIRECTORY || ".local/backups");
  const folder = resolve(root, new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(folder, { recursive: true, mode: 0o700 });
  return folder;
}
