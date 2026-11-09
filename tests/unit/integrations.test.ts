import { afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ db: {} }));
import { seal, unseal } from "@/features/integrations/crypto";
import { localDateTime } from "@/features/integrations/schema";
import {
  verifyMeta,
  verifyResend,
  webhookFailure,
} from "@/features/integrations/webhooks";
import {
  deleteGoogleEvent,
  googleAuthorization,
  googleCalendars,
  putGoogleEvent,
  sendEmail,
  validateWhatsApp,
} from "@/features/integrations/providers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("encrypts secrets with fresh nonces and rejects ciphertext moved between tenants or users", () => {
  vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", "a".repeat(64));
  const cipher = seal({ apiKey: "private-test-value" }, "tenant-a:EMAIL");
  expect(cipher).not.toContain("private-test-value");
  expect(seal({ apiKey: "private-test-value" }, "tenant-a:EMAIL")).not.toBe(
    cipher,
  );
  expect(unseal(cipher, "tenant-a:EMAIL")).toEqual({
    apiKey: "private-test-value",
  });
  expect(() => unseal(cipher, "tenant-b:EMAIL")).toThrow();
  expect(() => unseal(cipher, "tenant-a:GOOGLE")).toThrow();
  expect(() =>
    unseal(cipher.slice(0, -4) + "AAAA", "tenant-a:EMAIL"),
  ).toThrow();
});
it("resolves Brazilian local appointments independently of the server timezone and rejects invalid or ambiguous times", () => {
  expect(
    localDateTime("2026-11-20T10:30", "America/Sao_Paulo").toISOString(),
  ).toBe("2026-11-20T13:30:00.000Z");
  expect(
    localDateTime("2026-11-20T10:30", "America/Manaus").toISOString(),
  ).toBe("2026-11-20T14:30:00.000Z");
  expect(() =>
    localDateTime("2026-02-30T10:30", "America/Sao_Paulo"),
  ).toThrow();
  expect(() => localDateTime("2026-11-01T01:30", "America/New_York")).toThrow(
    /ambíguo/,
  );
  expect(() => localDateTime("2026-03-08T02:30", "America/New_York")).toThrow(
    /não existe/,
  );
});
it("binds Google OAuth to state and PKCE with offline access", () => {
  const url = new URL(
    googleAuthorization(
      "client.apps.googleusercontent.com",
      "https://example.com/callback",
      "csrf-state",
      "pkce-challenge",
    ),
  );
  expect(url.searchParams.get("state")).toBe("csrf-state");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toBe("pkce-challenge");
  expect(url.searchParams.get("access_type")).toBe("offline");
});
it("paginates writable calendars instead of silently truncating the destination list", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        items: [{ id: "a", summary: "Principal" }],
        nextPageToken: "next",
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ items: [{ id: "b", summary: "Equipe" }] }),
    );
  vi.stubGlobal("fetch", fetcher);
  expect(await googleCalendars("access-test")).toHaveLength(2);
  expect(String(fetcher.mock.calls[1][0])).toContain("pageToken=next");
});
it("updates a deterministic Google event after a retried insert and treats an already-deleted event as cancelled", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 409 }))
    .mockResolvedValueOnce(
      Response.json({
        id: "abcdef",
        htmlLink: "https://www.google.com/calendar/event?eid=test",
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetcher);
  await putGoogleEvent("token", "calendar@example.com", "abcdef", {
    summary: "Visita",
    description: "Atendimento",
    location: "Campinas",
    start: { dateTime: "2026-11-20T13:00:00Z", timeZone: "America/Sao_Paulo" },
    end: { dateTime: "2026-11-20T14:00:00Z", timeZone: "America/Sao_Paulo" },
  });
  expect(fetcher.mock.calls[1][1].method).toBe("PATCH");
  expect(JSON.parse(fetcher.mock.calls[1][1].body).status).toBe("confirmed");
  await expect(
    deleteGoogleEvent("token", "calendar@example.com", "abcdef"),
  ).resolves.toBeUndefined();
});
it("uses Resend idempotency keys and a single recipient per notification", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ id: "message-id" }));
  vi.stubGlobal("fetch", fetcher);
  await sendEmail(
    {
      apiKey: "test-key",
      fromName: "Agência",
      fromEmail: "visitas@example.com",
      replyTo: "",
      webhookSecret: "",
      notifyTeam: true,
      notifyClient: false,
    },
    "person@example.com",
    "Visita",
    "Texto",
    "unique-job",
  );
  expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
    "unique-job",
  );
  expect(JSON.parse(fetcher.mock.calls[0][1].body).to).toEqual([
    "person@example.com",
  ]);
});
it("rejects forged, stale or altered delivery webhooks", () => {
  const body = JSON.stringify({ type: "email.delivered" });
  const now = Date.now(),
    stamp = String(Math.floor(now / 1000));
  const secret =
    "whsec_" + Buffer.from("webhook-test-secret").toString("base64");
  const signature = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
    .update(`event.${stamp}.${body}`)
    .digest("base64");
  const headers = new Headers({
    "svix-id": "event",
    "svix-timestamp": stamp,
    "svix-signature": `v1,invalid v1,${signature}`,
  });
  expect(verifyResend(body, headers, secret, now)).toBe(true);
  expect(verifyResend(body + " ", headers, secret, now)).toBe(false);
  expect(verifyResend(body, headers, secret, now + 600000)).toBe(false);
  const meta =
    "sha256=" + createHmac("sha256", "meta-secret").update(body).digest("hex");
  expect(verifyMeta(body, meta, "meta-secret")).toBe(true);
  expect(verifyMeta(body, meta, "other-tenant-secret")).toBe(false);
  expect(webhookFailure(new SyntaxError()).status).toBe(400);
  const unavailable = webhookFailure(
    new Error("Database temporarily unavailable"),
  );
  expect(unavailable.status).toBe(503);
  expect(unavailable.headers.get("Retry-After")).toBe("60");
});
it("only activates WhatsApp for an approved template with the expected five parameters", async () => {
  const settings = {
    accessToken: "token",
    appSecret: "secret",
    phoneNumberId: "123456",
    businessAccountId: "654321",
    apiVersion: "v25.0",
    template: "visita",
    language: "pt_BR",
  };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ id: "123456" }))
    .mockResolvedValueOnce(
      Response.json({
        data: [
          {
            name: "visita",
            status: "APPROVED",
            language: "pt_BR",
            components: [
              { type: "BODY", text: "{{1}} {{2}} {{3}} {{4}} {{5}}" },
            ],
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(validateWhatsApp(settings)).resolves.toBe("123456");
  fetcher
    .mockResolvedValueOnce(Response.json({ id: "123456" }))
    .mockResolvedValueOnce(
      Response.json({
        data: [
          {
            name: "visita",
            status: "PENDING",
            language: "pt_BR",
            components: [{ type: "BODY", text: "{{1}}" }],
          },
        ],
      }),
    );
  await expect(validateWhatsApp(settings)).rejects.toMatchObject({
    code: "WHATSAPP_TEMPLATE_INVALID",
  });
});
