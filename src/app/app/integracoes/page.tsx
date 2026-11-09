import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  Mail,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/ui";
import { integrationOverview } from "@/features/integrations/service";
import { integrationProviders } from "@/features/integrations/catalog";
import { IntegrationHistory } from "@/features/integrations/history";

export const metadata = { title: "Integrações" };
const icons = { google: CalendarDays, whatsapp: MessageCircle, email: Mail };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { actor, membership } = await requireWorkspace();
  if (!can(membership.role, "lead:read")) return <p>Acesso não permitido.</p>;
  const { google } = await searchParams;
  if (google)
    redirect(`/app/integracoes/google?google=${encodeURIComponent(google)}`);
  const overview = await integrationOverview(actor);
  return (
    <>
      <PageHeader
        title="Integrações"
        description="Suas ferramentas, conectadas à sua rotina. Escolha um serviço para começar."
      />
      <div className="integration-catalog">
        {integrationProviders.map((item) => {
          const setting = overview.settings.find(
            (setting) => setting.provider === item.provider,
          );
          const active =
            item.slug === "google"
              ? Boolean(setting?.enabled && overview.calendar?.connected)
              : Boolean(setting?.enabled);
          const status = active
            ? "Conectado"
            : setting?.enabled && item.slug === "google"
              ? "Conectar sua conta"
              : "Não conectado";
          const Icon = icons[item.slug];
          return (
            <Link
              className={`integration-service integration-service-${item.slug}`}
              href={`/app/integracoes/${item.slug}`}
              key={item.slug}
              aria-label={`Configurar ${item.title}`}
            >
              <div className="integration-service-top">
                <span className="integration-service-icon">
                  <Icon size={26} strokeWidth={1.6} />
                </span>
                <span
                  className="integration-status"
                  data-active={active || undefined}
                >
                  <span />
                  {status}
                </span>
              </div>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <span className="integration-service-link">
                {active ? "Gerenciar conexão" : "Configurar conexão"}
                <ArrowUpRight size={18} />
              </span>
            </Link>
          );
        })}
      </div>
      <p className="integration-assurance">
        <ShieldCheck size={18} aria-hidden="true" /> As conexões são da sua
        imobiliária. Você escolhe o que ativar e pode desconectar quando quiser.
      </p>
      <IntegrationHistory
        deliveries={overview.deliveries}
        manage={can(membership.role, "organization:manage")}
      />
    </>
  );
}
