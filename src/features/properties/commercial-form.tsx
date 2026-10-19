"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { saveCommercialAction } from "./commercial-actions";
type Details = {
  id: string;
  slug: string;
  internalCode: string;
  address: string;
  condominium: string;
  suites: number;
  commercialNotes: string;
  captureLeads: boolean;
  brokerId: string | null;
  status: string;
};
export function CommercialForm({
  property,
  brokers,
}: {
  property: Details;
  brokers: { id: string; name: string; active: boolean }[];
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="form-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        try {
          const result = await saveCommercialAction(property.id, {
            ...Object.fromEntries(data),
            captureLeads: data.get("captureLeads") === "on",
          });
          setMessage(
            result.success ? "Dados comerciais atualizados." : result.error,
          );
        } catch {
          setMessage("Não foi possível conectar. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Distribuição e atendimento</h2>
      <div className="form-grid">
        <label className="field">
          URL personalizada /v/
          <input
            name="slug"
            defaultValue={property.slug}
            required
            maxLength={220}
            readOnly={property.status === "PUBLISHED"}
          />
          <small>
            Edite antes de publicar. Alterar a URL invalida o link anterior.
          </small>
        </label>
        <label className="field">
          Código interno
          <input
            name="internalCode"
            defaultValue={property.internalCode}
            maxLength={80}
          />
        </label>
        <label className="field">
          Endereço completo (interno)
          <input
            name="address"
            defaultValue={property.address}
            maxLength={240}
          />
        </label>
        <label className="field">
          Condomínio
          <input
            name="condominium"
            defaultValue={property.condominium}
            maxLength={220}
          />
        </label>
        <label className="field">
          Suítes
          <input
            name="suites"
            type="number"
            min={0}
            max={100}
            defaultValue={property.suites}
          />
        </label>
        <label className="field">
          Corretor responsável
          <select name="brokerId" defaultValue={property.brokerId ?? ""}>
            <option value="">Não atribuído</option>
            {brokers
              .filter((b) => b.active || b.id === property.brokerId)
              .map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                  {b.active ? "" : " (inativo)"}
                </option>
              ))}
          </select>
        </label>
        <label className="field full-width">
          Informações comerciais internas
          <textarea
            name="commercialNotes"
            maxLength={2000}
            defaultValue={property.commercialNotes}
          />
        </label>
      </div>
      <label className="check-field">
        <input
          name="captureLeads"
          type="checkbox"
          defaultChecked={property.captureLeads}
        />
        Apresentar formulário de contato antes do tour, permitindo continuar sem
        identificação.
      </label>
      <Button disabled={busy}>Salvar dados comerciais</Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
