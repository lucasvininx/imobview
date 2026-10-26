"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { saveFinancingAction } from "./actions";

export function FinancingForm({ rateBps }: { rateBps: number }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="form-card"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        setPending(true);
        setError("");
        setSaved(false);
        try {
          const result = await saveFinancingAction(data);
          if (result.success) setSaved(true);
          else setError(result.error);
        } catch {
          setError("Não foi possível conectar. Tente novamente.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2>Simulador de financiamento</h2>
      <p>
        Aparece nos imóveis publicados à venda. O visitante pode alterar a taxa;
        este é apenas o valor inicial. Use a taxa efetiva anual média que seus
        clientes costumam conseguir.
      </p>
      <label className="field">
        Taxa de juros inicial (% ao ano)
        <input
          name="financingRate"
          inputMode="decimal"
          defaultValue={(rateBps / 100).toFixed(2).replace(".", ",")}
          required
          maxLength={5}
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="form-success">
          Taxa atualizada.
        </p>
      )}
      <Button disabled={pending} type="submit">
        {pending ? "Salvando…" : "Salvar taxa"}
      </Button>
    </form>
  );
}
