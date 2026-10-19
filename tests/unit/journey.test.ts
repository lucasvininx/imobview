import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  contactSchema,
  eventSchema,
  startVisitSchema,
  sourceFromLocation,
} from "@/features/leads/schema";
import { summarizeVisit } from "@/features/leads/metrics";
it("requires explicit contact consent and strips unknown personal fields", () => {
  const data = {
    name: "Pessoa Teste",
    email: "TESTE@example.com",
    phone: "(11) 99999-9999",
    consent: true,
    cpf: "never-store",
  };
  expect(contactSchema.parse(data)).toEqual({
    name: "Pessoa Teste",
    email: "teste@example.com",
    phone: "11999999999",
    consent: true,
  });
  expect(contactSchema.safeParse({ ...data, consent: false }).success).toBe(
    false,
  );
  expect(
    startVisitSchema.safeParse({
      slug: "casa",
      tourId: randomUUID(),
      tracking: false,
    }).success,
  ).toBe(false);
});
it("bounds client timing and removes referrer query strings", () => {
  expect(
    eventSchema.safeParse({ sequence: 1, kind: "HEARTBEAT", durationMs: 30001 })
      .success,
  ).toBe(false);
  expect(
    sourceFromLocation(
      "",
      "https://example.com/private?email=person@example.com",
    ),
  ).toBe("example.com");
  expect(
    sourceFromLocation("?utm_source=instagram", "https://example.com"),
  ).toBe("instagram");
});
it("summarizes active time, room order and revisits without counting heartbeats as new visits", () => {
  expect(
    summarizeVisit([
      { kind: "SCENE", sceneId: "a", durationMs: 0 },
      { kind: "HEARTBEAT", sceneId: "a", durationMs: 10000 },
      { kind: "SCENE", sceneId: "b", durationMs: 0 },
      { kind: "SCENE", sceneId: "a", durationMs: 0 },
    ]),
  ).toEqual({
    durationMs: 10000,
    revisits: 1,
    rooms: {
      a: { visits: 2, durationMs: 10000 },
      b: { visits: 1, durationMs: 0 },
    },
  });
});
