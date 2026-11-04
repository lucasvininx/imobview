import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/ui";
import { listProperties } from "@/features/properties/service";
import { ProfileForm } from "@/features/leads/profile-form";
export default async function Page() {
  const { actor, membership } = await requireWorkspace();
  if (!can(membership.role, "lead:update")) return <p>Acesso não permitido.</p>;
  const properties = await listProperties(actor);
  return (
    <>
      <PageHeader
        eyebrow="SUA BASE DE CLIENTES"
        title="Novo lead"
        description="Cadastre um contato mesmo antes de escolher um imóvel."
      />
      <ProfileForm
        properties={properties.map(({ id, title }) => ({ id, title }))}
      />
    </>
  );
}
