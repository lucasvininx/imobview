import { notFound } from "next/navigation";
import { requireWorkspace } from "@/server/session";
import { getProperty } from "@/features/properties/service";
import { DomainError } from "@/domain/errors";
import { can } from "@/domain/permissions";
import { PageHeader, Badge, ButtonLink } from "@/components/ui";
import { PropertyForm } from "@/features/properties/property-form";
import { StatusActions } from "@/features/properties/status-actions";
import { propertySchema, statusLabels } from "@/features/properties/schema";
import { money } from "@/lib/format";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { actor, membership } = await requireWorkspace();
  const { id } = await params;
  const { salvo } = await searchParams;
  const property = await getProperty(actor, id).catch((error) => {
    if (error instanceof DomainError) notFound();
    throw error;
  });
  const price = property.priceCents;
  const initial = {
    title: property.title,
    description: property.description,
    type: property.type,
    purpose: property.purpose,
    city: property.city,
    state: propertySchema.shape.state.parse(property.state),
    neighborhood: property.neighborhood,
    price: `${price / BigInt(100)},${(price % BigInt(100)).toString().padStart(2, "0")}`,
    area: property.area,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parkingSpaces: property.parkingSpaces,
  };
  return (
    <>
      <PageHeader
        title={property.title}
        description={`${property.city} · ${money(price)}`}
        action={
          <Badge active={property.status === "PUBLISHED"}>
            {statusLabels[property.status]}
          </Badge>
        }
      />
      {salvo === "1" && (
        <p className="form-success" role="status">
          Imóvel salvo com sucesso.
        </p>
      )}
      {property.status === "PUBLISHED" && (
        <p>
          <ButtonLink href={`/v/${property.slug}`} variant="secondary">
            Abrir página pública ↗
          </ButtonLink>
        </p>
      )}
      {can(membership.role, "property:update") &&
      property.status !== "ARCHIVED" ? (
        <PropertyForm id={id} initial={initial} />
      ) : (
        <p className="notice">
          {property.description || "Este imóvel ainda não possui descrição."}
        </p>
      )}
      {can(membership.role, "property:publish") && (
        <StatusActions id={id} status={property.status} />
      )}
    </>
  );
}
