import { requireWorkspace } from "@/server/session";
import { PageHeader, Button } from "@/components/ui";
import { switchWorkspace } from "@/features/organizations/actions";
import { LogoutButton } from "@/features/auth/logout-button";
import { ContactForm } from "@/features/organizations/contact-form";
import { FinancingForm } from "@/features/organizations/financing-form";
import { can } from "@/domain/permissions";
import { withTenant } from "@/server/tenant";
import { organizationUsage } from "@/domain/entitlements";
import { DistributionForm } from "@/features/organizations/distribution-form";
import { whatsappConfigured } from "@/features/notifications/whatsapp";
import Link from "next/link";
export default async function Page() {
  const { actor, membership, memberships, user } = await requireWorkspace();
  const usage = await withTenant(actor, "property:read", (tx) =>
    organizationUsage(tx, actor.organizationId),
  );
  const tenantWhatsApp = can(membership.role, "organization:manage")
    ? await withTenant(actor, "organization:manage", (tx) =>
        tx.organizationIntegration.findUnique({
          where: {
            organizationId_provider: {
              organizationId: actor.organizationId,
              provider: "WHATSAPP",
            },
          },
          select: { enabled: true },
        }),
      )
    : null;
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Seu perfil e seus espaços de trabalho."
      />
      <p className="notice">
        <Link href="/app/integracoes">
          Configurar integrações com Google Agenda, WhatsApp e e-mail — passo a
          passo ↗
        </Link>
      </p>
      <div className="form-card">
        {can(membership.role, "organization:manage") && (
          <>
            <ContactForm organization={usage.organization} />
            <FinancingForm rateBps={usage.organization.financingRateBps} />
            <DistributionForm
              mode={usage.organization.leadDistribution}
              alerts={usage.organization.whatsappVisitAlerts}
              whatsappReady={
                Boolean(tenantWhatsApp?.enabled) || whatsappConfigured()
              }
            />
          </>
        )}
        <section aria-label="Uso da organização">
          <h2>Uso da organização</h2>
          <p>
            {usage.properties} de {usage.organization.maxProperties} imóveis
            ativos · {usage.panoramas} de {usage.organization.maxPanoramas}{" "}
            panoramas
          </p>
          <p>
            {Math.ceil(Number(usage.reservedBytes) / 1048576)} de{" "}
            {Math.floor(Number(usage.organization.maxStorageBytes) / 1048576)}{" "}
            MB reservados.
          </p>
          <p>
            Cada upload reserva espaço para o original e a imagem otimizada. Por
            segurança, uploads recentes descartados mantêm a reserva até a
            limpeza diária, após 24 horas. Os limites do beta são ajustados pelo
            suporte, sem cobrança automática.
          </p>
        </section>
        <h2>Organização ativa</h2>
        <form action={switchWorkspace} className="workspace-form">
          <label className="field">
            Organização
            <select
              name="organizationId"
              defaultValue={membership.organizationId}
            >
              {memberships.map((item) => (
                <option value={item.organizationId} key={item.organizationId}>
                  {item.organization.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Usar organização</Button>
        </form>
        <h2 style={{ marginTop: 40 }}>Sua conta</h2>
        {can(membership.role, "organization:manage") && (
          <p>
            <a
              href="/api/workspace/export"
              className="button button-secondary"
              download
            >
              Exportar dados da organização
            </a>
          </p>
        )}
        <p>
          {user.name}
          <br />
          {user.email}
        </p>
        <LogoutButton />
      </div>
    </>
  );
}
