import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  send: vi.fn(),
  transport: vi.fn(),
  contact: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/db", () => ({ db: { $queryRaw: mocks.query } }));
vi.mock("@/server/mail", () => ({ createMailTransport: mocks.transport }));
vi.mock("@/config/business", () => ({ businessContact: mocks.contact }));
vi.mock("@/config/env", () => ({
  readEnv: () => ({
    BETTER_AUTH_SECRET: "test-key".repeat(8),
    SMTP_FROM: "ImobView <site@example.com>",
  }),
}));
vi.mock("@/server/logger", () => ({ logError: vi.fn() }));
import { sendBusinessMessage } from "@/features/contact/action";

const input = {
  name: "Maria Silva",
  email: "maria@example.com",
  message: "Gostaria de conhecer a plataforma para minha imobiliária.",
  consent: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.contact.mockReturnValue({ email: "equipe@example.com" });
  mocks.transport.mockReturnValue({ sendMail: mocks.send });
  mocks.query.mockResolvedValue([{ count: 1 }]);
  mocks.send.mockResolvedValue({ accepted: ["equipe@example.com"] });
});

it("delivers to the configured inbox with a fixed sender and visitor reply address", async () => {
  expect(await sendBusinessMessage(input)).toEqual({ success: true });
  expect(mocks.send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "equipe@example.com",
      from: "ImobView <site@example.com>",
      replyTo: { name: "Maria Silva", address: "maria@example.com" },
    }),
  );
});

it("does not report success if the mail provider rejects or fails delivery", async () => {
  mocks.send.mockResolvedValue({ accepted: [] });
  expect(await sendBusinessMessage(input)).toMatchObject({ success: false });
  mocks.send.mockRejectedValue(new Error("SMTP failed"));
  expect(await sendBusinessMessage(input)).toMatchObject({ success: false });
});

it("does not send without configuration or when the rate limit is exceeded", async () => {
  mocks.contact.mockReturnValue({ email: "" });
  expect(await sendBusinessMessage(input)).toMatchObject({ success: false });
  expect(mocks.query).not.toHaveBeenCalled();
  mocks.contact.mockReturnValue({ email: "equipe@example.com" });
  mocks.query.mockResolvedValue([{ count: 4 }]);
  expect(await sendBusinessMessage(input)).toMatchObject({ success: false });
  expect(mocks.send).not.toHaveBeenCalled();
});

it("rejects spam and invalid consent before accessing the database or mail provider", async () => {
  expect(
    await sendBusinessMessage({ ...input, website: "spam" }),
  ).toMatchObject({ success: false });
  expect(await sendBusinessMessage({ ...input, consent: false })).toMatchObject(
    { success: false },
  );
  expect(mocks.query).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
