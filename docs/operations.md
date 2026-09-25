# Operação do primeiro ciclo

## Produção ainda não provisionada

Credenciais de PostgreSQL gerenciado, SMTP, domínio e Vercel não foram fornecidas. Nenhum serviço pago foi criado e nenhum deploy foi feito. O ambiente local funciona sem esses serviços externos.

- Configure DATABASE_URL com role de runtime limitada; DIRECT_DATABASE_URL somente no job de migrations, nunca em variáveis de preview/client.
- Execute migrations antes de liberar o build. Aplique grants e execute testes de isolamento com a mesma composição de roles de produção.
- Não executar seed de demonstração em produção. O seed também recusa hosts remotos.
- Use conexão de PostgreSQL com TLS validado conforme o provedor; não desabilite validação de certificados.
- Configure SMTP autorizado, remetente do domínio, SPF/DKIM/DMARC e teste reset completo. Não imprimir links/tokens nos logs.
- Configure NEXT_PUBLIC_APP_URL com HTTPS e segredo aleatório exclusivo. O Better Auth define cookies de sessão, valida origem e aplica rate limiting persistente.
- Habilite backups e valide restore antes de receber conteúdo real. Defina política de retenção e rotina para expirar dados de autenticação conforme as operações do provedor.
- Um processo de deploy deve executar lint, typecheck, testes, build e migrations. A configuração de CI implementa isso em banco descartável.

## Diagnóstico

Falhas de mutations e autenticação usam logging JSON com evento, tipo de erro e timestamp. Não incluir payloads Prisma, SQL com valores, headers, senha, e-mail ou tokens. Logs genéricos de biblioteca foram desabilitados para evitar despejo de credenciais em falhas de validação. Correlacionamento com request ID e Sentry são evoluções pendentes.

Se login retornar erro: verificar env, migrations, conexão runtime e grants. Se a conta não possuir membership, a aplicação mostra a etapa de preparação; não cria vínculo automaticamente. Se uma página pública retornar 404, verificar status PUBLISHED, archivedAt e dono da função de projeção.

## Limitações conhecidas e intencionais

Não há SLA, billing, upload, processamento, métricas, tours reais, convite de membros ou abertura pública de contas neste ciclo. Imóveis criados pela UI não recebem fotos até o módulo de mídia; fotos do seed são ilustrativas. O cadastro salva explicitamente e avisa no fechamento com mudanças pendentes; não há autosave e a navegação interna deve ser feita depois de salvar.

Listagem limitada aos 100 imóveis mais recentes. Dashboard usa agregação no banco para contagens totais. O sitemap lista as páginas institucionais; sitemap dinâmico paginado para o portfólio público será adicionado com o crescimento.

Privacidade e termos descrevem a versão de testes e explicitam pendências, sem afirmar conformidade legal certificada. Definir controlador, canal de titulares, retenção e termos comerciais antes de coletar clientes reais.
