"use client";
import Link from "next/link";
import { useState } from "react";
import { sendBusinessMessage } from "./action";

export function BusinessContactForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  if (sent)
    return (
      <div className="interest-sent" role="status">
        <h2>Mensagem enviada!</h2>
        <p>Nossa equipe responderá pelo e-mail informado.</p>
      </div>
    );
  return (
    <form
      className="business-contact-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try {
          const result = await sendBusinessMessage({
            ...Object.fromEntries(form),
            consent: form.get("consent") === "on",
          });
          if (result.success) setSent(true);
          else setError(result.error);
        } catch {
          setError("Falha de conexão. Tente enviar novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Conte como podemos ajudar.</h2>
      <label className="field">
        Seu nome
        <input
          name="name"
          autoComplete="name"
          minLength={3}
          maxLength={160}
          required
        />
      </label>
      <label className="field">
        Seu e-mail
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
        />
      </label>
      <label className="field">
        Sua mensagem
        <textarea
          name="message"
          minLength={20}
          maxLength={4000}
          rows={5}
          required
          placeholder="Escreva sua dúvida ou conte sobre sua imobiliária…"
        />
      </label>
      <div className="interest-honeypot" aria-hidden="true">
        <label>
          Website
          <input name="website" autoComplete="off" tabIndex={-1} />
        </label>
      </div>
      <label className="interest-consent">
        <input name="consent" type="checkbox" required />
        <span>
          Autorizo a ImobView a usar estes dados para responder à minha
          mensagem. <Link href="/privacidade">Privacidade</Link>.
        </span>
      </label>
      <button className="button button-primary" disabled={busy}>
        {busy ? "Enviando…" : "Enviar mensagem"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
