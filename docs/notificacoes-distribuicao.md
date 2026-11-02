# Notificações, distribuição e cadastro do visitante

A migração `20261102120000_notifications_distribution` adiciona atribuição por lead, notificações individuais e uma fila de avisos de WhatsApp. Aplicar com `npm run db:migrate` no ambiente de destino antes de iniciar a nova versão; gerar o cliente com `npm run db:generate`. A migração associa os leads existentes ao corretor do imóvel e habilita o cadastro obrigatório nos imóveis existentes. Não dispara notificações retroativas.

## Atendimento e distribuição

Em **Configurações → Distribuição de leads e avisos**, proprietários e administradores escolhem:

- **Responsável pelo imóvel** (padrão): novos leads recebem o corretor ativo do imóvel.
- **Rodízio justo**: cada corretor ativo recebe um lead por vez, seguindo a última atribuição. O início da fila usa a data de cadastro e o identificador para desempate.
- **Por desempenho**: rodízio ponderado com peso `1 + fechamentos nos últimos 90 dias`. Um corretor com duas vendas/locações tem peso 3; um corretor sem fechamentos tem peso 1. O cálculo usa leads na etapa `WON` e a data do primeiro fechamento; inclua vendas e locações reais no CRM. O valor financeiro da venda não altera o peso.

O bloqueio transacional da imobiliária serializa cadastros simultâneos. Retornos não criam outro lead nem trocam o corretor. Mudanças de regra não redistribuem leads existentes; o atendimento permite selecionar outro corretor ativo da mesma imobiliária. Sem corretor elegível, o lead fica sem atribuição para atendimento pela equipe. Corretores inativos não recebem novas atribuições automáticas.

## Sino de notificações

Disponível em todas as páginas internas para perfis com acesso a leads. Registra novo lead, retorno ao tour, solicitação de visita e mudanças de situação da visita. Atualiza ao abrir, recuperar o foco e a cada 30 segundos enquanto a página está visível. Exibe os 30 eventos mais recentes e a contagem total de não lidas; leitura individual e em lote são privadas por usuário e imobiliária.

Administradores e proprietários recebem os eventos da imobiliária. O membro com e-mail correspondente ao cadastro do corretor atribuído também recebe. O cadastro de corretor não cria conta: o corretor precisa ter uma conta membro na mesma imobiliária, com o mesmo e-mail. Leads sem atribuição avisam todos os membros com acesso comercial. Perfis somente de leitura não recebem dados de leads.

## WhatsApp automático

Integração com a [WhatsApp Business Cloud API da Meta](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/), usando envio HTTP direto de modelos aprovados. Configure exclusivamente no servidor:

```dotenv
WHATSAPP_ACCESS_TOKEN=token-do-sistema-meta
WHATSAPP_PHONE_NUMBER_ID=id-do-numero-remetente
WHATSAPP_API_VERSION=versao-suportada-pela-sua-aplicacao
WHATSAPP_VISIT_TEMPLATE=imobview_aviso_visita
WHATSAPP_TEMPLATE_LANGUAGE=pt_BR
CRON_SECRET=segredo-aleatorio-de-pelo-menos-32-caracteres
```

Crie e aprove na Meta um modelo com cinco parâmetros posicionais no corpo, nesta ordem: situação, nome do cliente, título do imóvel, data `DD/MM/YYYY`, período. Exemplo: `{{1}}. Cliente: {{2}}. Imóvel: {{3}}. Data: {{4}}, {{5}}. Consulte a agenda no ImobView.` O destinatário é o telefone do corretor ativo atribuído; sem esse corretor, usa o WhatsApp da imobiliária. Telefones brasileiros de 10/11 dígitos recebem o prefixo 55. Configure números válidos e destinatários que aceitem esses avisos.

Ative o envio por imobiliária em Configurações. A opção só pode ser ligada com as credenciais presentes. Novas solicitações e a primeira confirmação geram avisos separados, sem confirmar automaticamente a agenda. O envio é executado imediatamente após a resposta ao cliente/equipe. O cron `/api/cron/notifications` retoma pendências diariamente a partir das 06h05 UTC (03h05 em São Paulo), com `Authorization: Bearer CRON_SECRET`. A frequência diária é compatível com o plano Hobby atual da Vercel, que pode executar o trabalho dentro da hora agendada. Novos eventos de visita também processam avisos elegíveis; intervalos de reenvio de cinco minutos exigem outro plano ou agendador externo.

A fila tem até cinco tentativas, reserva cada trabalho por cinco minutos e impede processamento concorrente da mesma reserva. Falhas não desfazem o cadastro nem o agendamento. Jobs de visitas canceladas ou de imobiliárias com avisos desativados não são enviados. O status `sentAt` significa aceitação pela API, sem confirmação de entrega ao aparelho. Como a API não oferece uma chave de idempotência nessa chamada, uma interrupção entre a aceitação externa e a gravação local pode ocasionar reenvio. Não há webhook de confirmação de entrega nesta implementação.

As credenciais atuais representam um remetente da plataforma, compartilhado entre as imobiliárias que habilitarem o serviço. Não há configuração de um remetente Meta próprio por imobiliária nesta versão. A equipe administradora pode consultar pendências na tabela `WhatsAppDelivery`, respeitando o isolamento da imobiliária. `lastError` contém apenas uma classificação técnica, sem dados do cliente ou credenciais. Exclusão do lead remove também suas notificações e mensagens pendentes.

## Cadastro e métricas

Links `/v/[slug]` exigem nome, e-mail, telefone e autorização de contato antes de receber as URLs assinadas dos panoramas e plantas. O servidor recusa sessões sem contato ou chave de retorno válida, independentemente da configuração antiga `captureLeads`. A demonstração fictícia em `/demonstracao` continua aberta.

O lead e a sessão são gravados no envio do cadastro, antes de abrir o primeiro ambiente. Não dependem de conclusão do tour nem de visita presencial. Ambientes, tempos e interações autorizados ficam disponíveis em Leads e CRM e Analytics mesmo sem agendamento. A medição comportamental continua sendo uma escolha explícita e pode ser interrompida; o cadastro permanece disponível para atendimento. Aplicam-se os prazos de retenção existentes: 90 dias para sessões e 365 dias de inatividade para leads, quando a rotina de retenção estiver habilitada.
