import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { testAdminUrl } from "../database-url";
const pool = new Pool({ connectionString: testAdminUrl() });
test.afterAll(() => pool.end());
test("visitor searches published stock, sends interest and the agency completes the client profile", async ({
  page,
}) => {
  const id = randomUUID(),
    slug = `marketplace-${id}`,
    email = `cliente-${id}@example.com`;
  const {
    rows: [org],
  } = await pool.query(
    'SELECT "organizationId" FROM "Property" WHERE slug=$1',
    ["apartamento-jardim-demo"],
  );
  await pool.query(
    "INSERT INTO \"Property\"(id,\"organizationId\",title,slug,status,type,purpose,city,state,neighborhood,bedrooms,bathrooms,\"parkingSpaces\",\"priceCents\",area,\"publishedAt\",\"updatedAt\") VALUES($1,$2,$3,$4,'PUBLISHED','HOUSE','RENT','Campinas','SP','Cambuí',3,2,4,350000,180,now(),now())",
    [id, org.organizationId, "Casa para nova busca E2E", slug],
  );
  try {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page
      .getByRole("button", { name: "Ativar modo escuro" })
      .first()
      .click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page
      .getByRole("button", { name: "Ativar modo claro" })
      .first()
      .click();
    await page
      .getByLabel("Descreva o imóvel que procura")
      .fill(
        "alugar casa em Campinas no bairro Cambuí com três quartos dois banheiros quatro vagas até 4 mil",
      );
    await page
      .getByRole("button", { name: "Encontrar imóvel", exact: true })
      .click();
    await expect(page.getByText("Critérios aplicados")).toBeVisible();
    await page
      .getByRole("link")
      .filter({
        has: page.getByRole("heading", { name: "Casa para nova busca E2E" }),
      })
      .click();
    await page
      .getByLabel("Seu nome completo", { exact: true })
      .fill("Cliente Portal E2E");
    await page.getByLabel("Seu e-mail", { exact: true }).fill(email);
    await page.getByLabel("Seu celular", { exact: true }).fill("11999999999");
    await page.getByLabel(/Autorizo o envio dos meus dados/).check();
    await page
      .getByRole("button", { name: "Tenho interesse", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Interesse enviado!");
    await page.goto("/login");
    await page
      .getByLabel("E-mail", { exact: true })
      .fill("admin@imobview.test");
    await page
      .getByLabel("Senha", { exact: true })
      .fill(process.env.SEED_PASSWORD!);
    await page.getByRole("button", { name: "Entrar na plataforma" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.getByRole("link", { name: "Leads", exact: true }).click();
    await page.getByLabel("Buscar cliente").fill(email);
    await page.getByRole("button", { name: "Filtrar", exact: true }).click();
    await expect(
      page.getByText("A completar", { exact: true }).last(),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Cliente Portal E2E", exact: true })
      .click();
    await page.getByLabel("CPF", { exact: true }).fill("529.982.247-25");
    await page
      .getByLabel("Data de nascimento", { exact: true })
      .fill("1990-01-01");
    await page
      .getByRole("button", { name: "Salvar cadastro", exact: true })
      .click();
    await expect(
      page.getByText("Cadastro completo", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "CRM", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "CRM", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Analytics", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "O movimento dos seus imóveis" }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/marketplace-analytics-light.png",
      fullPage: true,
    });
  } finally {
    await pool.query('DELETE FROM "Property" WHERE id=$1', [id]);
  }
});
test("agency creates a client without an assigned property", async ({
  page,
}) => {
  const email = `manual-${randomUUID()}@example.com`;
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
    await page.goto("/app/leads/novo");
    await page
      .getByLabel("Nome completo", { exact: true })
      .fill("Cliente Manual E2E");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Criar lead", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Cliente Manual E2E", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Cadastro a completar", { exact: true }),
    ).toBeVisible();
  } finally {
    await pool.query('DELETE FROM "Lead" WHERE email=$1', [email]);
  }
});
