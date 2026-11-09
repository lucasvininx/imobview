import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { testAdminUrl } from "../database-url";

const pool = new Pool({ connectionString: testAdminUrl() });
test.afterAll(() => pool.end());

test("home opens at the top with search visible and preserves the document on search", async ({
  page,
}) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Um lugar para chamar de seu." }),
    ).toBeVisible();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    const button = page
      .locator(".home-search")
      .getByRole("button", { name: "Encontrar imóvel", exact: true });
    await expect(button).toBeInViewport();
    if (width > 760) {
      const photo = await page.locator(".market-hero-photo").boundingBox();
      const search = await page.locator(".home-search").boundingBox();
      expect(
        Math.abs(photo!.y + photo!.height - search!.y - search!.height),
      ).toBeLessThan(2);
    }
    await page.screenshot({
      path: `test-results/home-polished-${width}.png`,
      fullPage: true,
    });
  }
  await page.evaluate(() => {
    document.documentElement.dataset.navigationMarker = "same-document";
  });
  await page
    .getByLabel("Descreva o imóvel que procura")
    .fill("casa em Campinas");
  await page
    .getByRole("button", { name: "Encontrar imóvel", exact: true })
    .click();
  await expect(page).toHaveURL(/\/buscar\?/);
  expect(
    await page.locator("html").getAttribute("data-navigation-marker"),
  ).toBe("same-document");
  await page.goto("/login");
  await expect(page.locator(".theme-toggle")).toHaveCount(0);
  await page.getByRole("link", { name: "Voltar ao site" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator(".footer-instagram")).toHaveAttribute(
    "href",
    "https://www.instagram.com/imobview_/",
  );
  await expect(page.locator(".footer-instagram")).toHaveText("");
  await page.goto("/contato");
  await expect(page.getByText(/Enquanto o atendimento por e-mail/)).toHaveCount(
    0,
  );
  await expect(page.locator("main .social-icon-link")).toHaveText("");
});

test("a rental without a tour offers contact independently of financing or agency channels", async ({
  page,
}) => {
  const {
    rows: [org],
  } = await pool.query(
    'SELECT "organizationId" FROM "Property" WHERE slug=$1',
    ["apartamento-jardim-demo"],
  );
  const id = randomUUID();
  const slug = `rent-contact-${id}`;
  await pool.query(
    `INSERT INTO "Property"(id,"organizationId",title,slug,status,type,purpose,city,state,neighborhood,"priceCents",area,bedrooms,bathrooms,"parkingSpaces","isDemo","publishedAt","updatedAt")
    VALUES($1,$2,'Locação com atendimento',$3,'PUBLISHED','HOUSE','RENT','Campinas','SP','Centro',250000,90,2,1,1,false,now(),now())`,
    [id, org.organizationId, slug],
  );
  try {
    await page.goto(`/v/${slug}`);
    await expect(
      page.getByRole("link", {
        name: "Tenho interesse em alugar",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Quero alugar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Fale sobre a locação" }),
    ).toBeVisible();
    await expect(
      page.locator("#contato-imovel input[name=name]"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Quero falar sobre o aluguel" }),
    ).toBeVisible();
    await expect(page.locator("#financiamento")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Explorar tour 360°" }),
    ).toHaveCount(0);
  } finally {
    await pool.query('DELETE FROM "Property" WHERE id=$1', [id]);
  }
});
