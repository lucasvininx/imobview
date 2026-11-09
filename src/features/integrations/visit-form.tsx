"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { scheduleVisitAction } from "./actions";

export function VisitScheduleForm({
  requestId,
  leads,
  calendarConnected,
  initialStart = "",
  timeZone = "America/Sao_Paulo",
  duration = 60,
}: {
  requestId?: string;
  leads?: { id: string; name: string }[];
  calendarConnected: boolean;
  initialStart?: string;
  timeZone?: string;
  duration?: number;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      className="visit-schedule-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        setError("");
        const data = new FormData(event.currentTarget);
        try {
          const result = await scheduleVisitAction(
            {
              localStart: data.get("localStart"),
              timeZone: data.get("timeZone"),
              duration: data.get("duration"),
              syncCalendar: data.get("syncCalendar") === "on",
            },
            requestId,
            requestId ? undefined : String(data.get("leadId") ?? ""),
          );
          if (result.success) {
            setMessage(
              "Visita confirmada. Acompanhe os envios e a sincronização em Integrações.",
            );
            router.refresh();
          } else setError(result.error);
        } catch {
          setError("Falha de conexão. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {!requestId && (
        <label className="field">
          Cliente
          <select name="leadId" aria-label="Cliente" required defaultValue="">
            <option value="" disabled>
              Escolha um cliente
            </option>
            {leads?.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="form-grid">
        <label className="field">
          Data e horário exatos
          <input
            type="datetime-local"
            name="localStart"
            defaultValue={initialStart}
            required
          />
        </label>
        <label className="field">
          Duração
          <select name="duration" aria-label="Duração" defaultValue={duration}>
            {[15, 30, 45, 60, 90, 120, 180, 240].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutos
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Fuso horário
          <select
            name="timeZone"
            aria-label="Fuso horário"
            defaultValue={timeZone}
          >
            {[
              "America/Sao_Paulo",
              "America/Recife",
              "America/Fortaleza",
              "America/Belem",
              "America/Manaus",
              "America/Cuiaba",
              "America/Campo_Grande",
              "America/Porto_Velho",
              "America/Rio_Branco",
            ].map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace("America/", "").replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          name="syncCalendar"
          defaultChecked={calendarConnected}
          disabled={!calendarConnected}
        />{" "}
        Sincronizar com minha agenda Google conectada
      </label>
      {!calendarConnected && (
        <p className="muted">
          Você pode salvar a visita aqui. Para enviar ao Google Agenda,{" "}
          <Link href="/app/integracoes">conecte sua conta</Link> e depois
          confirme o horário com a sincronização marcada.
        </p>
      )}
      <p className="muted">
        Combine o horário com o cliente antes de confirmar. Os avisos seguem as
        integrações habilitadas pela imobiliária.
      </p>
      <Button disabled={busy}>
        {busy
          ? "Salvando…"
          : requestId
            ? "Confirmar data e horário"
            : "Agendar visita"}
      </Button>
      {message && (
        <p role="status" className="form-success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
