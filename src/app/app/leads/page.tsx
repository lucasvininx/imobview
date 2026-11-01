import Link from "next/link";
import { z } from "zod";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/ui";
import { listLeads } from "@/features/leads/service";
import { stageSchema, stageLabels } from "@/features/leads/schema";
import { interestLabels } from "@/features/leads/score";
import { InterestBadge } from "@/features/leads/interest";
const levelSchema = z.enum(["HOT", "WARM", "COLD"]);
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; level?: string; sort?: string }>;
}) {
  const { actor, membership } = await requireWorkspace();
  const { stage, level, sort } = await searchParams;
  if (!can(membership.role, "lead:read"))
    return <p className="notice">Seu perfil não possui acesso aos leads.</p>;
  const filter = stageSchema.safeParse(stage);
  const levelFilter = levelSchema.safeParse(level);
  const all = await listLeads(
    actor,
    undefined,
    filter.success ? filter.data : undefined,
  );
  const leads = all.filter(
    (lead) => !levelFilter.success || lead.interest.level === levelFilter.data,
  );
  if (sort !== "recent")
    leads.sort((a, b) => b.interest.score - a.interest.score);
  const hot = all.filter((lead) => lead.interest.level === "HOT").length;
  return (
    <>
      <PageHeader
        title="Leads e CRM"
        description="Da visita virtual à conversa com a sua imobiliária."
      />
      {hot > 0 && (
        <p className="notice">
          {hot === 1
            ? "1 lead quente aguardando contato."
            : `${hot} leads quentes aguardando contato.`}{" "}
          <Link href="/app/leads?level=HOT" className="text-link">
            Ver somente os quentes
          </Link>
        </p>
      )}
      <form className="filter-form">
        <label className="field">
          Interesse
          <select name="level" defaultValue={level ?? ""}>
            <option value="">Todos</option>
            {levelSchema.options.map((key) => (
              <option key={key} value={key}>
                {interestLabels[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Ordenar por
          <select name="sort" defaultValue={sort ?? ""}>
            <option value="">Maior interesse</option>
            <option value="recent">Atividade recente</option>
          </select>
        </label>
        <label className="field">
          Filtrar etapa
          <select name="stage" defaultValue={stage ?? ""}>
            <option value="">Todas</option>
            {Object.entries(stageLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-secondary">Filtrar</button>
      </form>
      {!leads.length ? (
        <p className="notice">
          Nenhum lead nesta seleção. Ative a captura no imóvel e compartilhe a
          página publicada.
        </p>
      ) : (
        <div className="lead-grid">
          {leads.map((lead) => (
            <article className="form-card" key={lead.id}>
              <div className="lead-card-top">
                <p className="eyebrow">
                  {stageLabels[stageSchema.parse(lead.stage)]}
                </p>
                <InterestBadge interest={lead.interest} />
              </div>
              <h2>
                <Link href={`/app/leads/${lead.id}`}>{lead.name}</Link>
              </h2>
              <p>{lead.property.title}</p>
              <p>
                Origem: {lead.source} ·{" "}
                {new Date(lead.createdAt).toLocaleDateString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              </p>
              <p>{lead._count.requests} solicitação(ões) de visita</p>
              {lead.interest.reasons.length > 0 && (
                <p className="muted">
                  {lead.interest.reasons
                    .filter((reason) => reason.points > 0)
                    .slice(0, 2)
                    .map((reason) => reason.label)
                    .join(" · ")}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="muted">
        Até 200 leads com atividade mais recente por seleção. Abra um lead para
        atualizar sua etapa comercial.
      </p>
    </>
  );
}
