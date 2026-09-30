import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { testAdminUrl } from "../database-url";
const pool = new Pool({ connectionString: testAdminUrl() });
test.afterAll(async () => pool.end());
test("360 tour uploads, connects rooms, publishes and isolates drafts", async ({
  page,
}) => {
  await pool.query('DELETE FROM "RateLimit"');
  const property = { id: randomUUID(), slug: `tour-e2e-${randomUUID()}` };
  await pool.query(
    `INSERT INTO "Property" (id,"organizationId",title,slug,status,"updatedAt",description,city,state)
    SELECT $1,"organizationId",'Imóvel de teste 360',$2,'PUBLISHED',now(),'Imóvel fictício para validar tours','São Paulo','SP'
    FROM "Property" WHERE slug='apartamento-jardim-demo'`,
    [property.id, property.slug],
  );
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("admin@imobview.test");
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.SEED_PASSWORD!);
  await page.getByRole("button", { name: "Entrar na plataforma" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto(`/app/imoveis/${property.id}`);
  await page
    .getByRole("button", { name: "Criar tour 360°", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tours\//);
  const editorUrl = page.url();
  let documentLoads = 0;
  page.on("load", () => {
    documentLoads += 1;
  });
  await expect(
    page.getByRole("heading", { name: "Como devem ser as fotos do tour?" }),
  ).toBeVisible();
  await page
    .getByText("Ver exemplos, limites e como fotografar", { exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Como capturar e exportar" }),
  ).toBeVisible();
  const invalidPhoto = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: "green" },
  })
    .jpeg()
    .toBuffer();
  await page.getByLabel("Enviar panorama").setInputFiles({
    name: "foto-comum.jpg",
    mimeType: "image/jpeg",
    buffer: invalidPhoto,
  });
  await expect(page.locator(".tour-editor").getByRole("alert")).toContainText(
    "Recebemos 1024 × 1024 pixels",
  );
  await page
    .getByText("Ver exemplos, limites e como fotografar", { exact: true })
    .click();
  for (const [index, color] of ["#064E3B", "#94A3B8"].entries()) {
    const loadsBeforeUpload = documentLoads;
    const buffer = await sharp({
      create: { width: 1024, height: 512, channels: 3, background: color },
    })
      .jpeg()
      .toBuffer();
    await page.getByLabel("Enviar panorama").setInputFiles({
      name: `panorama-${index}.jpg`,
      mimeType: "image/jpeg",
      buffer,
    });
    await expect(
      page.getByText(`panorama-${index}.jpg`, { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    expect(
      documentLoads,
      "upload should update the editor without a full document reload",
    ).toBe(loadsBeforeUpload);
    await page
      .getByRole("button", { name: "Adicionar ambiente", exact: true })
      .last()
      .click();
    await page
      .getByLabel("Nome do ambiente")
      .fill(index === 0 ? "Sala" : "Quarto");
    await page
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .click();
    await expect(
      page.getByText("Rascunho salvo.", { exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Sala · Inicial", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Iniciar tour 360°", exact: true })
    .click();
  await expect(page.locator(".psv-canvas-container canvas")).toBeVisible();
  await expect(
    page.getByText("Carregando panorama…", { exact: true }),
  ).toBeHidden();
  await page.locator(".tour-canvas").click({ position: { x: 200, y: 180 } });
  await page
    .getByLabel("Ambiente de destino")
    .selectOption({ label: "Quarto" });
  await page
    .getByRole("button", { name: "Adicionar ponto clicável", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publicar tour", exact: true })
    .click();
  await expect(
    page.getByText("Tour publicado.", { exact: false }),
  ).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page.screenshot({
    path: "test-results/tour-editor-mobile.png",
    fullPage: true,
  });
  await page.goto(`/v/${property.slug}`);
  const viewer = page
    .getByRole("region", { name: "Tour virtual 360 graus" })
    .last();
  await viewer.getByRole("button", { name: "Iniciar tour 360°" }).click();
  await viewer.getByRole("button", { name: "Ir para Quarto" }).click();
  await expect(
    viewer.getByRole("button", { name: "Quarto", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: "test-results/tour-public-mobile.png",
    fullPage: true,
  });
  await page.goto(editorUrl);
  await page.getByLabel("Nome do tour").fill("Nome ainda em rascunho");
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await expect(
    page.getByText("Rascunho salvo.", { exact: true }),
  ).toBeVisible();
  await page.goto(`/v/${property.slug}`);
  await expect(page.getByText("Nome ainda em rascunho")).toHaveCount(0);
  await page.goto(editorUrl);
  await page
    .getByRole("button", { name: "Retirar publicação", exact: true })
    .click();
  await expect(
    page.getByText("Publicação retirada.", { exact: true }),
  ).toBeVisible();
});
