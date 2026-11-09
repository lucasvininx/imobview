# Integrações por imobiliária

A configuração começa em **Integrações** (`/app/integracoes`). Cada serviço tem
sua própria página: `/app/integracoes/google`, `/app/integracoes/whatsapp` e
`/app/integracoes/email`, com instruções e histórico do respectivo canal.
Proprietários e administradores configuram as credenciais da
imobiliária. Profissionais com permissão de atendimento autorizam sua própria
conta Google e escolhem uma agenda com permissão de edição.

## O que está implementado

- Google OAuth com state, PKCE e acesso offline. Tokens de renovação ficam
  criptografados; as credenciais não são serializadas para o navegador.
- Visitas com data, horário, duração e fuso. A persistência usa UTC, incluindo
  transações em servidores configurados com outro fuso.
- Criação, alteração e cancelamento de eventos no Google. O identificador do
  evento é determinístico por visita; nova tentativa não cria outro compromisso.
  A agenda de destino é fixada no agendamento. Trocar a preferência de agenda
  não move silenciosamente compromissos anteriores.
- WhatsApp Cloud API por imobiliária, com validação do número e do modelo
  aprovado, teste explícito de mensagem e assinatura dos webhooks.
- Resend por imobiliária, remetente próprio, teste para o usuário autenticado,
  destinatários separados para equipe e cliente e chaves de idempotência.
- Confirmações de entrega assinadas pela Meta e pelo Resend. Aceitação pelo
  provedor é apresentada separadamente de entrega.
- Outbox persistente com leases, revisão do agendamento, descarte de versões
  antigas, novas tentativas limitadas e histórico. As credenciais da imobiliária
  prevalecem sobre o remetente global legado do WhatsApp.
- Cancelamentos pendentes no Google sobrevivem à exclusão do cadastro pessoal.

## Preparação da plataforma

1. Aplique `20261109120000_agency_integrations` com a role de migração.
   O build não altera o banco. As cinco tabelas novas têm RLS e as funções de
   processamento são exclusivas da role de servidor `imobview_app`.
2. Defina `INTEGRATIONS_ENCRYPTION_KEY` como 64 caracteres hexadecimais aleatórios,
   somente no servidor. Mantenha a mesma chave nos deployments que usam o mesmo
   banco. A troca exige recriptografia prévia ou reconexão dos provedores; não a
   rotacione junto do segredo de sessão. Mantenha uma cópia em cofre operacional.
3. Confira `NEXT_PUBLIC_APP_URL`: é a base das URLs de retorno e dos webhooks.
   Uma mudança de domínio exige atualizar as URLs nos provedores.
4. Mantenha `CRON_SECRET` configurado. O cron existente de notificações também
   processa a fila de integrações, sem criar um terceiro cron no plano Hobby.
5. Publique e confira `/app/integracoes`, agendamento, isolamento de organizações
   e retorno do OAuth. Credenciais reais e aprovações pertencem a cada provedor.

O sistema tenta os envios logo após salvar a visita. O cron diário recupera
pendências; o administrador também pode usar “Reprocessar pendências”. Falhas
ambíguas de transporte em mensagens não são reenviadas automaticamente: confira
o painel do provedor para evitar duplicidade. A integração do calendário é de
saída da ImobView: alterações feitas diretamente no Google não editam a visita
local. Desconectar uma conta interrompe novas sincronizações e preserva eventos
existentes; o titular pode revogar o acesso no Google.

## Configuração pelos clientes

### Google Agenda

O administrador cadastra um cliente OAuth Web da própria imobiliária, ativa a
Calendar API, configura a tela de consentimento e cadastra a URI exibida na
plataforma. Cada profissional autoriza sua conta com “Conectar com Google”.
O Google pode exigir publicação/verificação do aplicativo e impor limites ao
modo de teste. Uma chave de API não substitui essa autorização.

Referências: [OAuth Web](https://developers.google.com/identity/protocols/oauth2/web-server),
[eventos](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert),
[agendas](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list).

### WhatsApp Business

Exige conta WhatsApp Business, número habilitado, token de usuário do sistema,
permissões `whatsapp_business_messaging` e `whatsapp_business_management`, App
Secret e um modelo aprovado com cinco variáveis de corpo. O passo a passo inclui
o texto do modelo, os campos necessários, callback e token de verificação.
As mensagens são destinadas ao corretor responsável ou ao telefone comercial
de fallback; não há disparo publicitário automático para a base de clientes.

Referência: [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/).

### E-mail

Exige domínio verificado no Resend, chave de envio e remetente desse domínio.
O cliente escolhe avisos para a equipe e confirmações para o interessado. O
teste é enviado ao usuário autenticado e só ativa a integração após aceitação
do provedor. O webhook é opcional para envio, mas necessário para confirmar
entrega, bounce e falha no histórico.

Referências: [envio](https://resend.com/docs/api-reference/emails/send-email),
[assinatura dos webhooks](https://resend.com/docs/webhooks/verify-webhooks-requests).

Os custos, limites e aprovações seguem os planos dos respectivos provedores.
A conexão de e-mail de uma imobiliária não altera os e-mails de autenticação
nem o contato institucional da plataforma, que usam a configuração SMTP global.
