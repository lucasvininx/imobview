import { z } from "zod";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/ui";
import { analytics } from "@/features/leads/service";
import { listProperties } from "@/features/properties/service";
import { durationLabel } from "@/features/leads/metrics";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const { actor, membership } = await requireWorkspace();
  if (!can(membership.role, "lead:read")) return <p>Acesso não permitido.</p>;
  const params = await searchParams;
  const propertyId = z.uuid().safeParse(params.property);
  const [data, properties] = await Promise.all([
    analytics(actor, propertyId.success ? propertyId.data : undefined),
    listProperties(actor),
  ]);
  const funnel = [
    ["Visitas com medição autorizada", data.sessions],
    ["Tours iniciados", data.started],
    ["Todos os ambientes abertos", data.completed],
  ] as const;
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Últimos 30 dias · Dados reais das visitas que autorizaram medição."
      />
      <form className="filter-form">
        <label className="field">
          Imóvel
          <select name="property" defaultValue={params.property ?? ""}>
            <option value="">Todos os imóveis</option>
            {properties.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-secondary">Aplicar</button>
      </form>
      <div className="stats-grid commercial-stats">
        {[
          ["Leads recebidos", data.leads],
          ["Visitas solicitadas", data.requests],
          ["Leads com proposta", data.proposals],
          ["Leads com venda registrada", data.sales],
          ["Simulações de financiamento", data.simulations],
        ].map(([label, value]) => (
          <article className="stat-card" key={label}>
            <p>{label}</p>
            <strong className="stat-value">{value}</strong>
          </article>
        ))}
      </div>
      <section className="form-card">
        <h2>Funil do tour</h2>
        {funnel.map(([label, value]) => (
          <div className="funnel-row" key={label}>
            <span>
              {label}: <strong>{value}</strong>
            </span>
            <meter min={0} max={Math.max(1, data.sessions)} value={value}>
              {value}
            </meter>
          </div>
        ))}
        <p>
          {data.started
            ? `${Math.round((data.completed / data.started) * 100)}% dos tours iniciados abriram todos os ambientes.`
            : "Ainda não há tours iniciados com medição."}
        </p>
        <p className="muted">
          Não inclui navegação sem consentimento. Abertura de todos os ambientes
          indica cobertura do tour, não intenção de compra. Leads e visitas
          solicitadas podem existir sem medição. Propostas e vendas são marcadas
          pela equipe nos leads recebidos no período.
        </p>
      </section>
      <section className="form-card">
        <h2>Interesse por ambiente</h2>
        <p className="muted">
          Tempo médio por abertura; tempo ativo aproximado. Até 3.000 ambientes,
          ordenados pelo tempo registrado.
        </p>
        {!data.rooms.length ? (
          <p>Ainda não há navegação registrada.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Imóvel / ambiente</th>
                  <th>Aberturas</th>
                  <th>Tempo médio</th>
                </tr>
              </thead>
              <tbody>
                {data.rooms.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.property} / {r.title}
                    </td>
                    <td>{r.views}</td>
                    <td>{durationLabel(r.views ? r.duration / r.views : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="form-card">
        <h2>Origem das visitas medidas</h2>
        {!data.sources.length ? (
          <p>Sem dados no período.</p>
        ) : (
          <ul>
            {data.sources.map(({ source, count }) => (
              <li key={source}>
                {source}: {count}
              </li>
            ))}
          </ul>
        )}
        <p className="muted">
          Origem declarada por utm_source ou domínio de referência; não comprova
          atribuição de venda. Até 100 origens com maior volume.
        </p>
      </section>
    </>
  );
}
