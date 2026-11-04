import { z } from "zod";
import {
  ContactRound,
  CalendarDays,
  FileText,
  BadgeCheck,
  ArrowUpRight,
  Scan,
  Calculator,
} from "lucide-react";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/ui";
import { analytics } from "@/features/leads/service";
import { listProperties } from "@/features/properties/service";
import { durationLabel } from "@/features/leads/metrics";
import Link from "next/link";
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
  const max = Math.max(
    1,
    ...data.daily.flatMap((day) => [day.leads, day.sessions]),
  );
  const completion = data.started
    ? Math.round((data.completed / data.started) * 100)
    : 0;
  const sourceTotal = data.sources.reduce((sum, item) => sum + item.count, 0);
  const stats = [
    {
      label: "Leads recebidos",
      value: data.leads,
      note: "Novos contatos no período",
      icon: ContactRound,
    },
    {
      label: "Visitas solicitadas",
      value: data.requests,
      note: "Pedidos recebidos pela equipe",
      icon: CalendarDays,
    },
    {
      label: "Leads com proposta",
      value: data.proposals,
      note: "Proposta registrada no CRM",
      icon: FileText,
    },
    {
      label: "Negócios fechados",
      value: data.sales,
      note: "Venda ou locação registrada",
      icon: BadgeCheck,
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="DA VISITA À CONQUISTA"
        title="Analytics"
        description="Uma visão clara de como seus imóveis aproximam pessoas e oportunidades."
        action={
          <span className="analytics-period">
            <span className="status-dot" /> Últimos 30 dias
          </span>
        }
      />
      <form className="filter-form analytics-filter">
        <label className="field">
          Portfólio
          <select
            name="property"
            defaultValue={propertyId.success ? propertyId.data : ""}
          >
            <option value="">Todos os imóveis</option>
            {properties.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-secondary">Aplicar filtro</button>
        <Link className="text-link" href="/app/crm">
          Abrir CRM <ArrowUpRight size={14} />
        </Link>
      </form>
      <div className="analytics-stats">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <div className="stat-top">
              {label}
              <span className="analytics-stat-icon">
                <Icon size={18} />
              </span>
            </div>
            <div className="stat-value">{value.toLocaleString("pt-BR")}</div>
            <div className="stat-note">{note}</div>
          </article>
        ))}
      </div>
      <div className="analytics-main-grid">
        <section className="analytics-panel activity-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>O movimento dos seus imóveis</h2>
              <p>Visitas aos tours e novos contatos, dia a dia.</p>
            </div>
            <div className="chart-legend">
              <span>
                <i />
                Leads
              </span>
              <span>
                <i />
                Visitas
              </span>
            </div>
          </div>
          <div
            className="activity-chart"
            role="img"
            aria-label={`Evolução nos últimos 30 dias. ${data.leads} leads e ${data.sessions} visitas com medição autorizada. Dados diários na tabela abaixo.`}
          >
            <div className="chart-axis">
              {[max, max / 2, 0].map((value, i) => (
                <span key={i}>{value.toLocaleString("pt-BR")}</span>
              ))}
            </div>
            <div className="chart-plot">
              <div className="chart-grid-lines">
                <span />
                <span />
                <span />
              </div>
              <div className="chart-bars">
                {data.daily.map((day) => (
                  <div
                    className="chart-day"
                    key={day.day}
                    title={`${day.day.split("-").reverse().join("/")}: ${day.leads} leads, ${day.sessions} visitas`}
                  >
                    <span
                      className="bar-leads"
                      style={{ height: `${(day.leads / max) * 100}%` }}
                    />
                    <span
                      className="bar-visits"
                      style={{ height: `${(day.sessions / max) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="chart-dates">
                {[data.daily[0], data.daily[14], data.daily.at(-1)].map(
                  (day) => (
                    <span key={day?.day}>
                      {day?.day.slice(5).split("-").reverse().join("/")}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
          {!data.leads && !data.sessions && (
            <p className="chart-no-data">
              Seu histórico aparecerá aqui conforme os primeiros contatos e
              visitas chegarem.
            </p>
          )}
          <details className="chart-data">
            <summary>Consultar dados diários</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Leads</th>
                    <th>Visitas medidas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((day) => (
                    <tr key={day.day}>
                      <td>{day.day.split("-").reverse().join("/")}</td>
                      <td>{day.leads}</td>
                      <td>{day.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section className="analytics-panel tour-engagement">
          <div className="analytics-panel-heading">
            <div>
              <h2>Experiência 360°</h2>
              <p>Do primeiro olhar à exploração completa.</p>
            </div>
            <Scan size={21} />
          </div>
          <div
            className="completion-ring"
            style={
              {
                "--completion": `${completion * 3.6}deg`,
              } as React.CSSProperties
            }
          >
            <div>
              <strong>{completion}%</strong>
              <span>de conclusão</span>
            </div>
          </div>
          <p>
            {data.started
              ? "dos tours iniciados tiveram todos os ambientes abertos."
              : "Aguardando os primeiros tours iniciados."}
          </p>
          <div className="tour-stat-row">
            <span>Visitas com medição</span>
            <strong>{data.sessions}</strong>
          </div>
          <div className="tour-stat-row">
            <span>Tours iniciados</span>
            <strong>{data.started}</strong>
          </div>
          <div className="tour-stat-row">
            <span>Todos os ambientes abertos</span>
            <strong>{data.completed}</strong>
          </div>
        </section>
      </div>
      <div className="analytics-secondary-grid">
        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>De onde vêm as visitas</h2>
              <p>Origem das sessões com medição autorizada.</p>
            </div>
            <ArrowUpRight size={20} />
          </div>
          {data.sources.length ? (
            <div className="source-bars">
              {data.sources.slice(0, 8).map(({ source, count }) => (
                <div key={source}>
                  <div>
                    <span>
                      {source === "direct"
                        ? "Acesso direto"
                        : source === "marketplace"
                          ? "Portal ImobView"
                          : source}
                    </span>
                    <strong>
                      {count}{" "}
                      <small>
                        · {Math.round((count / Math.max(1, sourceTotal)) * 100)}
                        %
                      </small>
                    </strong>
                  </div>
                  <div className="source-track">
                    <span
                      style={{
                        width: `${(count / Math.max(1, sourceTotal)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="analytics-empty">
              <ContactRound size={28} />
              <p>
                As origens aparecerão após as primeiras visitas autorizadas.
              </p>
            </div>
          )}
        </section>
        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Ambientes que despertam interesse</h2>
              <p>Tempo ativo médio por abertura.</p>
            </div>
            <Scan size={20} />
          </div>
          {data.rooms.length ? (
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
                  {data.rooms.slice(0, 8).map((room) => (
                    <tr key={room.id}>
                      <td>
                        <strong>{room.title}</strong>
                        <small>{room.property}</small>
                      </td>
                      <td>{room.views}</td>
                      <td>
                        {durationLabel(
                          room.views ? room.duration / room.views : 0,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="analytics-empty">
              <Scan size={28} />
              <p>
                Conheça os ambientes mais explorados assim que houver navegação
                registrada.
              </p>
            </div>
          )}
        </section>
      </div>
      <div className="analytics-financing">
        <Calculator size={23} />
        <div>
          <strong>{data.simulations} simulações de financiamento</strong>
          <p>Simulações realizadas nos imóveis no período selecionado.</p>
        </div>
        <Link href="/app/leads" className="text-link">
          Consultar clientes <ArrowUpRight size={15} />
        </Link>
      </div>
      <p className="analytics-method">
        Visitas e navegação incluem somente medição autorizada. Leads e
        solicitações podem existir sem medição. Propostas e fechamentos
        referem-se aos leads recebidos no período e são registrados pela equipe.
        Conclusão do tour indica cobertura dos ambientes. Origens são declaradas
        pelo visitante; não comprovam atribuição de venda. Até 100 origens e
        3.000 ambientes são considerados.
      </p>
    </>
  );
}
