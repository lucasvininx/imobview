import { Plug } from "lucide-react";
import { RetryIntegrations } from "./forms";
import type { integrationOverview } from "./service";
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

export function IntegrationHistory({
  deliveries,
  manage,
}: {
  deliveries: Awaited<ReturnType<typeof integrationOverview>>["deliveries"];
  manage: boolean;
}) {
  return (
    <section
      className="form-card integration-history"
      aria-labelledby="integration-history"
    >
      <Plug size={24} />
      <h2 id="integration-history">Histórico de sincronização e envio</h2>
      <p>
        Acompanhe a sincronização das visitas e os envios. Se houver uma falha
        temporária, você pode reprocessar as pendências por aqui.
      </p>
      {manage && <RetryIntegrations />}
      {deliveries.length ? (
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
              {deliveries.map((delivery) => (
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
  );
}
