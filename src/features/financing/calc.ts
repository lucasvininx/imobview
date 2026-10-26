import { z } from "zod";

// Mirrors public.record_tour_event so the visitor and the team see the same installment.
export const financingSystems = ["SAC", "PRICE"] as const;
export const financingInputSchema = z.object({
  downPaymentCents: z.number().int().min(0).max(1e13),
  termMonths: z.number().int().min(12).max(420),
  rateBps: z.number().int().min(100).max(4000),
  system: z.enum(financingSystems),
});
export type FinancingInput = z.infer<typeof financingInputSchema>;
export const systemLabels = {
  SAC: "SAC (parcelas decrescentes)",
  PRICE: "Price (parcelas fixas)",
} as const;
// Banks usually limit the installment to 30% of the household income.
export const INCOME_COMMITMENT = 0.3;
export const MIN_DOWN_PAYMENT_SHARE = 0.2;

export function monthlyRate(rateBps: number) {
  return Math.pow(1 + rateBps / 10000, 1 / 12) - 1;
}

export function simulateFinancing(priceCents: number, input: FinancingInput) {
  const financed = priceCents - input.downPaymentCents;
  if (financed <= 0) return null;
  const i = monthlyRate(input.rateBps);
  const n = input.termMonths;
  if (input.system === "SAC") {
    const amortization = financed / n;
    const first = amortization + financed * i;
    const last = amortization + amortization * i;
    // Interest falls linearly: total interest = i · P · (n + 1) / 2.
    const total = financed + (i * financed * (n + 1)) / 2;
    return result(financed, first, last, total);
  }
  const installment = (financed * i) / (1 - Math.pow(1 + i, -n));
  return result(financed, installment, installment, installment * n);
}

function result(financed: number, first: number, last: number, total: number) {
  return {
    financedCents: Math.round(financed),
    firstInstallmentCents: Math.round(first),
    lastInstallmentCents: Math.round(last),
    totalPaidCents: Math.round(total),
    interestCents: Math.round(total - financed),
    minimumIncomeCents: Math.round(first / INCOME_COMMITMENT),
  };
}

export function rateLabel(rateBps: number) {
  return `${(rateBps / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`;
}
