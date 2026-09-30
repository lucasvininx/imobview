import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { SMTPServer } from "smtp-server";
import sharp from "sharp";
import { testAdminUrl } from "../database-url";
const pool = new Pool({ connectionString: testAdminUrl() });
test.afterAll(async () => pool.end());
test.beforeEach(async () => {
  await pool.query('DELETE FROM "RateLimit"');
});

test("agency contact, photo upload and public gallery work on mobile", async ({
  page,
}) => {
  const id = randomUUID(),
    slug = `photos-${id}`;
  const org = await pool.query(
    'SELECT "organizationId" FROM "Property" WHERE slug=$1',
    ["apartamento-jardim-demo"],
  );
  const organizationId = org.rows[0].organizationId;
  const previous = await pool.query(
    'SELECT name,"contactEmail",whatsapp FROM "Organization" WHERE id=$1',
    [organizationId],
  );
  await pool.query(
    "INSERT INTO \"Property\" (id,\"organizationId\",title,slug,status,\"updatedAt\",city,state) VALUES ($1,$2,'Casa fotos E2E',$3,'PUBLISHED',now(),'São Paulo','SP')",
    [id, organizationId, slug],
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("/login");
    await page
      .getByLabel("E-mail", { exact: true })
      .fill("admin@imobview.test");
    await page
      .getByLabel("Senha", { exact: true })
      .fill(process.env.SEED_PASSWORD!);
    await page.getByRole("button", { name: "Entrar na plataforma" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/app/configuracoes");
    await page.getByLabel("E-mail comercial").fill("contato@example.com");
    await page.getByLabel("WhatsApp com DDI e DDD").fill("+55 (11) 99999-9999");
    await page.getByRole("button", { name: "Salvar contato" }).click();
    await expect(page.getByText("Contato atualizado.")).toBeVisible();
    await page.goto(`/app/imoveis/${id}`);
    for (const [index, color] of ["green", "blue"].entries()) {
      const buffer = await sharp({
        create: { width: 1200, height: 800, channels: 3, background: color },
      })
        .jpeg()
        .toBuffer();
      await page.getByLabel("Adicionar foto").waitFor({ state: "visible" });
      await expect(page.getByLabel("Adicionar foto")).toBeEnabled();
      await page.getByLabel("Adicionar foto").setInputFiles({
        name: `casa-${index}.jpg`,
        mimeType: "image/jpeg",
        buffer,
      });
      await expect(
        page.getByRole("img", { name: `casa-${index}.jpg` }),
      ).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/v/${slug}`);
    await expect(
      page.getByRole("link", { name: "Conversar no WhatsApp" }),
    ).toHaveAttribute("href", /^https:\/\/wa\.me\/5511999999999\?text=/);
    await expect(
      page.getByRole("link", { name: "Enviar e-mail" }),
    ).toHaveAttribute("href", /^mailto:contato@example.com/);
    await page.getByRole("button", { name: "Ambiente 2" }).click();
    await expect(
      page.getByRole("button", { name: "Ambiente 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        page
          .locator(".public-gallery img")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: "test-results/launch-gallery-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await pool.query('DELETE FROM "Property" WHERE id=$1', [id]);
    const old = previous.rows[0];
    await pool.query(
      'UPDATE "Organization" SET name=$2,"contactEmail"=$3,whatsapp=$4 WHERE id=$1',
      [organizationId, old.name, old.contactEmail, old.whatsapp],
    );
  }
});

test("tour draft blocks internal navigation and recovers after a reload", async ({
  page,
}) => {
  const property = await pool.query('SELECT id FROM "Property" WHERE slug=$1', [
    "apartamento-jardim-demo",
  ]);
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("admin@imobview.test");
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.SEED_PASSWORD!);
  await page.getByRole("button", { name: "Entrar na plataforma" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto(`/app/imoveis/${property.rows[0].id}`);
  await page
    .getByRole("button", { name: "Criar tour 360°", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tours\//);
  const tourId = page.url().split("/").at(-1)!;
  try {
    await page.getByLabel("Nome do tour").fill("Rascunho recuperável");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("link", { name: "Voltar ao imóvel" }).click();
    await expect(page).toHaveURL(/\/tours\//);
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await page
      .getByRole("button", { name: "Recuperar alterações deste navegador" })
      .click();
    await expect(page.getByLabel("Nome do tour")).toHaveValue(
      "Rascunho recuperável",
    );
    await page
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .click();
    await expect(
      page.getByText("Rascunho salvo.", { exact: true }),
    ).toBeVisible();
  } finally {
    await pool.query('DELETE FROM "Tour" WHERE id=$1', [tourId]);
  }
});

test("assisted customer provisioning activates through email reset and opens its own workspace", async ({
  page,
}) => {
  const id = randomUUID(),
    email = `customer-${id}@imobview.test`,
    path = `.local/customer-${id}.json`;
  const messages: string[] = [];
  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH", "STARTTLS"],
    onData(stream, _session, callback) {
      let data = "";
      stream.on("data", (chunk) => {
        data += chunk.toString();
      });
      stream.on("end", () => {
        messages.push(data);
        callback();
      });
    },
  });
  await new Promise<void>((resolve) =>
    smtp.listen(11025, "127.0.0.1", resolve),
  );
  try {
    mkdirSync(".local", { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        name: "Cliente E2E",
        email,
        organization: "Agência E2E",
        slug: id,
      }),
    );
    execFileSync(
      process.execPath,
      ["scripts/provision-customer.mjs", path, "--apply"],
      {
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
        stdio: "pipe",
      },
    );
    await page.goto("/recuperar-senha");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page
      .getByRole("button", { name: "Enviar link de recuperação" })
      .click();
    await expect.poll(() => messages.length).toBe(1);
    const decoded = messages[0].replace(/=\r?\n/g, "").replace(/=3D/g, "=");
    const url = decoded.match(
      /http:\/\/localhost:3100\/api\/auth\/reset-password\/[^\s<>]+/,
    )?.[0];
    expect(url).toBeTruthy();
    await page.goto(url!);
    await page.getByLabel("Nova senha").fill("customer-e2e-password-123");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByRole("status")).toContainText("Senha atualizada");
    await page.goto("/login");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page
      .getByLabel("Senha", { exact: true })
      .fill("customer-e2e-password-123");
    await page.getByRole("button", { name: "Entrar na plataforma" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("complementary")).toContainText("Agência E2E");
    await page.goto("/app/imoveis");
    await expect(
      page.getByText("Apartamento Jardim", { exact: false }),
    ).toHaveCount(0);
  } finally {
    await new Promise<void>((resolve) => smtp.close(resolve));
    await pool.query('DELETE FROM "Organization" WHERE slug=$1', [id]);
    await pool.query('DELETE FROM "User" WHERE email=$1', [email]);
    unlinkSync(path);
  }
});
