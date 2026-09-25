import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { PropertyForm } from "@/features/properties/property-form";
export default async function Page() {
  const { membership } = await requireWorkspace();
  if (!can(membership.role, "property:create")) notFound();
  return (
    <>
      <PageHeader
        title="Novo imóvel"
        description="Vamos preparar uma nova apresentação, um passo de cada vez."
      />
      <PropertyForm />
    </>
  );
}
