"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { saveDistributionAction } from "./distribution-actions";
export function DistributionForm({
  mode,
  alerts,
  whatsappReady,
}: {
  mode: string;
  alerts: boolean;
  whatsappReady: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="form-card"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        const data = new FormData(event.currentTarget);
        try {
          const result = await saveDistributionAction({
            leadDistribution: data.get("leadDistribution"),
            whatsappVisitAlerts: data.get("whatsappVisitAlerts") === "on",
          });
          setMessage(
            result.success
              ? "Distribuição e avisos atualizados."
              : result.error,
          );
        } catch {
          setMessage("Falha de conexão. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Distribuição de leads e avisos</h2>
      <label className="field">
        Como distribuir novos leads
        <select name="leadDistribution" defaultValue={mode}>
          <option value="PROPERTY">Corretor responsável pelo imóvel</option>
          <option value="ROUND_ROBIN">
            Rodízio justo: um lead por corretor
          </option>
          <option value="PERFORMANCE">Por desempenho: vendas e locações</option>
        </select>
      </label>
      <p>
        O rodízio alterna entre os corretores ativos. Por desempenho, cada
        corretor tem peso 1 mais o número de vendas e locações marcadas como
        fechadas no CRM nos últimos 90 dias. Quem fecha mais recebe mais leads;
        todos continuam participando.
      </p>
      <p>
        A regra vale para novos cadastros. Clientes que retornam mantêm seu
        corretor. Sem corretor elegível, o lead fica disponível para atendimento
        pela equipe.
      </p>
      <label className="check-field">
        <input
          name="whatsappVisitAlerts"
          type="checkbox"
          defaultChecked={alerts}
          disabled={!whatsappReady}
        />{" "}
        Avisar automaticamente no WhatsApp do corretor quando o cliente
        solicitar uma visita e quando a equipe confirmar.
      </label>
      <p className="muted">
        {whatsappReady
          ? "Integração WhatsApp configurada. Sem corretor ativo atribuído, o aviso vai para o WhatsApp da imobiliária."
          : "Para ativar, abra Integrações e siga o passo a passo do WhatsApp Business."}
      </p>
      <Button disabled={busy}>
        {busy ? "Salvando…" : "Salvar distribuição e avisos"}
      </Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
