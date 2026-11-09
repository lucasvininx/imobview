import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { testAdminUrl } from "../database-url";
const pool = new Pool({ connectionString: testAdminUrl() });
test.afterAll(() => pool.end());

test("catalog tabs list sale and rental properties immediately, and search works locally", async ({
  page,
}) => {
  const key = randomUUID();
  const {
    rows: [org],
  } = await pool.query(
    'SELECT "organizationId" FROM "Property" WHERE slug=$1',
    ["apartamento-jardim-demo"],
  );
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  for (let i = 0; i < ids.length; i++)
    await pool.query(
      'INSERT INTO "Property"(id,"organizationId",title,slug,status,type,purpose,city,state,neighborhood,"priceCents",area,bedrooms,bathrooms,"parkingSpaces","isDemo","publishedAt","updatedAt") VALUES($1,$2,$3,$4,\'PUBLISHED\',\'HOUSE\',$5::"Purpose",\'Campinas\',\'SP\',\'Cambuí\',300000,120,3,2,4,true,now(),now())',
      [
        ids[i],
        org.organizationId,
        `Casa catálogo ${key} ${i}`,
        `catalog-ui-${ids[i]}`,
        i === 0 ? "SALE" : "RENT",
      ],
    );
  try {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Catálogo de imóveis" })
      .getByRole("link", { name: "Alugar", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Imóveis para alugar", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: `Casa catálogo ${key} 1`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".listing-purpose").filter({ hasText: "À venda" }),
    ).toHaveCount(0);
    await page
      .getByLabel("Descreva o imóvel que procura")
      .fill("casa em Campinas");
    await page
      .getByRole("button", { name: "Encontrar imóvel", exact: true })
      .click();
    await expect(page.getByText("Critérios aplicados")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: `Casa catálogo ${key} 1`,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Catálogo de imóveis" })
      .getByRole("link", { name: "Comprar", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Imóveis à venda", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Descreva o imóvel que procura")).toHaveValue(
      "",
    );
    await expect(
      page.getByRole("heading", {
        name: `Casa catálogo ${key} 0`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".listing-purpose").filter({ hasText: "Para alugar" }),
    ).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Catálogo de imóveis" })
      .getByRole("link", { name: "Todos", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Todos os imóveis", exact: true }),
    ).toBeVisible();
    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page
          .getByRole("button", { name: "Ativar modo escuro" })
          .first()
          .click();
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/catalog-${theme}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
      await page.setViewportSize({ width: 1280, height: 900 });
    }
  } finally {
    await pool.query('DELETE FROM "Property" WHERE id=ANY($1::uuid[])', [ids]);
  }
});

test("CRM drag saves the exact stage, preserves notes, and restores the card on a failed save", async ({
  page,
}) => {
  const id = randomUUID(),
    name = `Lead arrastar ${id.slice(0, 8)}`;
  const {
    rows: [org],
  } = await pool.query(
    'SELECT "organizationId" FROM "Property" WHERE slug=$1',
    ["apartamento-jardim-demo"],
  );
  await pool.query(
    "INSERT INTO \"Lead\"(id,\"organizationId\",name,email,phone,notes,source,\"updatedAt\") VALUES($1,$2,$3,$4,'11999999999','Preservar anotações','manual',now())",
    [id, org.organizationId, name, `${id}@example.com`],
  );
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
    await page.goto("/app/crm");
    const card = page.getByRole("article", {
      name: `Lead ${name}`,
      exact: true,
    });
    const newColumn = page.getByRole("region", {
      name: "Novo lead",
      exact: true,
    });
    const interested = page.getByRole("region", {
      name: "Interessado",
      exact: true,
    });
    // Scroll the target into view and drag using HTML drag events, as the desktop browser does.
    await page.route("**/app/crm", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    const dragData = await page.evaluateHandle(() => new DataTransfer());
    await card.dispatchEvent("dragstart", { dataTransfer: dragData });
    await interested.dispatchEvent("dragover", { dataTransfer: dragData });
    await interested.dispatchEvent("drop", { dataTransfer: dragData });
    await expect(
      page.locator(".crm-board-help").getByRole("alert"),
    ).toContainText("Falha de conexão");
    await expect(
      newColumn.getByRole("article", { name: `Lead ${name}`, exact: true }),
    ).toBeVisible();
    await page.unroute("**/app/crm");
    const tourStarted = page.getByRole("region", {
      name: "Tour iniciado",
      exact: true,
    });
    await card.dragTo(tourStarted);
    await expect(
      page.locator(".crm-board-help").getByRole("status"),
    ).toContainText("status alterado para Tour iniciado");
    const tourCompleted = page.getByRole("region", {
      name: "Tour concluído",
      exact: true,
    });
    const handle = card.getByRole("button", {
      name: `Arrastar ${name}`,
      exact: true,
    });
    const handleBox = await handle.boundingBox(),
      targetBox = await tourCompleted.boundingBox();
    expect(handleBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox!.x + targetBox!.width / 2,
      targetBox!.y + 60,
      { steps: 12 },
    );
    await page.mouse.up();
    await expect(
      page.locator(".crm-board-help").getByRole("status"),
    ).toContainText("status alterado para Tour concluído");
    await card.dispatchEvent("dragstart", { dataTransfer: dragData });
    await interested.dispatchEvent("dragover", { dataTransfer: dragData });
    await interested.dispatchEvent("drop", { dataTransfer: dragData });
    await expect(page.getByRole("status")).toContainText(
      "status alterado para Interessado",
    );
    await expect(
      interested.getByRole("article", { name: `Lead ${name}`, exact: true }),
    ).toHaveCount(1);
    await page.reload();
    await expect(
      interested.getByRole("article", { name: `Lead ${name}`, exact: true }),
    ).toHaveCount(1);
    await card.getByLabel(`Mover ${name} para`).selectOption("PROPOSAL");
    await expect(page.getByRole("status")).toContainText(
      "status alterado para Proposta",
    );
    const {
      rows: [saved],
    } = await pool.query(
      'SELECT stage,notes,"proposalAt" FROM "Lead" WHERE id=$1',
      [id],
    );
    expect(saved.stage).toBe("PROPOSAL");
    expect(saved.notes).toBe("Preservar anotações");
    expect(saved.proposalAt).not.toBeNull();
    await page.locator(".crm-board").evaluate((element) => {
      element.scrollLeft = 0;
    });
    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page.getByRole("button", { name: "Ativar modo escuro" }).click();
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        (document.activeElement as HTMLElement)?.blur();
      });
      await page.screenshot({
        path: `test-results/crm-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  } finally {
    await pool.query('DELETE FROM "Lead" WHERE id=$1', [id]);
  }
});
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
      .getByRole("button", { name: "Quero falar sobre o aluguel", exact: true })
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
