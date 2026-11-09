import Link from "next/link";
import { CalendarDays, Mail, MessageCircle, Plug } from "lucide-react";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/ui";
import { integrationOverview } from "@/features/integrations/service";
import { integrationsReady } from "@/features/integrations/crypto";
import {
  CalendarControls,
  IntegrationForm,
  RetryIntegrations,
  WhatsAppTest,
} from "@/features/integrations/forms";
import { readEnv } from "@/config/env";

export const metadata = { title: "Integrações" };
const stateLabels: Record<string, string> = {
  PENDING: "Na fila",
  RUNNING: "Processando",
  SUCCEEDED: "Sincronizado",
  ACCEPTED: "Aceito pelo provedor",
  DELIVERED: "Entregue",
  FAILED: "Requer atenção",
  SKIPPED: "Não enviado",
  SUPERSEDED: "Substituído por uma atualização",
};
const errors: Record<string, string> = {
  NO_RECIPIENT: "Cadastre o contato do corretor ou da imobiliária.",
  GOOGLE_RECONNECT: "Autorize novamente sua conta Google.",
  HTTP_400: "Confira os dados, o modelo e as permissões do provedor.",
  HTTP_401: "Credencial recusada; conecte novamente.",
  HTTP_403: "Confira as permissões da conta e o domínio de envio.",
  PROVIDER_DELIVERY_FAILED:
    "O provedor informou uma falha de entrega. Confira o destinatário no painel do provedor.",
  DELIVERY_UNKNOWN:
    "Não foi possível confirmar a aceitação. Confira o painel do provedor antes de tentar um novo envio.",
  SOURCE_REMOVED: "A visita ou o cadastro foi removido.",
  DISCONNECTED: "A integração foi desativada.",
  INVALID_CONFIGURATION: "Revise a configuração da integração.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { actor, membership, user } = await requireWorkspace();
  if (!can(membership.role, "lead:read")) return <p>Acesso não permitido.</p>;
  const overview = await integrationOverview(actor),
    manage = can(membership.role, "organization:manage"),
    ready = integrationsReady();
  const get = (provider: string) =>
    overview.settings.find((item) => item.provider === provider);
  const base = readEnv().NEXT_PUBLIC_APP_URL;
  const callback = new URL(
    "/api/integrations/google/callback",
    base,
  ).toString();
  const waHook = new URL(
    `/api/integrations/webhooks/whatsapp/${actor.organizationId}`,
    base,
  ).toString();
  const emailHook = new URL(
    `/api/integrations/webhooks/resend/${actor.organizationId}`,
    base,
  ).toString();
  const { google } = await searchParams;
  return (
    <>
      <PageHeader
        title="Integrações"
        description="Conecte suas ferramentas, siga o passo a passo e acompanhe a sincronização das visitas."
      />
      {!ready && (
        <p className="notice">
          A configuração segura de integrações está indisponível. Entre em
          contato com o suporte para liberar as conexões.
        </p>
      )}
      {google && (
        <p
          role="status"
          className={google === "connected" ? "form-success" : "notice"}
        >
          {google === "connected"
            ? "Google Agenda conectado. Escolha abaixo a agenda que receberá as visitas."
            : google === "denied"
              ? "A autorização foi cancelada. Você pode conectar novamente quando quiser."
              : google === "expired"
                ? "A autorização expirou ou a imobiliária ativa mudou. Inicie a conexão novamente."
                : "Não foi possível conectar o Google. Confira as credenciais, a URI de retorno e as permissões no passo a passo."}
        </p>
      )}
      <div className="integrations-grid">
        <section
          className="form-card integration-card"
          aria-labelledby="google-heading"
        >
          <CalendarDays size={27} />
          <h2 id="google-heading">Google Agenda</h2>
          <p>
            Ao confirmar uma visita com data, horário e duração, envie o
            compromisso para a agenda escolhida. Reagendamentos e cancelamentos
            feitos na ImobView atualizam o evento.
          </p>
          <CalendarControls
            connection={overview.calendar}
            configured={Boolean(get("GOOGLE")?.enabled)}
            ready={ready}
          />
          <p className="muted">
            A ImobView envia os agendamentos para o Google. Faça as alterações
            da visita na ImobView para manter a sincronização.
          </p>
          <details className="integration-guide">
            <summary>Passo a passo para conectar o Google Agenda</summary>
            <ol>
              <li>
                O administrador cria ou escolhe um projeto no{" "}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Cloud Console
                </a>{" "}
                e ativa a Google Calendar API.
              </li>
              <li>
                Em Google Auth Platform, configure o público e a tela de
                consentimento com os dados reais da imobiliária. Em modo de
                teste, adicione as contas que poderão autorizar o aplicativo.
              </li>
              <li>
                Crie um cliente OAuth do tipo “Aplicativo da Web”. Cadastre
                exatamente esta URI de redirecionamento:<code>{callback}</code>
              </li>
              <li>
                Solicite as permissões <code>calendar.events</code> e{" "}
                <code>calendar.calendarlist.readonly</code>, além de
                identificação por e-mail. Para uso em produção, conclua a
                publicação e as verificações exigidas pelo Google.
              </li>
              <li>
                Salve o Client ID e o Client Secret abaixo. Depois, cada
                corretor entra na ImobView, clica em “Conectar com Google” e
                autoriza a própria conta.
              </li>
              <li>
                Escolha uma agenda com permissão de edição. Em{" "}
                <Link href="/app/agenda">Visitas</Link>, defina data, horário e
                duração e mantenha a opção de sincronizar marcada.
              </li>
            </ol>
            <p>
              Uma chave de API isolada não autoriza gravações na agenda. A
              autorização OAuth da conta é necessária e pode ser revogada pelo
              titular.
            </p>
            <a
              href="https://developers.google.com/identity/protocols/oauth2/web-server"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentação oficial do Google ↗
            </a>
          </details>
          {manage && (
            <details className="integration-guide">
              <summary>Configurar aplicativo Google da imobiliária</summary>
              <p>
                Trocar estas credenciais exige nova autorização das contas
                conectadas.
              </p>
              <IntegrationForm
                provider="GOOGLE"
                config={
                  (get("GOOGLE")?.config ?? {}) as Record<string, unknown>
                }
                configured={Boolean(get("GOOGLE"))}
                enabled={Boolean(get("GOOGLE")?.enabled)}
                testEmail={user.email}
                ready={ready}
              />
            </details>
          )}
        </section>
        <section
          className="form-card integration-card"
          aria-labelledby="whatsapp-heading"
        >
          <MessageCircle size={27} />
          <h2 id="whatsapp-heading">WhatsApp Business</h2>
          <p>
            Avise o corretor responsável quando houver solicitação, confirmação,
            reagendamento ou cancelamento. Sem corretor atribuído, o aviso usa o
            WhatsApp comercial da imobiliária.
          </p>
          <p className={get("WHATSAPP")?.enabled ? "form-success" : "muted"}>
            {get("WHATSAPP")?.enabled
              ? "Número e modelo validados. Avisos ativados."
              : "Aguardando configuração da conta WhatsApp Business."}
          </p>
          <details className="integration-guide">
            <summary>Passo a passo para conectar o WhatsApp</summary>
            <ol>
              <li>
                No{" "}
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Meta for Developers
                </a>
                , configure um aplicativo com WhatsApp e associe o número
                comercial à conta WhatsApp Business.
              </li>
              <li>
                Crie um token de usuário do sistema com acesso ao número e à
                conta empresarial. Conceda{" "}
                <code>whatsapp_business_messaging</code> e{" "}
                <code>whatsapp_business_management</code>. Tokens temporários de
                teste expiram.
              </li>
              <li>
                Copie o ID do número, o ID da conta empresarial (WABA), a versão
                da Graph API do aplicativo e o App Secret.
              </li>
              <li>
                Crie e aprove um modelo no idioma escolhido, com estes cinco
                campos no corpo, nesta ordem:
                <code>
                  {
                    "{{1}}. Cliente: {{2}}. Imóvel: {{3}}. Data: {{4}}. Horário/período: {{5}}."
                  }
                </code>
                Use exemplos de solicitação e confirmação para a aprovação. O
                modelo não deve exigir variáveis no cabeçalho ou nos botões.
              </li>
              <li>
                Preencha os campos e clique em “Validar e ativar WhatsApp”. O
                sistema verifica o número e o modelo aprovado antes de ativar.
              </li>
              <li>
                Para receber as confirmações de entrega, configure este callback
                no aplicativo Meta e assine o campo <code>messages</code>:
                <code>{waHook}</code>Use o token de verificação mostrado após
                salvar. O App Secret valida a assinatura dos avisos.
              </li>
              <li>
                Confira o telefone dos corretores em{" "}
                <Link href="/app/equipe">Equipe</Link> e o contato de fallback
                em <Link href="/app/configuracoes">Configurações</Link>. O envio
                segue os preços e limites da Meta.
              </li>
            </ol>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentação oficial do WhatsApp ↗
            </a>
          </details>
          {manage ? (
            <IntegrationForm
              provider="WHATSAPP"
              config={
                (get("WHATSAPP")?.config ?? {}) as Record<string, unknown>
              }
              configured={Boolean(get("WHATSAPP"))}
              enabled={Boolean(get("WHATSAPP")?.enabled)}
              testEmail={user.email}
              ready={ready}
            />
          ) : (
            <p>O administrador da imobiliária configura este canal.</p>
          )}
          {manage && (
            <WhatsAppTest enabled={Boolean(get("WHATSAPP")?.enabled)} />
          )}
        </section>
        <section
          className="form-card integration-card"
          aria-labelledby="email-heading"
        >
          <Mail size={27} />
          <h2 id="email-heading">E-mail com Resend</h2>
          <p>
            Envie avisos de visitas para sua equipe e, se habilitado,
            confirmações para o cliente. Cada imobiliária usa sua própria chave
            e remetente verificado.
          </p>
          <p className={get("EMAIL")?.enabled ? "form-success" : "muted"}>
            {get("EMAIL")?.enabled
              ? "Teste aceito pelo Resend. Integração ativada."
              : "Aguardando configuração e envio de teste."}
          </p>
          <details className="integration-guide">
            <summary>Passo a passo para conectar o e-mail</summary>
            <ol>
              <li>
                Crie ou acesse sua conta no{" "}
                <a
                  href="https://resend.com/domains"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Resend
                </a>
                . Adicione o domínio que enviará as mensagens e publique os
                registros DNS solicitados.
              </li>
              <li>
                Aguarde o domínio ficar verificado. Crie uma chave de API com
                permissão de envio para esse domínio.
              </li>
              <li>
                Informe a chave, o nome e o e-mail do remetente. Se desejar,
                configure um endereço para respostas.
              </li>
              <li>
                Escolha quem receberá os avisos e clique em “Salvar, enviar
                teste e ativar”. O teste vai apenas para o seu e-mail de acesso
                à ImobView. Se o teste falhar, a automação não é ativada.
              </li>
              <li>
                Opcionalmente, em Webhooks no Resend, adicione esta URL e
                selecione <code>email.delivered</code>,{" "}
                <code>email.bounced</code>, <code>email.failed</code> e{" "}
                <code>email.complained</code>:<code>{emailHook}</code>Copie o
                Signing secret no campo abaixo para distinguir aceitação de
                entrega.
              </li>
              <li>
                Cadastre o e-mail do corretor e o e-mail comercial da
                imobiliária para os avisos da equipe. Verifique os limites e as
                condições do seu plano Resend.
              </li>
            </ol>
            <p>
              Esta integração envia notificações. O domínio de envio não cria
              uma caixa de entrada; use um endereço de respostas que sua equipe
              acompanhe.
            </p>
            <a
              href="https://resend.com/docs/send-with-nodejs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentação oficial do Resend ↗
            </a>
          </details>
          {manage ? (
            <IntegrationForm
              provider="EMAIL"
              config={(get("EMAIL")?.config ?? {}) as Record<string, unknown>}
              configured={Boolean(get("EMAIL"))}
              enabled={Boolean(get("EMAIL")?.enabled)}
              testEmail={user.email}
              ready={ready}
            />
          ) : (
            <p>O administrador da imobiliária configura este canal.</p>
          )}
        </section>
      </div>
      <section
        className="form-card integration-history"
        aria-labelledby="integration-history"
      >
        <Plug size={24} />
        <h2 id="integration-history">Histórico de sincronização e envio</h2>
        <p>
          As visitas são salvas mesmo se um provedor estiver indisponível.
          Falhas temporárias entram na fila para nova tentativa. O
          reprocessamento diário complementa os envios imediatos;
          administradores também podem reprocessar as pendências aqui.
        </p>
        {manage && <RetryIntegrations />}
        {overview.deliveries.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Canal</th>
                  <th>Situação</th>
                  <th>Orientação</th>
                </tr>
              </thead>
              <tbody>
                {overview.deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>
                      {delivery.createdAt.toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </td>
                    <td>
                      {delivery.channel === "CALENDAR"
                        ? "Google Agenda"
                        : delivery.channel === "WHATSAPP"
                          ? "WhatsApp"
                          : delivery.channel === "EMAIL_CLIENT"
                            ? "E-mail do cliente"
                            : "E-mail da equipe"}
                    </td>
                    <td>{stateLabels[delivery.state] ?? delivery.state}</td>
                    <td>
                      {delivery.lastError
                        ? (errors[delivery.lastError] ??
                          "Confira o provedor e a configuração da integração.")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            Nenhuma sincronização ou envio registrado ainda. Conecte um canal e
            agende uma visita para começar.
          </p>
        )}
      </section>
    </>
  );
}
