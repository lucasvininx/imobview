import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { testAdminUrl } from "../database-url";
const pool = new Pool({ connectionString: testAdminUrl() });
test.afterAll(() => pool.end());
test.use({ actionTimeout: 10000 });

test("notification inbox filters older unread items, persists read state and stays usable on mobile", async ({
  page,
}) => {
  const {
    rows: [owner],
  } = await pool.query(
    'SELECT u.id,p."organizationId" FROM "User" u CROSS JOIN "Property" p WHERE u.email=$1 AND p.slug=$2',
    ["admin@imobview.test", "apartamento-jardim-demo"],
  );
  const member = { id: randomUUID() };
  await pool.query(
    'INSERT INTO "User"(id,name,email,"updatedAt") VALUES($1,$2,$3,now())',
    [member.id, "Corretor da central", member.id + "@example.test"],
  );
  await pool.query(
    'INSERT INTO "OrganizationMember"("organizationId","userId",role) VALUES($1,$2,$3)',
    [owner.organizationId, member.id, "MEMBER"],
  );
  const leadId = randomUUID(),
    oldId = randomUUID(),
    visitId = randomUUID(),
    otherId = randomUUID();
  const title = "Visita de teste " + visitId.slice(0, 6);
  await pool.query('DELETE FROM "RateLimit"');
  await pool.query(
    'INSERT INTO "Lead"(id,"organizationId",name,email,phone,"updatedAt") VALUES($1,$2,$3,$4,$5,now())',
    [
      leadId,
      owner.organizationId,
      "Cliente da central",
      "central@example.test",
      "11999999999",
    ],
  );
  await pool.query(
    'UPDATE "Notification" SET "readAt"=now() WHERE "userId"=$1',
    [owner.id],
  );
  const insert =
    'INSERT INTO "Notification"(id,"organizationId","userId","leadId",kind,title,message,"createdAt","readAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)';
  for (let index = 0; index < 32; index++)
    await pool.query(insert, [
      randomUUID(),
      owner.organizationId,
      owner.id,
      leadId,
      "LEAD",
      "Contato já lido " + index,
      "Histórico de contatos da imobiliária.",
      new Date(Date.now() - 1000 * (index + 10)),
      new Date(),
    ]);
  await pool.query(insert, [
    oldId,
    owner.organizationId,
    owner.id,
    leadId,
    "TOUR_RETURNED",
    "Retorno antigo não lido",
    "Cliente voltou ao tour.",
    new Date(Date.now() - 2 * 86400000),
    null,
  ]);
  await pool.query(insert, [
    visitId,
    owner.organizationId,
    owner.id,
    leadId,
    "VISIT_CONFIRMED",
    title,
    "Visita confirmada · amanhã às 14h30.",
    new Date(),
    null,
  ]);
  await pool.query(insert, [
    otherId,
    owner.organizationId,
    member.id,
    leadId,
    "LEAD",
    "Notificação de outro corretor",
    "Este aviso é privado.",
    new Date(),
    null,
  ]);
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
    const bell = page.getByRole("button", {
      name: "Notificações: 2 não lidas",
      exact: true,
    });
    await bell.click();
    const panel = page.getByRole("region", {
      name: "Notificações",
      exact: true,
    });
    await expect(panel.getByText(title, { exact: true })).toBeVisible();
    await expect(
      panel.getByText("Retorno antigo não lido", { exact: true }),
    ).toHaveCount(0);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const bounds = await panel.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
      await expect(
        panel.getByRole("button", {
          name: "Marcar todas como lidas",
          exact: true,
        }),
      ).toBeInViewport();
      await page.screenshot({
        path: `test-results/notifications-${width}.png`,
      });
    }
    await panel.getByRole("button", { name: "Não lidas", exact: true }).click();
    await expect(
      panel.getByText("Retorno antigo não lido", { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByText("Notificação de outro corretor", { exact: true }),
    ).toHaveCount(0);
    await panel
      .getByRole("button", {
        name: "Marcar como lida: Retorno antigo não lido",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Notificações: 1 não lidas",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      panel.getByText("Retorno antigo não lido", { exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await pool.query('SELECT "readAt" FROM "Notification" WHERE id=$1', [
          oldId,
        ])
      ).rows[0].readAt,
    ).not.toBeNull();
    await panel
      .getByRole("button", { name: "Marcar todas como lidas", exact: true })
      .click();
    await expect(
      panel.getByText("Tudo lido por aqui", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await pool.query('SELECT "readAt" FROM "Notification" WHERE id=$1', [
          otherId,
        ])
      ).rows[0].readAt,
    ).toBeNull();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Notificações: 0 não lidas",
        exact: true,
      }),
    ).toBeFocused();
    await page.reload();
    await page
      .getByRole("button", { name: "Notificações: 0 não lidas", exact: true })
      .click();
    await expect(panel.getByText(title, { exact: true })).toBeVisible();
    await panel.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(new RegExp(`/app/leads/${leadId}$`));
    await expect(panel).toHaveCount(0);
  } finally {
    await pool.query('DELETE FROM "Lead" WHERE id=$1', [leadId]);
    await pool.query('DELETE FROM "User" WHERE id=$1', [member.id]);
  }
});
