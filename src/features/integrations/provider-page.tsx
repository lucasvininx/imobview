import Link from "next/link";
import { ArrowLeft, CalendarDays, Mail, MessageCircle } from "lucide-react";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/ui";
import { integrationOverview } from "./service";
import { integrationsReady } from "./crypto";
import { CalendarControls, IntegrationForm, WhatsAppTest } from "./forms";
import { IntegrationHistory } from "./history";
import { integrationProviders, type IntegrationSlug } from "./catalog";
import { readEnv } from "@/config/env";

export async function IntegrationDetail({
  provider,
  googleResult,
}: {
  provider: IntegrationSlug;
  googleResult?: string;
}) {
  const { actor, membership, user } = await requireWorkspace();
  if (!can(membership.role, "lead:read")) return <p>Acesso não permitido.</p>;
  const overview = await integrationOverview(actor),
    manage = can(membership.role, "organization:manage"),
    ready = integrationsReady();
  const get = (name: string) =>
    overview.settings.find((item) => item.provider === name);
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
  const selected = integrationProviders.find((item) => item.slug === provider)!;
  const google = provider === "google" ? googleResult : undefined;
  return (
    <>
      <Link className="integration-back" href="/app/integracoes">
        <ArrowLeft size={16} /> Todas as integrações
      </Link>
      <PageHeader title={selected.title} description={selected.description} />
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
      <div className="integration-detail">
        {provider === "google" && (
          <section
            className="form-card integration-card"
            aria-labelledby="google-heading"
          >
            <CalendarDays size={27} />
            <h2 id="google-heading">Google Agenda</h2>
            <p>
              Ao confirmar uma visita com data, horário e duração, envie o
              compromisso para a agenda escolhida. Reagendamentos e
              cancelamentos feitos na ImobView atualizam o evento.
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
                  exatamente esta URI de redirecionamento:
                  <code>{callback}</code>
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
                  <Link href="/app/agenda">Visitas</Link>, defina data, horário
                  e duração e mantenha a opção de sincronizar marcada.
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
        )}
        {provider === "whatsapp" && (
          <section
            className="form-card integration-card"
            aria-labelledby="whatsapp-heading"
          >
            <MessageCircle size={27} />
            <h2 id="whatsapp-heading">WhatsApp Business</h2>
            <p>
              Avise o corretor responsável quando houver solicitação,
              confirmação, reagendamento ou cancelamento. Sem corretor
              atribuído, o aviso usa o WhatsApp comercial da imobiliária.
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
                  <code>whatsapp_business_management</code>. Tokens temporários
                  de teste expiram.
                </li>
                <li>
                  Copie o ID do número, o ID da conta empresarial (WABA), a
                  versão da Graph API do aplicativo e o App Secret.
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
                  Para receber as confirmações de entrega, configure este
                  callback no aplicativo Meta e assine o campo{" "}
                  <code>messages</code>:<code>{waHook}</code>Use o token de
                  verificação mostrado após salvar. O App Secret valida a
                  assinatura dos avisos.
                </li>
                <li>
                  Confira o telefone dos corretores em{" "}
                  <Link href="/app/equipe">Equipe</Link> e o contato de fallback
                  em <Link href="/app/configuracoes">Configurações</Link>. O
                  envio segue os preços e limites da Meta.
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
        )}
        {provider === "email" && (
          <section
            className="form-card integration-card"
            aria-labelledby="email-heading"
          >
            <Mail size={27} />
            <h2 id="email-heading">E-mail com Resend</h2>
            <p>
              Envie avisos de visitas para sua equipe e, se habilitado,
              confirmações para o cliente. Cada imobiliária usa sua própria
              chave e remetente verificado.
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
                  teste e ativar”. O teste vai apenas para o seu e-mail de
                  acesso à ImobView. Se o teste falhar, a automação não é
                  ativada.
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
                  imobiliária para os avisos da equipe. Verifique os limites e
                  as condições do seu plano Resend.
                </li>
              </ol>
              <p>
                Esta integração envia notificações. O domínio de envio não cria
                uma caixa de entrada; use um endereço de respostas que sua
                equipe acompanhe.
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
        )}
        <IntegrationHistory
          manage={manage}
          deliveries={overview.deliveries.filter((item) =>
            selected.channels.some((channel) => channel === item.channel),
          )}
        />
      </div>
    </>
  );
}
