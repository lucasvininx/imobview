import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { SMTPServer } from "smtp-server";
import { testAdminUrl } from "../database-url";
const password = process.env.SEED_PASSWORD!;
const pool = new Pool({ connectionString: testAdminUrl() });
test("unsaved-change protection re-arms after saving an edit", async ({
  page,
}) => {
  const result = await pool.query('SELECT id FROM "Property" WHERE slug=$1', [
    "apartamento-jardim-demo",
  ]);
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("admin@imobview.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar na plataforma" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/imoveis/" + result.rows[0].id);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar imóvel", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Imóvel salvo com sucesso",
  );
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page
    .getByLabel("Título do imóvel")
    .fill("Alteração que ainda não foi salva");
  const dialogPromise = page.waitForEvent("dialog", { timeout: 5000 });
  const reload = page.reload({ timeout: 2000 }).catch(() => null);
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await reload;
  await expect(page.getByLabel("Título do imóvel")).toHaveValue(
    "Alteração que ainda não foi salva",
  );
});
test.afterAll(async () => pool.end());
test.beforeEach(async () => {
  await pool.query('DELETE FROM "RateLimit"');
});
test("public site and gallery work at desktop and mobile sizes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "A próxima visita começa aqui." }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto("/demonstracao");
  await expect(
    page.getByRole("heading", { name: "Conheça o tour 360°" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Agendar demonstração" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("protected routes reject anonymous users and invalid credentials", async ({
  page,
  request,
}) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("E-mail", { exact: true }).fill("admin@imobview.test");
  await page.getByLabel("Senha", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Entrar na plataforma" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "E-mail ou senha inválidos",
  );
  const signup = await request.post("/api/auth/sign-up/email", {
    data: {
      email: "attacker@imobview.test",
      password: "unwanted-account-123",
      name: "Attacker",
    },
  });
  expect(signup.ok()).toBe(false);
});
test("owner creates, edits, publishes, shares, archives and signs out", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("admin@imobview.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar na plataforma" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Novo imóvel", exact: true }).click();
  const title = "Casa teste E2E " + Date.now();
  await page.getByLabel("Título do imóvel").fill(title);
  await page
    .getByLabel("Descrição")
    .fill("Uma casa fictícia com iluminação natural e espaços integrados.");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Cidade", { exact: true }).fill("São Paulo");
  await page.getByLabel("Preço em reais").fill("750000,99");
  await page.getByLabel("Área útil (m²)").fill("120");
  await page.getByLabel("Quartos", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar imóvel", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Imóvel salvo com sucesso",
  );
  await page.getByLabel("Título do imóvel").fill(title + " editada");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar imóvel", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    title + " editada",
  );
  await page
    .getByRole("button", { name: "Publicar imóvel", exact: true })
    .click();
  const publicLink = page.getByRole("link", { name: "Abrir página pública" });
  await expect(publicLink).toBeVisible();
  const publicUrl = await publicLink.getAttribute("href");
  const editUrl = page.url();
  await publicLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    title + " editada",
  );
  await page.goto(editUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Arquivar imóvel", exact: true })
    .click();
  await expect(
    page.getByText("Este imóvel está arquivado e não é exibido publicamente."),
  ).toBeVisible();
  await page.goto(publicUrl!);
  await expect(
    page.getByRole("heading", { name: "Este endereço não está disponível." }),
  ).toBeVisible();
  await page.goto("/app/configuracoes");
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});
test("organization A cannot open a private property owned by B", async ({
  page,
}) => {
  const result = await pool.query('SELECT id FROM "Property" WHERE slug=$1', [
    "imovel-privado-b",
  ]);
  const id = result.rows[0].id as string;
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("admin@imobview.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar na plataforma" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/imoveis/" + id);
  await expect(
    page.getByRole("heading", { name: "Este endereço não está disponível." }),
  ).toBeVisible();
  await expect(page.getByText("Imóvel privado da Organização B")).toHaveCount(
    0,
  );
  await page.goto("/v/imovel-privado-b");
  await expect(
    page.getByRole("heading", { name: "Este endereço não está disponível." }),
  ).toBeVisible();
});
test("forged session cookies do not grant access", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "forged",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});
test("dashboard and property form stay usable on mobile and tablet", async ({
  page,
}) => {
  await page.goto("/login");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  await page.getByLabel("E-mail", { exact: true }).fill("admin@imobview.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar na plataforma" }).click();
  await expect(page).toHaveURL(/\/app$/);
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ["/app", "/app/imoveis", "/app/imoveis/novo"]) {
      await page.goto(route);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
});

test("authentication rejects hostile origins and throttles repeated attempts", async ({
  request,
}) => {
  const csrf = await request.post("/api/auth/sign-in/email", {
    headers: { Origin: "https://untrusted.example" },
    data: { email: "admin@imobview.test", password },
  });
  expect(csrf.status()).toBe(403);
  // The rejected origin also consumes an attempt; measure the quota independently.
  await pool.query('DELETE FROM "RateLimit"');
  for (let index = 0; index < 6; index++) {
    const response = await request.post("/api/auth/sign-in/email", {
      data: { email: "admin@imobview.test", password: "invalid-password" },
    });
    expect(response.status()).toBe(index === 5 ? 429 : 401);
  }
});

test("password recovery sends SMTP email and reset tokens are single-use", async ({
  page,
}) => {
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
    await page.goto("/recuperar-senha");
    await page
      .getByLabel("E-mail", { exact: true })
      .fill("outro@imobview.test");
    await page
      .getByRole("button", { name: "Enviar link de recuperação" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Se o e-mail estiver cadastrado",
    );
    await expect.poll(() => messages.length).toBe(1);
    const decoded = messages[0].replace(/=\r?\n/g, "").replace(/=3D/g, "=");
    const url = decoded.match(
      /http:\/\/localhost:3100\/api\/auth\/reset-password\/[^\s<>]+/,
    )?.[0];
    expect(url).toBeTruthy();
    await page.goto(url!);
    await page.getByLabel("Nova senha").fill(password);
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByRole("status")).toContainText("Senha atualizada");
    await page.goto(url!);
    await expect(
      page.getByText("Link inválido.", { exact: false }),
    ).toBeVisible();
  } finally {
    await new Promise<void>((resolve) => smtp.close(resolve));
  }
});
