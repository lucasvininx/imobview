import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  process.stdout.write(".env já existe; nenhuma alteração realizada.\n");
} else {
  const source = readFileSync(".env.example", "utf8")
    .replace(
      "replace-with-a-random-secret-at-least-32-characters",
      randomBytes(32).toString("hex"),
    )
    .replace(
      "SEED_PASSWORD=",
      "SEED_PASSWORD=" + randomBytes(18).toString("base64url"),
    );
  writeFileSync(".env", source, { mode: 0o600 });
  process.stdout.write(
    ".env criado com secrets aleatórios. A senha de demonstração está em SEED_PASSWORD.\n",
  );
}
