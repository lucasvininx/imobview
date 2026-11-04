import Link from "next/link";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader, ButtonLink } from "@/components/ui";
import { listLeads } from "@/features/leads/service";
import { stageLabels, stageSchema } from "@/features/leads/schema";
import { CrmBoard } from "@/features/leads/crm-board";
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
      <CrmBoard
        canMove={can(membership.role, "lead:update")}
        leads={leads.map((lead) => ({
          id: lead.id,
          name: lead.name,
          stage: stageSchema.parse(lead.stage),
          property: lead.property?.title ?? "Imóvel a definir",
          broker: lead.broker?.name ?? "Atribuir responsável",
          interest: lead.interest,
        }))}
      />
      <p className="muted">
        Exibindo até 200 contatos com atividade mais recente. Arraste para mudar
        a etapa ou use o seletor do cartão. Todos os clientes estão disponíveis
        na aba Leads.
      </p>
    </>
  );
}
