"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { money } from "@/lib/format";
import { reportInteraction } from "@/features/leads/use-journey";
import {
  MIN_DOWN_PAYMENT_SHARE,
  financingSystems,
  rateLabel,
  simulateFinancing,
  systemLabels,
  type FinancingInput,
} from "./calc";

const terms = [10, 15, 20, 25, 30, 35];

export function FinancingSimulator({
  priceCents,
  defaultRateBps,
}: {
  priceCents: number;
  defaultRateBps: number;
}) {
  const [down, setDown] = useState(
    String(Math.round((priceCents * MIN_DOWN_PAYMENT_SHARE) / 100)),
  );
  const [years, setYears] = useState("30");
  const [rate, setRate] = useState((defaultRateBps / 100).toFixed(2));
  const [system, setSystem] = useState<FinancingInput["system"]>("SAC");
  const [input, setInput] = useState<FinancingInput | null>(null);
  const [error, setError] = useState("");
  const result = input ? simulateFinancing(priceCents, input) : null;
  const share = input ? input.downPaymentCents / priceCents : 0;
  return (
    <section className="form-card financing" aria-labelledby="financiamento">
      <h2 id="financiamento">Simule o financiamento</h2>
      <p className="muted">
        Valor do imóvel: <strong>{money(priceCents)}</strong>
      </p>
      <form
        // Our own messages (in Portuguese, next to the button) replace the browser's.
        noValidate
        onChange={() => setError("")}
        onSubmit={(event) => {
          event.preventDefault();
          const downPaymentCents = Math.round(Number(down) * 100);
          const rateBps = Math.round(Number(rate.replace(",", ".")) * 100);
          const next: FinancingInput = {
            downPaymentCents,
            termMonths: Number(years) * 12,
            rateBps,
            system,
          };
          if (
            !Number.isFinite(downPaymentCents) ||
            downPaymentCents < 0 ||
            downPaymentCents >= priceCents
          ) {
            setError("A entrada deve ser menor que o valor do imóvel.");
            return;
          }
          if (!Number.isFinite(rateBps) || rateBps < 100 || rateBps > 4000) {
            setError("Use uma taxa de juros entre 1% e 40% ao ano.");
            return;
          }
          setError("");
          setInput(next);
          reportInteraction({ kind: "SIMULATE", simulation: next });
        }}
      >
        <div className="form-grid">
          <label className="field">
            Entrada (R$)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              required
              value={down}
              onChange={(event) => setDown(event.target.value)}
            />
          </label>
          <label className="field">
            Prazo
            <select value={years} onChange={(e) => setYears(e.target.value)}>
              {terms.map((term) => (
                <option key={term} value={term}>
                  {term} anos
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Juros (% ao ano)
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={40}
              step={0.01}
              required
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </label>
        </div>
        <fieldset className="financing-systems">
          <legend>Sistema de amortização</legend>
          {financingSystems.map((option) => (
            <label key={option} className="check-field">
              <input
                type="radio"
                name="system"
                value={option}
                checked={system === option}
                onChange={() => setSystem(option)}
              />
              {systemLabels[option]}
            </label>
          ))}
        </fieldset>
        <Button type="submit">Simular</Button>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {input && result && (
        <div className="financing-result" role="status">
          <div>
            <span>
              {input.system === "SAC" ? "Primeira parcela" : "Parcela mensal"}
            </span>
            <strong>{money(result.firstInstallmentCents)}</strong>
            {input.system === "SAC" && (
              <span className="muted">
                diminui até {money(result.lastInstallmentCents)} na última
              </span>
            )}
          </div>
          <div>
            <span>Renda familiar sugerida</span>
            <strong>a partir de {money(result.minimumIncomeCents)}</strong>
            <span className="muted">parcela de até 30% da renda</span>
          </div>
          <dl>
            <dt>Valor financiado</dt>
            <dd>{money(result.financedCents)}</dd>
            <dt>Entrada</dt>
            <dd>
              {money(input.downPaymentCents)} ({Math.round(share * 100)}%)
            </dd>
            <dt>Juros no período</dt>
            <dd>{money(result.interestCents)}</dd>
            <dt>Total pago ao banco</dt>
            <dd>{money(result.totalPaidCents)}</dd>
            <dt>Taxa considerada</dt>
            <dd>{rateLabel(input.rateBps)}</dd>
          </dl>
          {share < MIN_DOWN_PAYMENT_SHARE && (
            <p className="notice">
              A maioria dos bancos exige entrada de pelo menos 20% do valor do
              imóvel. Programas habitacionais podem ter outras regras.
            </p>
          )}
        </div>
      )}
      <p className="muted financing-disclaimer">
        Estimativa sem seguros obrigatórios, taxas do banco e correção
        monetária, que aumentam a parcela. As condições reais dependem da
        análise de crédito. Se você permitiu a medição da visita, a imobiliária
        verá os valores simulados para ajudar no atendimento.
      </p>
    </section>
  );
}
