import Link from "next/link";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader, ButtonLink } from "@/components/ui";
import { listLeads } from "@/features/leads/service";
import { stageLabels, stageSchema } from "@/features/leads/schema";
import { InterestBadge } from "@/features/leads/interest";
const columns = [
  {
    title: "Novos contatos",
    stages: ["NEW", "TOUR_STARTED", "TOUR_COMPLETED"],
    color: "blue",
  },
  {
    title: "Em atendimento",
    stages: ["INTERESTED", "VISIT_REQUESTED"],
    color: "amber",
  },
  { title: "Negociação", stages: ["NEGOTIATION", "PROPOSAL"], color: "purple" },
  { title: "Fechados", stages: ["WON"], color: "green" },
  { title: "Perdidos", stages: ["LOST"], color: "gray" },
];
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; stage?: string; q?: string }>;
}) {
  const { actor, membership } = await requireWorkspace();
  if (!can(membership.role, "lead:read")) return <p>Acesso não permitido.</p>;
  const params = await searchParams;
  const stage = stageSchema.safeParse(params.stage);
  const all = await listLeads(
    actor,
    undefined,
    stage.success ? stage.data : undefined,
  );
  const query =
    typeof params.q === "string" ? params.q.toLowerCase().slice(0, 160) : "";
  const leads = all.filter(
    (lead) =>
      (!params.level ||
        !["HOT", "WARM", "COLD"].includes(params.level) ||
        lead.interest.level === params.level) &&
      (!query || lead.name.toLowerCase().includes(query)),
  );
  const hot = leads.filter(
    (lead) =>
      lead.interest.level === "HOT" && !["WON", "LOST"].includes(lead.stage),
  ).length;
  return (
    <>
      <PageHeader
        eyebrow="CADA CONVERSA, UMA OPORTUNIDADE"
        title="CRM"
        description="Acompanhe o atendimento do primeiro contato ao fechamento."
        action={
          <ButtonLink href="/app/leads" variant="secondary">
            Ver base de clientes ↗
          </ButtonLink>
        }
      />
      <div className="crm-summary">
        <strong>{leads.length} contatos nesta seleção</strong>
        <span>{hot} com interesse alto em aberto</span>
        <span>
          {leads.filter((lead) => lead.stage === "WON").length} fechamentos
        </span>
      </div>
      <form className="filter-form">
        <label className="field">
          Cliente
          <input
            name="q"
            maxLength={160}
            defaultValue={query}
            placeholder="Buscar por nome"
          />
        </label>
        <label className="field">
          Interesse
          <select name="level" defaultValue={params.level ?? ""}>
            <option value="">Todos</option>
            <option value="HOT">Quente</option>
            <option value="WARM">Morno</option>
            <option value="COLD">Frio</option>
          </select>
        </label>
        <label className="field">
          Etapa
          <select name="stage" defaultValue={stage.success ? stage.data : ""}>
            <option value="">Todas</option>
            {Object.entries(stageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-secondary">Filtrar</button>
        <Link className="text-link" href="/app/crm">
          Limpar
        </Link>
      </form>
      <div className="crm-board">
        {columns.map((column) => {
          const items = leads.filter((lead) =>
            column.stages.includes(lead.stage),
          );
          return (
            <section
              className={`crm-column crm-${column.color}`}
              key={column.title}
            >
              <h2>
                <span className="crm-dot" />
                {column.title}
                <small>{items.length}</small>
              </h2>
              {items.length ? (
                items.map((lead) => (
                  <article className="crm-card" key={lead.id}>
                    <div className="lead-card-top">
                      <span className="listing-type">
                        {stageLabels[stageSchema.parse(lead.stage)]}
                      </span>
                      <InterestBadge interest={lead.interest} />
                    </div>
                    <h3>
                      <Link href={`/app/leads/${lead.id}`}>{lead.name}</Link>
                    </h3>
                    <p>{lead.property?.title ?? "Imóvel a definir"}</p>
                    <span>{lead.broker?.name ?? "Atribuir responsável"}</span>
                    <Link
                      className="text-link"
                      href={`/app/leads/${lead.id}#atendimento`}
                    >
                      Atualizar atendimento ↗
                    </Link>
                  </article>
                ))
              ) : (
                <p className="crm-empty">Nenhum contato nesta etapa.</p>
              )}
            </section>
          );
        })}
      </div>
      <p className="muted">
        Exibindo até 200 contatos com atividade mais recente. Abra o atendimento
        para alterar etapa, corretor e anotações. Todos os clientes estão
        disponíveis na aba Leads.
      </p>
    </>
  );
}
