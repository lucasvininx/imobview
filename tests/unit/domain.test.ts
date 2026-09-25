import { describe, it, expect } from "vitest";
import { can, roles } from "@/domain/permissions";
import { toCents, money } from "@/lib/format";
import { propertySchema } from "@/features/properties/schema";
import { envSchema } from "@/config/env";
describe("permissions", () => {
  it("restricts billing to owners", () => {
    for (const role of roles)
      expect(can(role, "billing:manage")).toBe(role === "OWNER");
  });
  it("viewers cannot mutate properties", () => {
    expect(can("VIEWER", "property:read")).toBe(true);
    expect(can("VIEWER", "property:update")).toBe(false);
    expect(can("VIEWER", "property:create")).toBe(false);
  });
  it("members edit but cannot publish or archive", () => {
    expect(can("MEMBER", "property:update")).toBe(true);
    expect(can("MEMBER", "property:publish")).toBe(false);
    expect(can("MEMBER", "property:archive")).toBe(false);
  });
});
describe("money", () => {
  it("preserves cents without floating point", () => {
    expect(toCents("1250000,99")).toBe(BigInt(125000099));
    expect(toCents("0,01")).toBe(BigInt(1));
    expect(toCents("5,1")).toBe(BigInt(510));
  });
  it("rejects negative and malformed prices", () => {
    expect(() => toCents("-1")).toThrow();
    expect(() => toCents("2,999")).toThrow();
  });
  it("formats Brazilian currency", () =>
    expect(money(BigInt(125000000))).toContain("1.250.000"));
});
describe("validation", () => {
  const valid = {
    title: "Casa Jardim",
    description: "Descrição",
    type: "HOUSE",
    purpose: "SALE",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    price: "1200000,99",
    area: 150,
    bedrooms: 3,
    bathrooms: 2,
    parkingSpaces: 1,
  };
  it("rejects invalid states, missing cities, and negative areas", () => {
    for (const patch of [
      { state: "XX" },
      { city: "" },
      { area: -1 },
      { price: "NaN" },
    ])
      expect(propertySchema.safeParse({ ...valid, ...patch }).success).toBe(
        false,
      );
  });
  it("strips tenant and publication mass assignment", () => {
    const value = propertySchema.parse({
      ...valid,
      organizationId: "another-tenant",
      status: "PUBLISHED",
      cover: "https://malicious.test",
    });
    expect(value).not.toHaveProperty("organizationId");
    expect(value).not.toHaveProperty("status");
    expect(value).not.toHaveProperty("cover");
  });
  it("fails closed for missing environment configuration", () =>
    expect(envSchema.safeParse({}).success).toBe(false));
});
