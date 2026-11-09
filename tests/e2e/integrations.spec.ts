import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { testAdminUrl } from "../database-url";
const pool = new Pool({ connectionString: testAdminUrl() });
test.use({ actionTimeout: 10000 });
test.afterAll(() => pool.end());
test("agency follows integration guides, protects Google OAuth state and schedules exact local visits", async ({
  page,
  context,
}) => {
  const {
    rows: [org],
  } = await pool.query(
    'SELECT "organizationId" FROM "Property" WHERE slug=$1',
    ["apartamento-jardim-demo"],
  );
  const leadId = randomUUID(),
    name = "Cliente agenda " + leadId.slice(0, 6);
  await pool.query(
    'INSERT INTO "Lead"(id,"organizationId",name,email,phone,"updatedAt") VALUES($1,$2,$3,$4,$5,now())',
    [leadId, org.organizationId, name, "agenda@example.test", "11999999999"],
  );
  await pool.query('DELETE FROM "RateLimit"');
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
    await page.getByRole("link", { name: "Integrações", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Integrações", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".integration-service")).toHaveCount(3);
    await expect(page.locator(".integration-form")).toHaveCount(0);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/integration-hub-${width}.png`,
        fullPage: true,
      });
    }
    for (const [title, slug, text] of [
      [
        "Google Agenda",
        "google",
        "Passo a passo para conectar o Google Agenda",
      ],
      [
        "WhatsApp Business",
        "whatsapp",
        "Passo a passo para conectar o WhatsApp",
      ],
      ["E-mail com Resend", "email", "Passo a passo para conectar o e-mail"],
    ]) {
      await page
        .getByRole("link", { name: `Configurar ${title}`, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/app/integracoes/${slug}$`));
      await expect(
        page.getByRole("heading", { name: title, level: 1 }),
      ).toBeVisible();
      await expect(page.locator(".integration-card")).toHaveCount(1);
      await page.getByText(text, { exact: true }).click();
      await page
        .getByRole("link", { name: "Todas as integrações", exact: true })
        .click();
    }
    await page
      .getByRole("link", { name: "Configurar Google Agenda", exact: true })
      .click();
    await page
      .getByText("Passo a passo para conectar o Google Agenda", { exact: true })
      .click();
    await expect(
      page.getByText(/Uma chave de API isolada não autoriza/),
    ).toBeVisible();
    await expect(page.getByText(/Google Calendar API/)).toBeVisible();
    await page
      .getByText("Configurar aplicativo Google da imobiliária", { exact: true })
      .click();
    await page
      .getByLabel("Client ID do Google", { exact: true })
      .fill("testing.apps.googleusercontent.com");
    await page
      .getByLabel("Client Secret do Google", { exact: true })
      .fill("ui-test-client-secret");
    await page
      .getByRole("button", { name: "Salvar aplicativo Google" })
      .click();
    await expect(
      page.getByText(
        "Aplicativo salvo. Agora cada corretor pode conectar sua conta Google.",
      ),
    ).toBeVisible();
    await expect(
      page.getByLabel("Client Secret do Google", { exact: true }),
    ).toHaveValue("");
    expect(await page.content()).not.toContain("ui-test-client-secret");
    await expect(
      page.getByRole("link", { name: "Conectar com Google", exact: true }),
    ).toHaveAttribute("href", "/api/integrations/google/connect");
    const redirect = await context.request.get(
      "/api/integrations/google/connect",
      { maxRedirects: 0 },
    );
    expect(redirect.status()).toBe(307);
    const auth = new URL(redirect.headers().location);
    expect(auth.origin).toBe("https://accounts.google.com");
    expect(auth.searchParams.get("code_challenge_method")).toBe("S256");
    expect(auth.searchParams.get("state")).toBeTruthy();
    const cookie = (
      await context.cookies(
        "http://localhost:3100/api/integrations/google/callback",
      )
    ).find((item) => item.name === "imobview.google-oauth");
    expect(cookie?.httpOnly).toBe(true);
    await page.goto(
      "/api/integrations/google/callback?state=forged&code=forged",
    );
    await expect(page).toHaveURL(/google=expired/);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM "CalendarConnection" WHERE "organizationId"=$1',
          [org.organizationId],
        )
      ).rows[0].count,
    ).toBe(0);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/integrations-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto("/app/agenda");
    await page.getByText("Agendar nova visita", { exact: true }).click();
    const form = page.locator(".visit-schedule-form").first();
    await form.getByLabel("Cliente", { exact: true }).selectOption(leadId);
    const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    await form.getByLabel("Data e horário exatos").fill(date + "T14:30");
    await form
      .getByRole("button", { name: "Agendar visita", exact: true })
      .click();
    await expect(
      page.getByText(
        "Visita confirmada. Acompanhe os envios e a sincronização em Integrações.",
      ),
    ).toBeVisible();
    const {
      rows: [visit],
    } = await pool.query(
      'SELECT id,"scheduledStartAt",status FROM "VisitRequest" WHERE "leadId"=$1',
      [leadId],
    );
    expect(visit.scheduledStartAt.toISOString()).toBe(date + "T17:30:00.000Z");
    expect(visit.status).toBe("CONFIRMED");
    const article = page.locator(`#visita-${visit.id}`);
    await article
      .getByLabel("Situação da solicitação")
      .selectOption("CANCELLED");
    await article.getByRole("button", { name: "Atualizar visita" }).click();
    await expect(
      article.getByText("Atualizado.", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await pool.query('SELECT status FROM "VisitRequest" WHERE id=$1', [
          visit.id,
        ])
      ).rows[0].status,
    ).toBe("CANCELLED");
  } finally {
    await pool.query('DELETE FROM "Lead" WHERE id=$1', [leadId]);
    await pool.query(
      'DELETE FROM "OrganizationIntegration" WHERE "organizationId"=$1',
      [org.organizationId],
    );
  }
});
