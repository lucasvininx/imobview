"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { saveLeadProfileAction } from "./actions";
type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  propertyId: string | null;
};
export function ProfileForm({
  lead,
  properties,
}: {
  lead?: Profile;
  properties: { id: string; title: string }[];
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="form-card profile-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const input = Object.fromEntries(new FormData(event.currentTarget));
        setBusy(true);
        setMessage("");
        try {
          const result = await saveLeadProfileAction(input, lead?.id);
          if (result.success) {
            if (!lead) router.push(`/app/leads/${result.id}`);
            else {
              setMessage("Cadastro atualizado.");
              router.refresh();
            }
          } else setMessage(result.error);
        } catch {
          setMessage("Falha de conexão. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{lead ? "Dados do cliente" : "Cadastrar cliente"}</h2>
      <p>
        Nome e um meio de contato são suficientes para começar. Complete os
        cinco dados pessoais para finalizar o cadastro.
      </p>
      <div className="profile-fields">
        <label className="field">
          Nome completo
          <input
            name="name"
            required
            minLength={3}
            maxLength={160}
            defaultValue={lead?.name}
            autoComplete="name"
          />
        </label>
        <label className="field">
          E-mail
          <input
            name="email"
            type="email"
            maxLength={254}
            defaultValue={lead?.email}
            autoComplete="email"
          />
        </label>
        <label className="field">
          Celular
          <input
            name="phone"
            type="tel"
            maxLength={24}
            defaultValue={lead?.phone}
            autoComplete="tel"
            placeholder="(11) 99999-9999"
          />
        </label>
        <label className="field">
          CPF
          <input
            name="cpf"
            inputMode="numeric"
            maxLength={14}
            defaultValue={lead?.cpf}
            placeholder="000.000.000-00"
          />
        </label>
        <label className="field">
          Data de nascimento
          <input
            name="birthDate"
            type="date"
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
            defaultValue={lead?.birthDate}
            autoComplete="bday"
          />
        </label>
        <label className="field">
          Imóvel de interesse
          <select name="propertyId" defaultValue={lead?.propertyId ?? ""}>
            <option value="">Ainda não definido</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button disabled={busy}>
        {busy ? "Salvando…" : lead ? "Salvar cadastro" : "Criar lead"}
      </Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
