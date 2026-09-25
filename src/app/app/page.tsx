import Link from "next/link";
import {
  Plus,
  Building2,
  Globe,
  FilePenLine,
  ArrowUpRight,
  Scan,
} from "lucide-react";
import { requireWorkspace } from "@/server/session";
import {
  listProperties,
  getPropertyStats,
} from "@/features/properties/service";
import { PageHeader, ButtonLink, EmptyState } from "@/components/ui";
import { PropertyCard } from "@/components/property-card";
import { can } from "@/domain/permissions";
export default async function Dashboard() {
  const { actor, user, membership } = await requireWorkspace();
  const [allProperties, counts] = await Promise.all([
    listProperties(actor),
    getPropertyStats(actor),
  ]);
  const properties = allProperties.filter(
    (property) => property.status !== "ARCHIVED",
  );
  const stats = [
    {
      label: "Imóveis no portfólio",
      value: counts.active,
      note: "Prontos para um novo olhar",
      icon: Building2,
    },
    {
      label: "Imóveis publicados",
      value: counts.published,
      note: "Disponíveis para compartilhar",
      icon: Globe,
    },
    {
      label: "Em preparação",
      value: counts.drafts,
      note: "Sua próxima apresentação",
      icon: FilePenLine,
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="SEU ESPAÇO DE POSSIBILIDADES"
        title={`Olá, ${user.name.split(" ")[0]}.`}
        description="Um novo dia para aproximar pessoas e lugares."
        action={
          can(membership.role, "property:create") && (
            <ButtonLink href="/app/imoveis/novo">
              <Plus size={16} /> Novo imóvel
            </ButtonLink>
          )
        }
      />
      <div className="stats-grid">
        {stats.map(({ icon: Icon, ...stat }) => (
          <article className="stat-card" key={stat.label}>
            <div className="stat-top">
              {stat.label}
              <Icon size={19} />
            </div>
            <div className="stat-value">
              {stat.value.toString().padStart(2, "0")}
            </div>
            <div className="stat-note">{stat.note}</div>
          </article>
        ))}
      </div>
      <div className="dashboard-banner">
        <div>
          <p className="eyebrow">CADA IMÓVEL TEM UMA HISTÓRIA</p>
          <h2>Uma boa apresentação abre novas portas.</h2>
          <p>
            Organize os detalhes, publique sua página e compartilhe uma nova
            perspectiva com seus clientes.
          </p>
          <Link href="/demonstracao" className="text-link">
            Conheça uma apresentação <ArrowUpRight size={15} />
          </Link>
        </div>
        <Scan size={85} strokeWidth={1} />
      </div>
      <div className="subheading">
        <h2>Seus imóveis recentes</h2>
        <Link href="/app/imoveis">Ver portfólio completo ↗</Link>
      </div>
      {properties.length ? (
        <div className="property-grid">
          {properties.slice(0, 6).map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
      <p className="muted" style={{ fontSize: 11, marginTop: 25 }}>
        Vídeos, tours e métricas de interesse serão disponibilizados nas
        próximas etapas.
      </p>
    </>
  );
}
