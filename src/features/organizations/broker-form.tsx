"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { saveBrokerAction, deactivateBrokerAction } from "./broker-actions";
export function BrokerForm() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="form-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        try {
          const r = await saveBrokerAction(
            Object.fromEntries(new FormData(form)),
          );
          setMessage(r.success ? "Corretor cadastrado." : r.error);
          if (r.success) {
            form.reset();
            router.refresh();
          }
        } catch {
          setMessage("Falha ao cadastrar. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Cadastrar corretor responsável</h2>
      <p>
        Cadastro de contato profissional. Não cria uma conta de acesso ao
        sistema.
      </p>
      <div className="form-grid">
        <label className="field">
          Nome do corretor
          <input name="name" required minLength={3} maxLength={120} />
        </label>
        <label className="field">
          E-mail do corretor
          <input name="email" type="email" required />
        </label>
        <label className="field">
          Telefone do corretor
          <input name="phone" type="tel" required />
        </label>
      </div>
      <Button disabled={busy}>Cadastrar corretor</Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
export function DeactivateBroker({ id }: { id: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button
        disabled={busy}
        variant="quiet"
        onClick={async () => {
          setBusy(true);
          try {
            const r = await deactivateBrokerAction(id);
            setError(!r.success);
            router.refresh();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        Desativar corretor
      </Button>
      {error && <p role="alert">Não foi possível desativar.</p>}
    </>
  );
}
