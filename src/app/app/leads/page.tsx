import Link from "next/link";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/ui";
import { listLeads } from "@/features/leads/service";
import { stageSchema, stageLabels } from "@/features/leads/schema";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { actor, membership } = await requireWorkspace();
  const { stage } = await searchParams;
  if (!can(membership.role, "lead:read"))
    return <p className="notice">Seu perfil não possui acesso aos leads.</p>;
  const filter = stageSchema.safeParse(stage);
  const leads = await listLeads(
    actor,
    undefined,
    filter.success ? filter.data : undefined,
  );
  return (
    <>
      <PageHeader
        title="Leads e CRM"
        description="Da visita virtual à conversa com a sua imobiliária."
      />
      <form className="filter-form">
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
              <p className="eyebrow">
                {stageLabels[stageSchema.parse(lead.stage)]}
              </p>
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
            </article>
          ))}
        </div>
      )}
      <p className="muted">
        Até 200 leads mais recentes por seleção. Abra um lead para atualizar sua
        etapa comercial.
      </p>
    </>
  );
}
