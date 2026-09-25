# Roadmap e contratos de evolução

## Entregue neste ciclo

Fundação, CI, design system básico, identidade visual, institucional, demonstração por fotos, login/logout, recuperação por SMTP, proteção de rotas, organizations/memberships, RBAC, listagem, criação, edição, publicação e arquivamento de imóveis, página pública e SEO.

## Próximos incrementos

1. Onboarding de organização, convites, confirmação de e-mail e transações de gestão de membros; OWNER da imobiliária não equivale a administrador da plataforma.
2. Campos imobiliários complementares (endereço completo privado, CEP, coordenadas, condomínio/IPTU, suítes, área total, características e responsável), paginação, busca por status e autosave.
3. Media com organizationId, propertyId, storageKey, MIME declarado/verificado, tamanho, checksum e status. Autorização precede URL assinada curta e upload direto. Finalização verifica objeto e associação; arquivos nunca atravessam o servidor Next.js. Aplicar limites de plano, MIME permitido, magic bytes e quotas. Storage privado por padrão.
4. Tour com organizationId, propertyId, tipo VIDEO/VIRTUAL_TOUR/TOUR_360/HYBRID, visibilidade, metadata versionada e estados DRAFT/UPLOADING/PROCESSING/READY/PUBLISHED/FAILED/ARCHIVED. FK composta (propertyId, organizationId). Só conteúdo pronto pode publicar.
5. Processamento separado de upload: job idempotente para thumbnail, transcodificação e HLS. Requests apenas agendam jobs; retries, timeout e observabilidade antes de produção.
6. Analytics com eventos allowlisted, sessão efêmera, sem IP bruto ou PII em metadata, limites por origem e retenção definida. Dashboard usa dados reais; não simular números.
7. Leads NEW/CONTACTED/QUALIFIED/WON/LOST vinculados a tenant e imóvel, com consentimento/base aplicável definida antes da coleta.
8. Plan/Subscription/PlanFeature/PlanLimit persistidos: serviço central de entitlements consulta flags e limites por organização. Sem condicionais dispersas por nome de plano. Cobrança somente com provedor, webhooks autenticados e idempotência.
9. AuditLog append-only para publicação, remoção de membros e billing. Portal de exportação/exclusão, retenção e documentação comercial.
10. Backoffice separado com identidade e autorização da plataforma; não reutilizar o ADMIN das organizações.

Não foram criadas tabelas especulativas para funcionalidades sem fluxo operacional. Cada incremento deve incluir migration, isolamento, testes e estados de UX.
