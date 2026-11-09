import Link from "next/link";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/ui";
import { listRequests } from "@/features/leads/service";
import { RequestStatus } from "@/features/leads/lead-form";
import { periodLabels } from "@/features/leads/schema";
import { withTenant } from "@/server/tenant";
import { VisitScheduleForm } from "@/features/integrations/visit-form";
export default async function Page() {
  const { actor, membership } = await requireWorkspace();
  if (!can(membership.role, "lead:read")) return <p>Acesso não permitido.</p>;
  const requests = await listRequests(actor);
  const { calendar, leads } = await withTenant(
    actor,
    "lead:read",
    async (tx) => ({
      calendar: await tx.calendarConnection.findUnique({
        where: { organizationId_userId: actor },
        select: { connected: true },
      }),
      leads: await tx.lead.findMany({
        where: { organizationId: actor.organizationId },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
    }),
  );
  const edit = can(membership.role, "lead:update");
  return (
    <>
      <PageHeader
        title="Solicitações de visita"
        description="Defina data e horário, confirme as visitas e acompanhe a sincronização com sua agenda Google."
      />
      <p className="muted">
        <Link href="/app/integracoes">
          Conectar Google Agenda, WhatsApp e e-mail ↗
        </Link>
      </p>
      {edit && (
        <details className="form-card">
          <summary>Agendar nova visita</summary>
          <VisitScheduleForm
            leads={leads}
            calendarConnected={Boolean(calendar?.connected)}
          />
        </details>
      )}
      {!requests.length ? (
        <p className="notice">Nenhuma visita solicitada ainda.</p>
      ) : (
        <div className="lead-grid">
          {requests.map((r) => (
            <article className="form-card" key={r.id} id={`visita-${r.id}`}>
              <h2>
                <Link href={`/app/leads/${r.leadId}`}>{r.lead.name}</Link>
              </h2>
              <p>{r.lead.property?.title ?? "Imóvel a definir"}</p>
              <p>
                {r.preferredDate.split("-").reverse().join("/")} ·{" "}
                {periodLabels[r.period as keyof typeof periodLabels]}
              </p>
              {r.scheduledStartAt && (
                <p>
                  <strong>Horário definido:</strong>{" "}
                  {r.scheduledStartAt.toLocaleString("pt-BR", {
                    timeZone: r.timeZone,
                  })}{" "}
                  · {r.timeZone}
                </p>
              )}
              {r.calendarEventUrl && r.status !== "CANCELLED" && (
                <p>
                  <a
                    href={r.calendarEventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir compromisso no Google Agenda ↗
                  </a>
                </p>
              )}
              {edit && (
                <>
                  <RequestStatus id={r.id} status={r.status} />
                  <details className="schedule-editor">
                    <summary>
                      {r.scheduledStartAt
                        ? "Reagendar data e horário"
                        : "Definir data e horário exatos"}
                    </summary>
                    <VisitScheduleForm
                      requestId={r.id}
                      calendarConnected={Boolean(calendar?.connected)}
                      timeZone={r.timeZone}
                      initialStart={
                        r.scheduledStartAt
                          ? localInput(r.scheduledStartAt, r.timeZone)
                          : `${r.preferredDate}T09:00`
                      }
                      duration={
                        r.scheduledStartAt && r.scheduledEndAt
                          ? Math.round(
                              (r.scheduledEndAt.getTime() -
                                r.scheduledStartAt.getTime()) /
                                60000,
                            )
                          : 60
                      }
                    />
                  </details>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function localInput(date: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
