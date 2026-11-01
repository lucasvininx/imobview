import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { testAdminUrl } from "../database-url";
const pool = new Pool({ connectionString: testAdminUrl() });
test.afterAll(async () => pool.end());

test("agency describes the building and visitors explore the 3D view and sun", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await pool.query('DELETE FROM "RateLimit"');
  const property = { id: randomUUID(), slug: `vista-3d-${randomUUID()}` };
  await pool.query(
    `INSERT INTO "Property" (id,"organizationId",title,slug,status,"updatedAt",description,city,state,type,"priceCents",area)
    SELECT $1,"organizationId",'Apartamento vista 3D',$2,'PUBLISHED',now(),'Apartamento fictício para validar a vista 3D','São Paulo','SP','APARTMENT',90000000,90
    FROM "Property" WHERE slug='apartamento-jardim-demo'`,
    [property.id, property.slug],
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
    await expect(page).toHaveURL(/\/app$/, { timeout: 15000 });
    await page.goto(`/app/imoveis/${property.id}`);
    const form = page.locator("form", {
      has: page.getByRole("heading", { name: "Vista 3D externa e sol" }),
    });
    await form.getByLabel("Mostrar a vista 3D na página do imóvel").check();
    await form.getByLabel("Nome do empreendimento").fill("Residencial E2E");
    await form.getByLabel("Coordenadas do prédio").fill("endereço sem números");
    await form.getByRole("button", { name: "Salvar vista 3D" }).click();
    await expect(form.getByRole("alert")).toContainText("coordenadas");
    await form.getByLabel("Coordenadas do prédio").fill("-23.5613, -46.6565");
    await form.getByLabel("Torres no condomínio").fill("2");
    await form.getByLabel("Andares por torre").fill("10");
    await form.getByLabel("Andar do apartamento").fill("6");
    await form
      .getByLabel("Para onde as janelas da sala estão voltadas")
      .selectOption("N");
    await form.getByLabel("Piscina").check();
    await form.getByRole("button", { name: "Salvar vista 3D" }).click();
    await expect(form.getByRole("status")).toContainText("Vista 3D atualizada");

    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/v/${property.slug}`);
      const view = page.getByRole("region", { name: "Vista 3D do condomínio" });
      await view.getByRole("button", { name: "Explorar em 3D" }).click();
      await expect(view.locator("canvas")).toBeVisible();
      await expect(view.getByText("Residencial E2E")).toBeVisible();
      await view.getByRole("button", { name: "Inverno" }).click();
      await view.getByRole("slider", { name: "Horário" }).fill("720");
      await expect(
        view.getByText(/Fachada norte · \dh\d* de sol direto/),
      ).toBeVisible();
      await expect(
        view.getByText("Sol batendo na fachada do apartamento agora."),
      ).toBeVisible();
      await view.getByRole("button", { name: "Verão" }).click();
      await expect(
        view.getByText("Fachada norte · sem sol direto neste dia"),
      ).toBeVisible();
      await view.getByRole("button", { name: "Ver o apartamento" }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.screenshot({
      path: "test-results/exterior-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await pool.query(
      'UPDATE "Property" SET status=\'ARCHIVED\',"archivedAt"=now() WHERE id=$1',
      [property.id],
    );
  }
});
