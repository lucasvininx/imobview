"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  calendarsAction,
  disableIntegrationAction,
  disconnectCalendarAction,
  retryIntegrationsAction,
  saveIntegrationAction,
  selectCalendarAction,
  testWhatsAppAction,
} from "./actions";

type Config = Record<string, unknown>;
export function IntegrationForm({
  provider,
  config,
  configured,
  enabled,
  testEmail,
  ready,
}: {
  provider: "GOOGLE" | "WHATSAPP" | "EMAIL";
  config: Config;
  configured: boolean;
  enabled: boolean;
  testEmail: string;
  ready: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [verifyToken, setVerifyToken] = useState("");
  const field = (name: string, label: string, type = "text", hint?: string) => {
    const sensitive = type === "password";
    return (
      <label className="field" key={name}>
        {label}
        <input
          name={name}
          type={type}
          aria-label={label}
          aria-describedby={hint ? `${provider}-${name}-hint` : undefined}
          autoComplete={sensitive ? "new-password" : "off"}
          defaultValue={
            sensitive
              ? ""
              : String(config[name] ?? (name === "language" ? "pt_BR" : ""))
          }
          required={!sensitive || !configured}
          maxLength={sensitive ? 10000 : 1024}
          placeholder={
            sensitive && configured
              ? "Já salva. Deixe vazio para manter."
              : hint
          }
        />
        {hint && <small id={`${provider}-${name}-hint`}>{hint}</small>}
      </label>
    );
  };
  return (
    <form
      className="integration-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        setError("");
        const element = event.currentTarget;
        const form = new FormData(element);
        try {
          const result = await saveIntegrationAction(provider, {
            ...Object.fromEntries(form),
            notifyTeam: form.get("notifyTeam") === "on",
            notifyClient: form.get("notifyClient") === "on",
          });
          if (result.success) {
            setMessage(
              provider === "GOOGLE"
                ? "Aplicativo salvo. Agora cada corretor pode conectar sua conta Google."
                : provider === "EMAIL"
                  ? "Teste aceito pelo Resend. Integração ativada; confira a caixa de entrada."
                  : "Número e modelo validados. Avisos de visitas ativados.",
            );
            setVerifyToken(result.verifyToken ?? "");
            element
              .querySelectorAll<HTMLInputElement>('input[type="password"]')
              .forEach((input) => {
                input.value = "";
              });
            router.refresh();
          } else setError(result.error);
        } catch {
          setError("Falha de conexão. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy || !ready}>
        <div className="form-grid">
          {provider === "GOOGLE" && (
            <>
              {field(
                "clientId",
                "Client ID do Google",
                "text",
                "ID do cliente OAuth do tipo Aplicativo da Web.",
              )}
              {field("clientSecret", "Client Secret do Google", "password")}
            </>
          )}
          {provider === "WHATSAPP" && (
            <>
              {field("phoneNumberId", "ID do número de telefone", "text")}
              {field(
                "businessAccountId",
                "ID da conta WhatsApp Business (WABA)",
              )}
              {field(
                "apiVersion",
                "Versão da Graph API",
                "text",
                "Informe a versão habilitada no seu aplicativo Meta, por exemplo v25.0.",
              )}
              {field(
                "template",
                "Nome do modelo aprovado",
                "text",
                "Modelo com os cinco campos indicados no passo a passo.",
              )}
              {field(
                "language",
                "Idioma do modelo",
                "text",
                "Use o código do modelo aprovado, como pt_BR.",
              )}
              {field("accessToken", "Token de acesso da Meta", "password")}
              {field(
                "appSecret",
                "Segredo do aplicativo Meta (App Secret)",
                "password",
              )}
            </>
          )}
          {provider === "EMAIL" && (
            <>
              {field("fromName", "Nome do remetente")}
              {field(
                "fromEmail",
                "E-mail do remetente",
                "email",
                "Use um domínio verificado no Resend.",
              )}
              <label className="field">
                E-mail para respostas (opcional)
                <input
                  name="replyTo"
                  type="email"
                  defaultValue={String(config.replyTo ?? "")}
                  maxLength={254}
                />
              </label>
              {field("apiKey", "Chave de API do Resend", "password")}
              <label className="field">
                Signing secret do webhook (opcional)
                <input
                  name="webhookSecret"
                  type="password"
                  autoComplete="new-password"
                  maxLength={500}
                  placeholder={
                    config.webhookConfigured
                      ? "Já salvo. Deixe vazio para manter."
                      : "whsec_…"
                  }
                />
                <small>
                  Necessário para acompanhar entrega e falhas após a aceitação
                  do e-mail.
                </small>
              </label>
            </>
          )}
        </div>
        {provider === "EMAIL" && (
          <>
            <label className="check-field">
              <input
                type="checkbox"
                name="notifyTeam"
                defaultChecked={config.notifyTeam !== false}
              />{" "}
              Avisar o corretor responsável por e-mail; sem corretor, usar o
              e-mail comercial da imobiliária.
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                name="notifyClient"
                defaultChecked={config.notifyClient === true}
              />{" "}
              Enviar ao cliente a confirmação, o reagendamento e o cancelamento
              das visitas com horário definido.
            </label>
            <p>
              O teste será enviado apenas para <strong>{testEmail}</strong>. Ao
              salvar e testar, as opções escolhidas passam a valer para novas
              atualizações de visitas.
            </p>
          </>
        )}
        {provider === "WHATSAPP" && (
          <p>
            Ao validar e ativar, novos avisos de solicitação, confirmação,
            reagendamento e cancelamento serão enviados ao corretor responsável
            ou ao WhatsApp comercial da imobiliária.
          </p>
        )}
        <div className="form-actions">
          <Button disabled={busy || !ready}>
            {busy
              ? "Verificando…"
              : provider === "GOOGLE"
                ? "Salvar aplicativo Google"
                : provider === "EMAIL"
                  ? "Salvar, enviar teste e ativar"
                  : "Validar e ativar WhatsApp"}
          </Button>
          {enabled && (
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await disableIntegrationAction(provider);
                  if (result.success) {
                    setMessage(
                      "Integração desativada. Novos envios foram interrompidos.",
                    );
                    router.refresh();
                  } else setError(result.error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Desativar integração
            </Button>
          )}
        </div>
      </fieldset>
      {verifyToken && (
        <div className="notice">
          <strong>Token de verificação do webhook Meta</strong>
          <p>
            Copie para o campo “Verificar token” da Meta. Mantenha-o no acesso
            administrativo.
          </p>
          <input
            aria-label="Token de verificação Meta"
            readOnly
            value={verifyToken}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(verifyToken)}
          >
            Copiar token
          </Button>
        </div>
      )}
      {message && (
        <p role="status" className="form-success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}

export function CalendarControls({
  connection,
  configured,
  ready,
}: {
  connection: {
    connected: boolean;
    accountEmail: string;
    calendarName: string;
    calendarId: string;
  } | null;
  configured: boolean;
  ready: boolean;
}) {
  const router = useRouter();
  const [calendars, setCalendars] = useState<{ id: string; summary: string }[]>(
      [],
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="calendar-controls">
      {connection?.connected ? (
        <>
          <p className="form-success">
            Conta conectada: <strong>{connection.accountEmail}</strong>
            <br />
            Agenda: {connection.calendarName}
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await calendarsAction();
                if (result.success) {
                  setCalendars(result.calendars);
                  setMessage("Agendas com permissão de edição carregadas.");
                } else setMessage(result.error);
              } finally {
                setBusy(false);
              }
            }}
          >
            Verificar conexão e escolher agenda
          </Button>
          {calendars.length > 0 && (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                try {
                  const result = await selectCalendarAction(
                    String(new FormData(event.currentTarget).get("calendarId")),
                  );
                  setMessage(
                    result.success
                      ? "Agenda atualizada para os próximos agendamentos."
                      : result.error,
                  );
                  router.refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="field">
                Agenda de destino
                <select name="calendarId" defaultValue={connection.calendarId}>
                  {calendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.summary}
                    </option>
                  ))}
                </select>
              </label>
              <Button disabled={busy}>Usar esta agenda</Button>
            </form>
          )}
          <details>
            <summary>Desconectar minha conta Google</summary>
            <p>
              As novas atualizações deixarão de sincronizar. Eventos já
              existentes permanecem no Google Agenda. Você também pode revogar o
              acesso nas permissões da sua conta Google.
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await disconnectCalendarAction();
                  setMessage(
                    result.success ? "Conta desconectada." : result.error,
                  );
                  router.refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Desconectar conta
            </Button>
          </details>
        </>
      ) : (
        <p>
          Conecte a conta Google que receberá suas visitas. Esta autorização é
          pessoal, dentro da imobiliária ativa.
        </p>
      )}
      {configured && ready ? (
        <a
          href="/api/integrations/google/connect"
          className="button button-primary"
        >
          {connection?.connected
            ? "Autorizar Google novamente"
            : "Conectar com Google"}
        </a>
      ) : (
        <p className="notice">
          O administrador precisa salvar o aplicativo Google desta imobiliária
          para liberar a conexão.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
export function RetryIntegrations() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await retryIntegrationsAction();
            setMessage(
              result.success
                ? "Reprocessamento solicitado. Atualize a página para acompanhar."
                : result.error,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Reprocessar pendências
      </Button>
      {message && <p role="status">{message}</p>}
    </>
  );
}

export function WhatsAppTest({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="integration-guide"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          const result = await testWhatsAppAction(
            new FormData(event.currentTarget).get("phone"),
          );
          setMessage(
            result.success
              ? "Teste aceito pela Meta. Confira a mensagem no número informado."
              : result.error,
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Conferir o recebimento</h3>
      <label className="field">
        WhatsApp de teste com DDI e DDD
        <input
          name="phone"
          type="tel"
          required
          maxLength={24}
          placeholder="5511999999999"
          disabled={!enabled || busy}
        />
      </label>
      <p>
        Este botão envia uma mensagem real ao número informado, usando o modelo
        aprovado. O envio segue as condições de cobrança da Meta.
      </p>
      <Button variant="secondary" disabled={!enabled || busy}>
        {busy ? "Enviando…" : "Enviar mensagem de teste"}
      </Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
