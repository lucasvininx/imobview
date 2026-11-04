import { describe, it, expect } from "vitest";
import { interpretSearch, searchSchema } from "@/features/marketplace/search";
import {
  leadProfileSchema,
  validCpf,
  isCompleteLead,
} from "@/features/leads/profile-schema";
const search = (q: string, rest = {}) =>
  interpretSearch(searchSchema.parse({ q, ...rest }));
describe("marketplace language search", () => {
  it("understands the requested Campinas example without losing location", () => {
    expect(
      search(
        "Quero casas em Campinas no bairro Cambuí com três quartos, dois banheiros e quatro vagas na garagem",
      ),
    ).toMatchObject({
      type: "HOUSE",
      bedrooms: 3,
      bathrooms: 2,
      parkingSpaces: 4,
      city: "campinas",
      neighborhood: "cambui",
      tokens: [],
    });
  });
  it("recognizes renting, accented locations and Brazilian prices", () => {
    expect(
      search("alugar apartamento em São Paulo com 2 quartos até R$ 3.500,50"),
    ).toMatchObject({
      purpose: "RENT",
      type: "APARTMENT",
      bedrooms: 2,
      maxPrice: 3500.5,
      city: "sao paulo",
      tokens: [],
    });
    expect(search("comprar casa até 1,5 milhão").maxPrice).toBe(1500000);
    expect(search("aluguel até 3 mil").maxPrice).toBe(3000);
  });
  it("honors explicit refinements over interpreted criteria", () => {
    expect(
      search("casa para comprar com 3 quartos até 600 mil", {
        purpose: "RENT",
        bedrooms: 4,
        maxPrice: 5000,
      }),
    ).toMatchObject({
      purpose: "RENT",
      bedrooms: 4,
      maxPrice: 5000,
      tokens: [],
    });
  });
  it("preserves unmatched characteristics instead of silently dropping them", () => {
    expect(search("casa em Campinas com piscina")).toMatchObject({
      city: "campinas",
      tokens: ["piscina"],
    });
  });
  it("rejects oversized searches and invalid pagination", () => {
    expect(searchSchema.safeParse({ q: "a".repeat(301) }).success).toBe(false);
    expect(searchSchema.safeParse({ page: -1 }).success).toBe(false);
    expect(searchSchema.safeParse({ bedrooms: 100 }).success).toBe(false);
  });
});
describe("customer profiles", () => {
  const profile = {
    name: "Cliente de teste",
    email: "cliente@example.com",
    phone: "(11) 99999-9999",
    cpf: "529.982.247-25",
    birthDate: "1990-01-01",
    propertyId: "",
  };
  it("checks CPF digits and rejects repeated digits", () => {
    expect(validCpf("52998224725")).toBe(true);
    expect(validCpf("52998224726")).toBe(false);
    expect(validCpf("11111111111")).toBe(false);
  });
  it("accepts full profiles and contacts without a chosen property", () => {
    const result = leadProfileSchema.parse(profile);
    expect(result.cpf).toBe("52998224725");
    expect(result.phone).toBe("11999999999");
    expect(isCompleteLead(result)).toBe(true);
  });
  it("supports progressive completion and requires a way to contact the client", () => {
    const partial = { ...profile, cpf: "", birthDate: "", email: "" };
    expect(leadProfileSchema.safeParse(partial).success).toBe(true);
    expect(isCompleteLead(partial)).toBe(false);
    expect(leadProfileSchema.safeParse({ ...partial, phone: "" }).success).toBe(
      false,
    );
    expect(
      leadProfileSchema.safeParse({ ...profile, birthDate: "2999-01-01" })
        .success,
    ).toBe(false);
  });
});
