import { it, expect } from "vitest";
import { businessMessageSchema } from "@/features/contact/schema";
import {
  organizationContactSchema,
  whatsappUrl,
} from "@/features/organizations/schema";
it("normalizes Brazilian WhatsApp and rejects injected URLs", () => {
  expect(
    organizationContactSchema.parse({
      name: "Agência",
      contactEmail: "",
      whatsapp: "+55 (11) 99999-9999",
    }).whatsapp,
  ).toBe("5511999999999");
  expect(whatsappUrl("javascript:alert(1)", "teste")).toBeNull();
  expect(
    organizationContactSchema.safeParse({
      name: "Agência",
      contactEmail: "bad",
      whatsapp: "11999999999",
    }).success,
  ).toBe(false);
  expect(whatsappUrl("5511999999999", "Casa & jardim")).toContain(
    "Casa%20%26%20jardim",
  );
});

it("validates contact messages, explicit consent and the spam trap", () => {
  const input = {
    name: "Maria Silva",
    email: "MARIA@example.com",
    message: "Gostaria de conhecer a plataforma para minha imobiliária.",
    consent: true,
  };
  expect(businessMessageSchema.parse(input).email).toBe("maria@example.com");
  expect(
    businessMessageSchema.safeParse({ ...input, consent: false }).success,
  ).toBe(false);
  expect(
    businessMessageSchema.safeParse({ ...input, website: "spam" }).success,
  ).toBe(false);
  expect(
    businessMessageSchema.safeParse({ ...input, message: "oi" }).success,
  ).toBe(false);
});
