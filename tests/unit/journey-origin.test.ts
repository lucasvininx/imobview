import { expect, it } from "vitest";
import { journeyOriginAllowed } from "@/features/leads/origin";

it("accepts the configured origin and rejects foreign or absent origins", () => {
  const target = "https://imobview.example";
  expect(
    journeyOriginAllowed(target, `${target}/api/journey`, target, false),
  ).toBe(true);
  expect(
    journeyOriginAllowed(
      "https://other.example",
      `${target}/api/journey`,
      target,
      false,
    ),
  ).toBe(false);
  expect(
    journeyOriginAllowed(null, `${target}/api/journey`, target, false),
  ).toBe(false);
});
it("permits same-origin loopback in development without weakening production", () => {
  const configured = "https://imobview.example";
  const request = "http://localhost:3000/api/journey";
  expect(
    journeyOriginAllowed("http://localhost:3000", request, configured, true),
  ).toBe(true);
  expect(
    journeyOriginAllowed("http://localhost:3000", request, configured, false),
  ).toBe(false);
  expect(
    journeyOriginAllowed("http://localhost:3001", request, configured, true),
  ).toBe(false);
  expect(
    journeyOriginAllowed(
      "https://attacker.example",
      "https://attacker.example/api/journey",
      configured,
      true,
    ),
  ).toBe(false);
});
