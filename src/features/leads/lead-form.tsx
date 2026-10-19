"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { stageLabels } from "./schema";
import { leadAction, deleteLeadAction, requestStatusAction } from "./actions";
export function LeadForm({
  id,
  stage,
  notes,
  canDelete,
}: {
  id: string;
  stage: string;
  notes: string;
  canDelete: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <>
      <form
        className="form-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const input = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          try {
            const r = await leadAction(id, input);
            setMessage(r.success ? "Lead atualizado." : r.error);
            router.refresh();
          } catch {
            setMessage("Falha de conexão. Tente novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Etapa comercial
          <select name="stage" defaultValue={stage}>
            {Object.entries(stageLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Anotações do atendimento
          <textarea name="notes" defaultValue={notes} maxLength={5000} />
        </label>
        <Button disabled={busy}>Salvar atendimento</Button>
      </form>
      {canDelete && (
        <details>
          <summary>Excluir dados deste lead</summary>
          <p>
            Remove o contato, histórico de navegação e solicitações. Esta
            operação não pode ser desfeita.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const confirmation = String(
                new FormData(e.currentTarget).get("confirmation"),
              );
              setBusy(true);
              try {
                const r = await deleteLeadAction(id, confirmation);
                if (r.success) router.push("/app/leads");
                else setMessage(r.error);
              } catch {
                setMessage("Não foi possível excluir.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Digite EXCLUIR
              <input name="confirmation" required pattern="EXCLUIR" />
            </label>
            <Button disabled={busy}>Excluir lead e histórico</Button>
          </form>
        </details>
      )}
      {message && <p role="status">{message}</p>}
    </>
  );
}
export function RequestStatus({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await requestStatusAction(
            id,
            String(new FormData(e.currentTarget).get("status")),
          );
          setMessage(r.success ? "Atualizado." : r.error);
          router.refresh();
        } catch {
          setMessage("Falha de conexão.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        Situação da solicitação
        <select name="status" defaultValue={status}>
          <option value="REQUESTED">A confirmar</option>
          <option value="CONFIRMED">Confirmada com o cliente</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
      </label>
      <Button disabled={busy} variant="secondary">
        Atualizar visita
      </Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
