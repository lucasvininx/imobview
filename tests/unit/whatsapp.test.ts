import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("server-only", () => ({}));
import {
  visitMessage,
  whatsappConfigured,
  type WhatsAppJob,
} from "@/features/notifications/whatsapp";
afterEach(() => vi.unstubAllEnvs());
const job: WhatsAppJob = {
  id: "id",
  lease: "lease",
  phone: "5511999999999",
  kind: "VISIT_REQUESTED",
  name: "Cliente",
  property: "Apartamento",
  date: "2026-11-10",
  period: "AFTERNOON",
};
it("sends the broker an approved template with status, client, property, date and period", () => {
  vi.stubEnv("WHATSAPP_VISIT_TEMPLATE", "aviso_visita");
  const message = visitMessage(job);
  expect(message.to).toBe(job.phone);
  expect(message.template.name).toBe("aviso_visita");
  expect(message.template.components[0].parameters.map((p) => p.text)).toEqual([
    "Nova solicitação de visita",
    "Cliente",
    "Apartamento",
    "10/11/2026",
    "Tarde",
  ]);
  expect(
    visitMessage({ ...job, kind: "VISIT_CONFIRMED" }).template.components[0]
      .parameters[0].text,
  ).toBe("Visita confirmada");
});
it("keeps alerts unavailable until all server credentials and a template are configured", () => {
  for (const key of [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_API_VERSION",
    "WHATSAPP_VISIT_TEMPLATE",
  ])
    vi.stubEnv(key, "");
  expect(whatsappConfigured()).toBe(false);
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "test-token");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1234567");
  vi.stubEnv("WHATSAPP_API_VERSION", "v25.0");
  vi.stubEnv("WHATSAPP_VISIT_TEMPLATE", "aviso_visita");
  expect(whatsappConfigured()).toBe(true);
});
