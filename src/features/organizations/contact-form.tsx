"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { saveContactAction } from "./actions";

export function ContactForm({
  organization,
}: {
  organization: { name: string; contactEmail: string; whatsapp: string };
}) {
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
          const result = await saveContactAction(data);
          if (result.success) setSaved(true);
          else setError(result.error);
        } catch {
          setError("Não foi possível conectar. Tente novamente.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2>Contato público da imobiliária</h2>
      <p>
        Estes dados aparecem nos imóveis publicados. Use os canais comerciais da
        sua equipe.
      </p>
      <div className="form-grid">
        <label className="field">
          Nome da imobiliária
          <input
            name="name"
            defaultValue={organization.name}
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label className="field">
          E-mail comercial
          <input
            name="contactEmail"
            type="email"
            defaultValue={organization.contactEmail}
            maxLength={254}
          />
        </label>
        <label className="field">
          WhatsApp com DDI e DDD
          <input
            name="whatsapp"
            type="tel"
            placeholder="5511999999999"
            defaultValue={organization.whatsapp}
            maxLength={24}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="form-success">
          Contato atualizado.
        </p>
      )}
      <Button disabled={pending} type="submit">
        {pending ? "Salvando…" : "Salvar contato"}
      </Button>
    </form>
  );
}
