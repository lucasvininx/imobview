# Jornada comercial — Fase 1

## Uso

1. Cadastre os contatos dos corretores em **Equipe** (OWNER/ADMIN). Isso não cria contas de login.
2. Abra o imóvel e preencha **Distribuição e atendimento**: URL, código interno, endereço, condomínio, suítes, corretor e informações comerciais. Endereço completo e notas permanecem internos.
3. Ative o formulário antes do tour se desejar. O visitante pode continuar sem identificação. Publique o imóvel e o tour e compartilhe `/v/slug`; `utm_source` identifica a campanha quando houver autorização de coleta.
4. O visitante pode enviar contato, autorizar ou recusar medição e solicitar uma data/período para visita. Nenhuma mensagem externa é enviada automaticamente. A equipe combina o horário e confirma no painel.
5. Em **Leads e CRM**, veja contato, origem, ambientes, sequência, tempo ativo, revisitas, solicitações e atualize a etapa comercial.
6. Em **Analytics**, filtre por imóvel. Em **Visitas**, acompanhe solicitações pendentes e confirmações humanas.

## Definições das métricas

- Não há coleta de comportamento antes do consentimento. Negar a medição não impede visitar o tour ou solicitar atendimento.
- Sessão medida começa quando o visitante permite coleta. O tour inicia quando carrega o primeiro ambiente. Conclusão significa que todos os ambientes do snapshot foram abertos, não que o usuário decidiu comprar.
- Heartbeats de até 30 segundos contam tempo com a aba visível. Não é possível provar atenção, nem garantir o último envio após fechamento abrupto, perda de rede ou encerramento do navegador. `lastSeenAt` informa a última atividade recebida; saída não confirmada não é apresentada como saída exata.
- Eventos possuem sequência e são deduplicados no banco. O servidor limita duração ao tempo transcorrido e valida os ambientes contra o snapshot da sessão.
- Contagens principais cobrem 30 dias. Interesse por ambiente e origem são agregados no banco, exibindo até 3.000 ambientes e 100 origens, ordenados por interesse/volume. Leads e pedidos sem consentimento de medição não entram no funil comportamental.
- Propostas e vendas são marcos informados pela equipe. Não constituem comprovação financeira ou atribuição causal.
- O token de sessão fica apenas em memória no navegador e expira em 24 horas; o banco guarda seu hash. Recarregar inicia uma nova jornada mediante nova escolha. Identificação posterior inicia nova sessão; não vincula retroativamente navegação anterior.

## Segurança e dados pessoais

Leads, sessões, eventos, corretores e pedidos têm RLS. VIEWER não acessa dados de leads. OWNER/ADMIN/MEMBER operam o CRM; somente OWNER/ADMIN excluem leads. A exclusão remove sessões, eventos e pedidos associados. Exportações não incluem tokens de sessão ou chaves de prevenção de abuso.

As funções públicas são chamadas pelo backend e resolvem a organização a partir do tour publicado. Não recebem tenant do navegador. Funções SECURITY DEFINER usam search_path fixo e execução restrita a imobview_app. Os papéis Supabase anon/authenticated não recebem acesso. Há limite de 40 novas sessões por chave de rede/dia por hora, 5.000 sessões por organização/dia, 2.500 eventos por sessão e três pedidos por lead.

`node scripts/cleanup-leads.mjs` simula retenção: sessões acima de 90 dias e leads sem atualização acima de 365 dias. `--apply` executa a remoção. O agendamento periódico deve ser configurado pelo operador; não existe cron externo provisionado. Revisar esses prazos com o responsável pelo tratamento antes de abertura comercial. Backups seguem sua política de retenção separada.

## Limites e próximos ciclos

SMTP continua dependendo do provedor. Contas de acesso e organizações são provisionadas pelo fluxo assistido existente. Não há convites de login pelo painel. O módulo de corretores é um diretório profissional.

Fase 2: disponibilidade e sincronização Google/Outlook, scoring, financiamento, automações e CRM externo. Fase 3: heatmap, IA, recomendações e relatórios avançados. Não há simulações de integração, notificações enviadas ou calendário com horários fictícios.

Alterar URL exige retirar a publicação e invalida o link antigo. O formulário comunica essa consequência. Não há aliases de URLs antigas nesta versão.

## Auditoria de dependências

`npm run audit:ci` bloqueia alertas altos/críticos de produção e alertas novos de desenvolvimento. Há uma exceção limitada à cadeia de lint `eslint-config-next → fast-glob → micromatch → braces`, exclusivamente para GHSA-vfj7-8cjw-p6xm, sem versão corrigida disponível na verificação de 19/10/2026. O lint processa os padrões do repositório, não entradas dos visitantes. A exceção expira em 19/11/2026 e não é aplicada a dependências de produção; falha de consulta à auditoria também bloqueia o CI. Não executar `npm audit fix --force` para rebaixar o framework à versão 14.
