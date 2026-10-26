import { it, expect } from "vitest";
import {
  INCOME_COMMITMENT,
  monthlyRate,
  simulateFinancing,
} from "@/features/financing/calc";
import { eventSchema } from "@/features/leads/schema";

const price = 50_000_000; // R$ 500.000,00
const base = {
  downPaymentCents: 10_000_000,
  termMonths: 360,
  rateBps: 1200,
} as const;

it("converts the effective annual rate to an equivalent monthly rate", () => {
  expect(Math.pow(1 + monthlyRate(1200), 12)).toBeCloseTo(1.12, 10);
});

it("computes SAC with decreasing installments and linear interest", () => {
  const sac = simulateFinancing(price, { ...base, system: "SAC" })!;
  const financed = price - base.downPaymentCents;
  const i = monthlyRate(base.rateBps);
  expect(sac.financedCents).toBe(financed);
  expect(sac.firstInstallmentCents).toBe(
    Math.round(financed / 360 + financed * i),
  );
  expect(sac.lastInstallmentCents).toBeLessThan(sac.firstInstallmentCents);
  expect(sac.minimumIncomeCents).toBe(
    Math.round(sac.firstInstallmentCents / INCOME_COMMITMENT),
  );
});

it("computes Price with a fixed installment that repays the loan", () => {
  const price_ = simulateFinancing(price, { ...base, system: "PRICE" })!;
  const sac = simulateFinancing(price, { ...base, system: "SAC" })!;
  expect(price_.firstInstallmentCents).toBe(price_.lastInstallmentCents);
  // Present value of all installments equals the financed amount.
  const i = monthlyRate(base.rateBps);
  let present = 0;
  for (let month = 1; month <= 360; month++)
    present += price_.firstInstallmentCents / Math.pow(1 + i, month);
  expect(Math.abs(present - price_.financedCents)).toBeLessThan(500);
  // Price starts lower but costs more interest than SAC.
  expect(price_.firstInstallmentCents).toBeLessThan(sac.firstInstallmentCents);
  expect(price_.interestCents).toBeGreaterThan(sac.interestCents);
});

it("returns nothing when the down payment covers the whole price", () => {
  expect(
    simulateFinancing(price, {
      ...base,
      downPaymentCents: price,
      system: "SAC",
    }),
  ).toBeNull();
});

it("only accepts simulation details on SIMULATE events, within bounds", () => {
  const simulation = { ...base, system: "SAC" };
  expect(
    eventSchema.safeParse({ sequence: 1, kind: "SIMULATE", simulation })
      .success,
  ).toBe(true);
  expect(eventSchema.safeParse({ sequence: 1, kind: "SIMULATE" }).success).toBe(
    false,
  );
  expect(
    eventSchema.safeParse({ sequence: 1, kind: "START", simulation }).success,
  ).toBe(false);
  expect(
    eventSchema.safeParse({
      sequence: 1,
      kind: "SIMULATE",
      simulation: { ...simulation, termMonths: 600 },
    }).success,
  ).toBe(false);
});
