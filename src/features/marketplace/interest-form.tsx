"use client";
import Link from "next/link";
import { useState } from "react";
import { registerInterestAction } from "./interest-action";
export function InterestForm({
  slug,
  agency,
}: {
  slug: string;
  agency: string;
}) {
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState("");
  if (sent)
    return (
      <div className="interest-sent" role="status">
        <strong>Interesse enviado!</strong>
        <p>
          A {agency} recebeu seu contato e poderá conversar com você sobre este
          imóvel.
        </p>
      </div>
    );
  return (
    <form
      className="market-interest"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try {
          const result = await registerInterestAction({
            ...Object.fromEntries(form),
            slug,
            consent: form.get("consent") === "on",
          });
          if (result.success) setSent(true);
          else setError(result.error);
        } catch {
          setError("Falha de conexão. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>É o lugar que você procura?</h3>
      <p>Deixe seu contato para a {agency}.</p>
      <label className="field">
        Seu nome completo
        <input
          name="name"
          required
          minLength={3}
          maxLength={160}
          autoComplete="name"
        />
      </label>
      <label className="field">
        Seu e-mail
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
        />
      </label>
      <label className="field">
        Seu celular
        <input
          name="phone"
          type="tel"
          required
          maxLength={24}
          autoComplete="tel"
          placeholder="(11) 99999-9999"
        />
      </label>
      <div className="interest-honeypot" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="interest-consent">
        <input name="consent" type="checkbox" required />
        <span>
          Autorizo o envio dos meus dados à imobiliária para falar sobre este
          imóvel. <Link href="/privacidade">Privacidade</Link>.
        </span>
      </label>
      <button className="button button-primary" disabled={busy}>
        {busy ? "Enviando…" : "Tenho interesse"}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
