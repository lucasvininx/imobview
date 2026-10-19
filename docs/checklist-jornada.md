# Jornada comercial — diagnóstico de 19/10/2026

Comparação do repositório com a especificação fornecida pelo cliente, antes das alterações deste ciclo.

| Requisito                                        | Estado inicial                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| Autenticação, organizações, RBAC e isolamento    | Implementado; criação de clientes assistida                          |
| Recuperação de senha                             | Código pronto; SMTP de produção pendente                             |
| Equipe                                           | Listagem e papéis; sem gestão de corretores                          |
| Imóveis                                          | CRUD, publicação e arquivo; campos comerciais incompletos            |
| Fotos e tour 360°                                | Upload direto, normalização, ambientes, hotspots, snapshot publicado |
| Hospedagem e página pública                      | Implementadas; demonstração funcional                                |
| URL personalizada                                | Apenas slug automático                                               |
| WhatsApp e compartilhamento                      | Implementados                                                        |
| Captura e perfil de leads                        | Ausente                                                              |
| Sessões e comportamento por ambiente             | Ausente                                                              |
| CRM e solicitação de visita                      | Ausentes                                                             |
| Analytics e funil                                | Ausentes                                                             |
| Calendários, scoring, financiamento, CRM externo | Fase 2 da especificação; ausentes                                    |
| Heatmaps, IA, relatórios avançados               | Fase 3 da especificação; ausentes                                    |

## Escopo do ciclo

Completar a camada comercial da Fase 1 sem substituir o visualizador existente. O agendamento inicial é uma **solicitação de visita**, com confirmação humana, não uma promessa de disponibilidade de agenda. Corretores são contatos da imobiliária, separados das contas de acesso. Integrações externas dependem de configuração e autorização próprias.

Dados de comportamento só serão enviados após escolha explícita do visitante. Visitar sem identificação continua possível. O funil deve informar sua cobertura: não representa visitantes que recusam medição. Não coletar CPF, IP em claro ou URLs completas de referência.

## Implementação deste ciclo

- [x] Cadastro de corretores de contato e atribuição ao imóvel, limitado à mesma organização.
- [x] Código interno, endereço interno, condomínio, suítes e informações comerciais.
- [x] URL personalizada antes da publicação, com unicidade no banco.
- [x] Captura opcional, autorização de contato e consentimento separado para medição.
- [x] Sessões e eventos idempotentes, tempo ativo, sequência de ambientes, revisitas e conclusão por cobertura.
- [x] Painel de leads e perfil individual com histórico.
- [x] CRM básico com etapas, notas e marcos de proposta/venda.
- [x] Solicitação de visita com data/período; confirmação humana pelo painel.
- [x] Analytics por imóvel, funil medido, interesse por ambiente e origem.
- [x] Resumo comercial no dashboard.
- [x] Exportação, exclusão de lead e comando de retenção em modo de simulação por padrão.
- [x] Migrations, RLS, validação e testes de isolamento para as novas entidades.
- [ ] SMTP externo e ativação de contas por e-mail em produção.
- [ ] Convites e criação de contas de corretores pelo painel; o provisionamento continua assistido.
- [ ] Agendamento periódico externo da retenção, backups e monitoramento.
- [ ] Integrações e funcionalidades das Fases 2 e 3, conforme o documento original.

As métricas não estimam visitantes que recusam medição. A agenda não apresenta disponibilidade fictícia. Consulte `docs/jornada-comercial.md` para limites, definições e dependências operacionais.
