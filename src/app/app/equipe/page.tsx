import { requireWorkspace } from "@/server/session";
import { withTenant } from "@/server/tenant";
import { can } from "@/domain/permissions";
import { PageHeader, Badge } from "@/components/ui";
import { listBrokers } from "@/features/organizations/brokers";
import {
  BrokerForm,
  DeactivateBroker,
} from "@/features/organizations/broker-form";
export default async function Page() {
  const { actor, membership } = await requireWorkspace();
  const allowed = can(membership.role, "organization:manage");
  const brokers = allowed ? await listBrokers(actor) : [];
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
          <BrokerForm />
          <h2>Corretores</h2>
          {!brokers.length && <p>Nenhum corretor cadastrado.</p>}
          <ul className="member-list">
            {brokers.map((b) => (
              <li key={b.id}>
                <span>
                  {b.name} · {b.email} · {b.active ? "Ativo" : "Inativo"}
                </span>
                {b.active && <DeactivateBroker id={b.id} />}
              </li>
            ))}
          </ul>
          <h2>Contas de acesso</h2>
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
