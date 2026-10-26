import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { testAdminUrl } from "../database-url";
const pool = new Pool({ connectionString: testAdminUrl() });
test.afterAll(() => pool.end());
test("visitor controls measurement, creates a lead, explores rooms and requests a visit visible in CRM", async ({
  page,
  request,
}) => {
  const propertyId = randomUUID(),
    tourId = randomUUID(),
    slug = `journey-${randomUUID()}`;
  const org = (
    await pool.query('SELECT "organizationId" FROM "Property" WHERE slug=$1', [
      "apartamento-jardim-demo",
    ])
  ).rows[0].organizationId as string;
  const sceneIds = [randomUUID(), randomUUID()],
    assetIds = [randomUUID(), randomUUID()];
  const scenes = sceneIds.map((id, i) => ({
    id,
    assetId: assetIds[i],
    title: i ? "Quarto" : "Sala",
    initialYaw: 0,
    initialPitch: 0,
    hotspots: [
      {
        id: randomUUID(),
        label: i ? "Ir para Sala" : "Ir para Quarto",
        targetSceneId: sceneIds[1 - i],
        yaw: 0,
        pitch: 0,
      },
    ],
  }));
  await pool.query(
    'INSERT INTO "Property"(id,"organizationId",title,slug,status,"captureLeads","priceCents","updatedAt") VALUES($1,$2,$3,$4,\'PUBLISHED\',true,50000000,now())',
    [propertyId, org, "Casa jornada E2E", slug],
  );
  try {
    await pool.query(
      'INSERT INTO "Tour"(id,"organizationId","propertyId",title,status,published,"updatedAt") VALUES($1,$2,$3,\'Tour jornada\',\'PUBLISHED\',$4,now())',
      [
        tourId,
        org,
        propertyId,
        JSON.stringify({ initialSceneId: sceneIds[0], scenes }),
      ],
    );
    for (const [i, assetId] of assetIds.entries()) {
      const key = `${org}/${tourId}/${assetId}.jpg`;
      const image = await sharp({
        create: {
          width: 1024,
          height: 512,
          channels: 3,
          background: i ? "blue" : "green",
        },
      })
        .jpeg()
        .toBuffer();
      await request.post(
        `http://127.0.0.1:3101/storage/v1/object/imobview-tours/${key}`,
        { data: image, headers: { "Content-Type": "image/jpeg" } },
      );
      await pool.query(
        'INSERT INTO "PanoramaAsset"(id,"organizationId","tourId","storageKey","uploadKey","fileName","mimeType",size,status,"updatedAt") VALUES($1,$2,$3,$4,$5,\'demo.jpg\',\'image/jpeg\',$6,\'READY\',now())',
        [assetId, org, tourId, key, randomUUID(), image.length],
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/v/${slug}`);
    await page
      .getByRole("button", { name: "Continuar sem informar dados" })
      .click();
    await page.getByRole("button", { name: "Iniciar tour 360°" }).click();
    await expect(page.locator(".psv-canvas-container canvas")).toBeVisible();
    expect(
      (
        await pool.query(
          'SELECT count(*) FROM "TourVisit" WHERE "propertyId"=$1',
          [propertyId],
        )
      ).rows[0].count,
    ).toBe("0");
    await page.goto(`/v/${slug}?utm_source=whatsapp`);
    await page.getByLabel("Nome e sobrenome").fill("Pessoa Jornada E2E");
    await page
      .getByLabel("E-mail", { exact: true })
      .fill("jornada@example.com");
    await page.getByLabel("Telefone / WhatsApp").fill("11999999999");
    await page.getByLabel(/Quero receber contato/).check();
    await page.getByLabel(/Permito registrar ambientes/).check();
    await page.getByRole("button", { name: "Identificar e continuar" }).click();
    await page.getByRole("button", { name: "Iniciar tour 360°" }).click();
    await expect(page.locator(".tour-viewer [role=status]")).toHaveCount(0);
    await page.getByRole("button", { name: "Ir para Quarto" }).click();
    await expect(
      page.getByRole("button", { name: "Quarto", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () =>
        Number(
          (
            await pool.query(
              'SELECT count(*) FROM "TourVisit" WHERE "propertyId"=$1 AND "completedAt" IS NOT NULL',
              [propertyId],
            )
          ).rows[0].count,
        ),
      )
      .toBe(1);
    const preferred = new Date(Date.now() + 2 * 86400000)
      .toISOString()
      .slice(0, 10);
    await page.getByLabel("Data de preferência").fill(preferred);
    await page
      .getByRole("button", { name: "Solicitar visita", exact: true })
      .click();
    await expect(
      page.getByText(/Sua solicitação foi registrada/),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          Number(
            (
              await pool.query(
                'SELECT coalesce(sum(e."durationMs"),0) duration FROM "JourneyEvent" e JOIN "TourVisit" v ON v.id=e."visitId" WHERE v."propertyId"=$1',
                [propertyId],
              )
            ).rows[0].duration,
          ),
        { timeout: 15000 },
      )
      .toBeGreaterThan(0);
    const simulator = page.getByRole("region", {
      name: "Simule o financiamento",
    });
    await simulator.getByLabel("Entrada (R$)").fill("100000");
    await simulator.getByLabel("Prazo").selectOption("30");
    await simulator.getByLabel(/Price/).check();
    await simulator.getByRole("button", { name: "Simular" }).click();
    await expect(simulator.getByText("Parcela mensal")).toBeVisible();
    await expect(simulator.getByText(/Renda familiar sugerida/)).toBeVisible();
    await expect
      .poll(async () =>
        Number(
          (
            await pool.query(
              'SELECT count(*) FROM "FinancingSimulation" f JOIN "TourVisit" v ON v.id=f."visitId" WHERE v."propertyId"=$1 AND f."downPaymentCents"=10000000 AND f.system=\'PRICE\'',
              [propertyId],
            )
          ).rows[0].count,
        ),
      )
      .toBe(1);
    await page.getByRole("button", { name: "Parar medição" }).click();
    await expect(page.getByText(/Navegação sem medição/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Que bom ver você de novo!" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continuar visita" }).click();
    await expect(
      page.getByRole("button", { name: "Iniciar tour 360°" }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              'SELECT count(DISTINCT l.id)::int leads, count(v.id)::int visits FROM "Lead" l JOIN "TourVisit" v ON v."leadId"=l.id WHERE l."propertyId"=$1',
              [propertyId],
            )
          ).rows[0],
      )
      .toEqual({ leads: 1, visits: 2 });
    const leadId = (
      await pool.query('SELECT id FROM "Lead" WHERE "propertyId"=$1', [
        propertyId,
      ])
    ).rows[0].id as string;
    await pool.query('DELETE FROM "RateLimit"');
    await page.goto("/login");
    await page
      .getByLabel("E-mail", { exact: true })
      .fill("admin@imobview.test");
    await page
      .getByLabel("Senha", { exact: true })
      .fill(process.env.SEED_PASSWORD!);
    await page.getByRole("button", { name: "Entrar na plataforma" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto(`/app/leads/${leadId}`);
    await expect(
      page.getByRole("heading", { name: "Pessoa Jornada E2E", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Origem: whatsapp/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Nível de interesse" }),
    ).toBeVisible();
    await expect(page.getByText("Voltou ao imóvel (2 visitas)")).toBeVisible();
    await expect(page.getByText("Simulou financiamento")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Simulações de financiamento" }),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "30 anos" })).toBeVisible();
    // Data-subject export must work for leads with financing simulations (BigInt money).
    const exported = await page.request.get(`/api/leads/${leadId}/export`);
    expect(exported.status()).toBe(200);
    const data = await exported.json();
    expect(
      data.visits.flatMap((v: { simulations: unknown[] }) => v.simulations),
    ).toContainEqual(
      expect.objectContaining({
        downPaymentCents: "10000000",
        system: "PRICE",
      }),
    );
    await page.getByLabel("Etapa comercial").selectOption("PROPOSAL");
    await page.getByRole("button", { name: "Salvar atendimento" }).click();
    await expect(page.getByText("Lead atualizado.")).toBeVisible();
    await page.getByLabel("Situação da solicitação").selectOption("CONFIRMED");
    await page.getByRole("button", { name: "Atualizar visita" }).click();
    await expect(page.getByText("Atualizado.", { exact: true })).toBeVisible();
    await page.goto(`/app/analytics?property=${propertyId}`);
    await expect(
      page.getByRole("heading", { name: "Analytics", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/100% dos tours iniciados/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/journey-analytics-mobile.png",
      fullPage: true,
    });
  } finally {
    await pool.query('DELETE FROM "Property" WHERE id=$1', [propertyId]);
  }
});
