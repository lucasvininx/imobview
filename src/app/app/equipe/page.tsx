import { requireWorkspace } from "@/server/session";
import { withTenant } from "@/server/tenant";
import { can } from "@/domain/permissions";
import { PageHeader, Badge } from "@/components/ui";
export default async function Page() {
  const { actor, membership } = await requireWorkspace();
  const allowed = can(membership.role, "organization:manage");
  const members = allowed
    ? await withTenant(actor, "organization:manage", (tx) =>
        tx.organizationMember.findMany({
          where: { organizationId: actor.organizationId },
          select: { role: true, user: { select: { id: true, name: true } } },
        }),
      )
    : [];
  return (
    <>
      <PageHeader title="Equipe" description={membership.organization.name} />
      {allowed ? (
        <>
          <ul className="member-list">
            {members.map((member) => (
              <li key={member.user.id}>
                <span>{member.user.name}</span>
                <Badge>{member.role}</Badge>
              </li>
            ))}
          </ul>
          <p className="notice">
            Convites e gestão de membros estarão disponíveis em uma próxima
            etapa. As permissões de acesso já são aplicadas.
          </p>
        </>
      ) : (
        <p className="notice">
          Seu perfil não possui permissão para administrar a equipe.
        </p>
      )}
    </>
  );
}
