import { Plus } from "lucide-react";
import { requireWorkspace } from "@/server/session";
import { listProperties } from "@/features/properties/service";
import { PropertyCard } from "@/components/property-card";
import { PageHeader, ButtonLink, EmptyState, Button } from "@/components/ui";
import { can } from "@/domain/permissions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { actor, membership } = await requireWorkspace();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 160) : "";
  const properties = await listProperties(actor, query);
  return (
    <>
      <PageHeader
        eyebrow="SEU PORTFÓLIO"
        title="Imóveis"
        description="Cada espaço, uma nova possibilidade."
        action={
          can(membership.role, "property:create") && (
            <ButtonLink href="/app/imoveis/novo">
              <Plus size={16} />
              Novo imóvel
            </ButtonLink>
          )
        }
      />
      <form className="filter-form">
        <label className="sr-only" htmlFor="property-search">
          Buscar imóveis
        </label>
        <input
          id="property-search"
          className="search-input"
          name="q"
          defaultValue={query}
          placeholder="Buscar pelo nome do imóvel..."
          maxLength={160}
        />
        <Button variant="secondary">Buscar</Button>
      </form>
      {properties.length ? (
        <div className="property-grid">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={query ? "Nenhum imóvel encontrado" : undefined}
          description={
            query ? "Tente outro nome para encontrar o que procura." : undefined
          }
          action={
            query ? (
              <ButtonLink href="/app/imoveis" variant="secondary">
                Limpar busca
              </ButtonLink>
            ) : undefined
          }
        />
      )}
      <p className="muted" style={{ fontSize: 11, marginTop: 25 }}>
        Exibindo até 100 imóveis, dos mais recentes aos mais antigos.
      </p>
    </>
  );
}
