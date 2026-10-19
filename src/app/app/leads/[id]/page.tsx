import { notFound } from "next/navigation";
import { z } from "zod";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { DomainError } from "@/domain/errors";
import { PageHeader } from "@/components/ui";
import { getLead } from "@/features/leads/service";
import { LeadForm, RequestStatus } from "@/features/leads/lead-form";
import { durationLabel, summarizeVisit } from "@/features/leads/metrics";
import { periodLabels } from "@/features/leads/schema";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, membership } = await requireWorkspace();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || !can(membership.role, "lead:read"))
    notFound();
  const lead = await getLead(actor, id).catch((error) => {
    if (error instanceof DomainError) notFound();
    throw error;
  });
  return (
    <>
      <PageHeader title={lead.name} description={lead.property.title} />
      <section className="form-card">
        <h2>Contato e origem</h2>
        <p>
          <a href={`mailto:${lead.email}`}>{lead.email}</a> ·{" "}
          <a href={`tel:${lead.phone}`}>{lead.phone}</a>
        </p>
        <p>
          Origem: {lead.source} · Corretor:{" "}
          {lead.property.broker?.name ?? "Ainda não atribuído"}
        </p>
        <p>
          Recebido em{" "}
          {lead.createdAt.toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}
        </p>
        <p>Contato solicitado pelo visitante · Aviso {lead.consentVersion}</p>
        <a href={`/api/leads/${id}/export`} className="text-link">
          Exportar dados deste lead
        </a>
      </section>
      <LeadForm
        id={id}
        stage={lead.stage}
        notes={lead.notes}
        canDelete={can(membership.role, "organization:manage")}
      />
      <h2>Comportamento no tour</h2>
      <p className="muted">
        Tempo ativo aproximado, com a página visível. Todos os ambientes abertos
        = tour concluído. Fechamento abrupto pode não enviar o último evento.
      </p>
      {lead.visits.map((visit) => {
        const summary = summarizeVisit(visit.events);
        const scenes = z
          .array(z.object({ id: z.uuid(), title: z.string() }))
          .parse(visit.scenes);
        return (
          <section className="form-card" key={visit.id}>
            <h3>
              {visit.createdAt.toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </h3>
            {!visit.tracking ? (
              <p>O visitante não autorizou medição comportamental.</p>
            ) : (
              <>
                <p>
                  {visit.completedAt
                    ? "Tour concluído"
                    : visit.startedAt
                      ? "Tour iniciado"
                      : "Tour não iniciado"}{" "}
                  · {durationLabel(summary.durationMs)} · {summary.revisits}{" "}
                  revisita(s)
                </p>
                <ul>
                  {scenes.map((s) => (
                    <li key={s.id}>
                      {s.title}: {summary.rooms[s.id]?.visits ?? 0} abertura(s),{" "}
                      {durationLabel(summary.rooms[s.id]?.durationMs ?? 0)}
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>Sequência de navegação</summary>
                  <ol>
                    {visit.events
                      .filter((e) => e.kind === "SCENE")
                      .map((e) => (
                        <li key={e.id}>
                          {scenes.find((s) => s.id === e.sceneId)?.title ??
                            "Ambiente"}{" "}
                          ·{" "}
                          {e.createdAt.toLocaleTimeString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          })}
                        </li>
                      ))}
                  </ol>
                </details>
                <p>
                  Última atividade:{" "}
                  {visit.lastSeenAt.toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                  {visit.endedAt
                    ? " · Saída registrada"
                    : " · Saída não confirmada"}
                </p>
              </>
            )}
          </section>
        );
      })}
      <h2>Solicitações de visita</h2>
      {!lead.requests.length && <p>Nenhuma solicitação recebida.</p>}
      {lead.requests.map((r) => (
        <section key={r.id} className="form-card">
          <p>
            {r.preferredDate.split("-").reverse().join("/")} ·{" "}
            {periodLabels[r.period as keyof typeof periodLabels]}
          </p>
          <RequestStatus id={r.id} status={r.status} />
        </section>
      ))}
    </>
  );
}
