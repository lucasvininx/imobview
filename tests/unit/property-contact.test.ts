import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { PublicProperty } from "@/features/properties/public-service";

vi.mock("@/features/leads/public-journey", () => ({
  PublicJourney: () => null,
}));
vi.mock("@/features/tours/viewer", () => ({ TourViewer: () => null }));
vi.mock("@/features/exterior/viewer", () => ({ ExteriorViewer: () => null }));
vi.mock("@/features/marketplace/interest-action", () => ({
  registerInterestAction: vi.fn(),
}));
import { PublicPresentation } from "@/components/public-presentation";

const rental: PublicProperty = {
  title: "Casa para alugar",
  slug: "casa-para-alugar",
  description: "Casa perto do centro.",
  city: "Campinas",
  state: "SP",
  neighborhood: "Centro",
  priceCents: BigInt(250000),
  area: 90,
  bedrooms: 2,
  bathrooms: 1,
  parkingSpaces: 1,
  cover: null,
  organizationName: "Imobiliária responsável",
  contactEmail: "",
  whatsapp: "",
  photos: [],
  captureLeads: false,
  internalCode: "",
  condominium: "",
  suites: 0,
  forSale: false,
  financingRateBps: 1150,
  isDemo: false,
};

it("shows rental contact and the lead form even with no tour, WhatsApp or agency email", () => {
  const html = renderToStaticMarkup(
    createElement(PublicPresentation, { property: rental }),
  );
  expect(html).toContain("Tenho interesse em alugar");
  expect(html).toContain('href="#contato-imovel"');
  expect(html).toContain("Fale sobre a locação");
  expect(html).toContain("Quero falar sobre o aluguel");
  expect(html).not.toContain('id="financiamento"');
});

it("keeps sale contact available without offering financing for an undisclosed price", () => {
  const html = renderToStaticMarkup(
    createElement(PublicPresentation, {
      property: { ...rental, forSale: true, priceCents: BigInt(0) },
    }),
  );
  expect(html).toContain("À VENDA");
  expect(html).toContain("Tenho interesse neste imóvel");
  expect(html).not.toContain('id="financiamento"');
  expect(html).not.toContain("/mês");
});

it("identifies demonstration listings without sending fictitious leads", () => {
  const html = renderToStaticMarkup(
    createElement(PublicPresentation, {
      property: { ...rental, isDemo: true },
    }),
  );
  expect(html).toContain("Este imóvel é demonstrativo");
  expect(html).not.toContain("Quero falar sobre o aluguel");
});

it("labels the financing region with one unique heading target", () => {
  const html = renderToStaticMarkup(
    createElement(PublicPresentation, {
      property: { ...rental, forSale: true, priceCents: BigInt(50000000) },
    }),
  );
  expect(html.match(/id="financiamento"/g)).toHaveLength(1);
  expect(html).toContain('aria-labelledby="financiamento"');
  expect(html).toContain("Simule o financiamento");
});
