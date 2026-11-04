import Link from "next/link";
import { Plus, ContactRound, UserCheck, UserRoundPen } from "lucide-react";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader, ButtonLink } from "@/components/ui";
import { leadDirectory } from "@/features/leads/service";
import { isCompleteLead } from "@/features/leads/profile-schema";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    completeness?: string;
    source?: string;
    page?: string;
  }>;
}) {
  const { actor, membership } = await requireWorkspace();
  if (!can(membership.role, "lead:read"))
    return <p className="notice">Seu perfil não possui acesso aos leads.</p>;
  const params = await searchParams;
  const data = await leadDirectory(actor, {
    q: typeof params.q === "string" ? params.q.slice(0, 160) : "",
    completeness: ["complete", "incomplete"].includes(params.completeness ?? "")
      ? params.completeness
      : "",
    source: ["manual", "marketplace", "tour"].includes(params.source ?? "")
      ? params.source
      : "",
    page: /^\d+$/.test(params.page ?? "")
      ? Math.min(10000, Math.max(1, Number(params.page)))
      : 1,
  });
  function pageUrl(page: number) {
    const query = new URLSearchParams({ ...data.filters, page: String(page) });
    return `/app/leads?${query}`;
  }
  return (
    <>
      <PageHeader
        eyebrow="RELACIONAMENTOS QUE ABREM PORTAS"
        title="Leads"
        description="Todos os contatos e clientes da sua imobiliária, em um só lugar."
        action={
          can(membership.role, "lead:update") && (
            <ButtonLink href="/app/leads/novo">
              <Plus size={16} /> Novo lead
            </ButtonLink>
          )
        }
      />
      <div className="stats-grid">
        {[
          { label: "Clientes na base", value: data.all, icon: ContactRound },
          {
            label: "Cadastros completos",
            value: data.completed,
            icon: UserCheck,
          },
          {
            label: "A completar",
            value: data.all - data.completed,
            icon: UserRoundPen,
          },
        ].map(({ label, value, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <div className="stat-top">
              {label}
              <Icon size={19} />
            </div>
            <div className="stat-value">{value}</div>
          </article>
        ))}
      </div>
      <form className="filter-form">
        <label className="field">
          Buscar cliente
          <input
            name="q"
            defaultValue={data.filters.q}
            maxLength={160}
            placeholder="Nome, e-mail, celular ou CPF"
          />
        </label>
        <label className="field">
          Cadastro
          <select name="completeness" defaultValue={data.filters.completeness}>
            <option value="">Todos</option>
            <option value="complete">Completo</option>
            <option value="incomplete">A completar</option>
          </select>
        </label>
        <label className="field">
          Origem
          <select name="source" defaultValue={data.filters.source}>
            <option value="">Todas</option>
            <option value="manual">Cadastro pela equipe</option>
            <option value="marketplace">Portal ImobView</option>
            <option value="tour">Tour / outras origens</option>
          </select>
        </label>
        <button className="button button-secondary">Filtrar</button>
        <Link className="text-link" href="/app/leads">
          Limpar
        </Link>
      </form>
      <div className="form-card lead-directory">
        <div className="subheading">
          <h2>
            Base de clientes <small>({data.total})</small>
          </h2>
          <Link href="/app/crm" className="text-link">
            Abrir CRM ↗
          </Link>
        </div>
        {!data.items.length ? (
          <div className="market-empty">
            <ContactRound size={30} />
            <h3>Nenhum contato nesta seleção.</h3>
            <p>
              Cadastre um cliente ou receba novos interessados pelas páginas dos
              imóveis e tours.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Cadastro</th>
                  <th>Origem</th>
                  <th>Responsável</th>
                  <th>Interesse</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <Link
                        className="lead-name"
                        href={`/app/leads/${lead.id}`}
                      >
                        {lead.name}
                      </Link>
                      <small>
                        {lead.createdAt.toLocaleDateString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })}
                      </small>
                    </td>
                    <td>
                      <span>{lead.email || "E-mail não informado"}</span>
                      <small>{lead.phone || "Celular não informado"}</small>
                    </td>
                    <td>
                      <span
                        className={`profile-badge ${isCompleteLead(lead) ? "complete" : "incomplete"}`}
                      >
                        {isCompleteLead(lead) ? "Completo" : "A completar"}
                      </span>
                    </td>
                    <td>
                      {lead.source === "manual"
                        ? "Equipe"
                        : lead.source === "marketplace"
                          ? "Portal ImobView"
                          : `Tour · ${lead.source}`}
                    </td>
                    <td>{lead.broker?.name ?? "Não atribuído"}</td>
                    <td>{lead.property?.title ?? "Imóvel a definir"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data.total > 30 && (
        <nav className="market-pagination" aria-label="Páginas de leads">
          {data.filters.page > 1 && (
            <Link
              className="button button-secondary"
              href={pageUrl(data.filters.page - 1)}
            >
              Anterior
            </Link>
          )}
          <span>
            Página {data.filters.page} de {Math.ceil(data.total / 30)}
          </span>
          {data.filters.page * 30 < data.total && (
            <Link
              className="button button-secondary"
              href={pageUrl(data.filters.page + 1)}
            >
              Próxima
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
