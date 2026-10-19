import Link from "next/link";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/ui";
import { listRequests } from "@/features/leads/service";
import { RequestStatus } from "@/features/leads/lead-form";
import { periodLabels } from "@/features/leads/schema";
export default async function Page() {
  const { actor, membership } = await requireWorkspace();
  if (!can(membership.role, "lead:read")) return <p>Acesso não permitido.</p>;
  const requests = await listRequests(actor);
  return (
    <>
      <PageHeader
        title="Solicitações de visita"
        description="Combine o horário com o cliente antes de confirmar. Não há sincronização com calendários externos."
      />
      {!requests.length ? (
        <p className="notice">Nenhuma visita solicitada ainda.</p>
      ) : (
        <div className="lead-grid">
          {requests.map((r) => (
            <article className="form-card" key={r.id}>
              <h2>
                <Link href={`/app/leads/${r.leadId}`}>{r.lead.name}</Link>
              </h2>
              <p>{r.lead.property.title}</p>
              <p>
                {r.preferredDate.split("-").reverse().join("/")} ·{" "}
                {periodLabels[r.period as keyof typeof periodLabels]}
              </p>
              <RequestStatus id={r.id} status={r.status} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
