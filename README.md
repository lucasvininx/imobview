# ImobView°

Plataforma brasileira para organizar e apresentar imóveis. Este é o código-base do primeiro ciclo: fundação de SaaS multi-tenant, institucional, autenticação e imóveis com publicação pública.

## O que funciona

- Home responsiva com identidade fornecida, recursos, planos conceituais, FAQ e demonstração por fotos.
- Login, logout, recuperação de senha por SMTP, sessões persistidas, rate limiting e rotas protegidas.
- Organizações e memberships independentes de usuários, OWNER/ADMIN/MEMBER/VIEWER e seleção de workspace.
- Dashboard com contagens reais; listagem/busca; cadastro em três etapas; edição, publicação e arquivamento.
- Páginas públicas somente para imóveis publicados, metadata dinâmica, Open Graph e compartilhamento.
- PostgreSQL com constraints, índices, migrations e RLS; runtime com role sem privilégios administrativos.
- Testes unitários, integração com PostgreSQL real e E2E com Chromium; workflow de CI.

- Editor de tours 360° por imóvel: panoramas 2:1, ambientes, pontos clicáveis, visualizador WebGL, rascunhos e publicação independente.
- Upload direto para bucket privado do Supabase, validação real dos pixels, remoção de metadados e URLs temporárias. Exige conexão ao projeto e configuração do Storage; não existe upload fictício na aplicação.

Vídeos, analytics, convites, cobrança, autosave e onboarding comercial ainda não estão implementados. A página de contato é informativa; não há formulário que finja enviar mensagens.

## Stack e requisitos

Node.js 22.14+ (22 LTS recomendado), npm, PostgreSQL 16+ e SMTP. Next.js 16.3, React 19, TypeScript strict, Tailwind 4, Prisma 7, Better Auth, Zod e React Hook Form. Docker é opcional. O build obtém Manrope via Google Fonts.

## Começar com Docker

```bash
npm install
npm run setup:env
docker compose up -d
npm run db:setup
npm run dev
```

Abra http://localhost:3000. Mailpit: http://localhost:8025. O Compose só expõe as portas em loopback e usa credenciais descartáveis de desenvolvimento.

`setup:env` gera `.env` com secrets aleatórios se ele não existir. Nunca sobrescreve configuração existente. Next.js e os scripts CLI compartilham esse arquivo; por isso o exemplo utiliza `.env`, e não exclusivamente `.env.local`.

`db:setup` cria a role limitada, prepara o banco de testes, aplica migrations, concede grants e executa seeds nos dois bancos. É idempotente e só aceita bancos locais. Não redefine senhas existentes.

### Ambiente atual no Windows

Foi preparada uma instância PostgreSQL exclusiva em `.local/postgres`, porta **55432**, limitada a 127.0.0.1. Docker não estava em execução. Não inicie também o container PostgreSQL nessa porta.

Reiniciar ou parar essa instância, a partir da raiz:

```powershell
pg_ctl -D .local/postgres -l .local/postgres.log -o '-p 55432 -h 127.0.0.1' start
pg_ctl -D .local/postgres stop
```

Em outro Windows com PostgreSQL nativo, antes de `db:setup`:

```powershell
initdb -D .local/postgres -U imobview --auth=trust --encoding=UTF8 --locale=C
pg_ctl -D .local/postgres -l .local/postgres.log -o '-p 55432 -h 127.0.0.1' start
createdb -h 127.0.0.1 -p 55432 -U imobview imobview
npm run db:setup
```

Trust é exclusivo para esse cluster local isolado. Em produção use autenticação forte e TLS.

## Contas de demonstração

- `admin@imobview.test`: OWNER da Imobiliária Demo, com três imóveis fictícios.
- `outro@imobview.test`: OWNER de Outra Imobiliária, com um imóvel privado.

A senha das contas está em **SEED_PASSWORD**, no arquivo local `.env`. Não há senha fixa no repositório. Os seeds não rodam em NODE_ENV=production nem em host remoto; não use essas contas em ambiente comercial. O cadastro público está fechado neste ciclo.

Para testar recuperação fora do E2E, inicie `docker compose up -d mailpit` ou configure um servidor SMTP de desenvolvimento. Os testes E2E iniciam seu próprio receptor SMTP na porta 11025, sem enviar mensagens externas.

## Variáveis de ambiente

| Variável                        | Uso                                                |
| ------------------------------- | -------------------------------------------------- |
| DATABASE_URL                    | Role de runtime, nunca owner/superuser/BYPASSRLS   |
| DIRECT_DATABASE_URL             | Role administrativa, apenas CLI/migrations/seed    |
| TEST_DATABASE_URL               | Role limitada em banco cujo nome termina com _test |
| NEXT_PUBLIC_APP_URL             | Origem pública da aplicação                        |
| BETTER_AUTH_SECRET              | Secret aleatório com pelo menos 32 caracteres      |
| SEED_PASSWORD                   | Senha local do seed, pelo menos 12 caracteres      |
| SMTP_HOST, SMTP_PORT, SMTP_FROM | Transporte de recuperação de senha                 |
| SMTP_USER, SMTP_PASSWORD        | Credenciais de SMTP quando necessárias             |

O schema de env falha no boot se variáveis obrigatórias estiverem ausentes; mensagens identificam nomes, sem expor valores. Variáveis NEXT_PUBLIC são públicas; nenhuma chave secreta pode usar esse prefixo.

## Tours 360° e Supabase

Em **Imóveis → abrir imóvel → Criar tour 360°**, envie panoramas equiretangulares reais (JPEG/PNG/WebP estático, proporção 2:1, largura 1024–8192, até 20 MB). Adicione cada panorama como ambiente. Inicie a prévia, clique na posição desejada e escolha o ambiente de destino para criar um ponto. Salve o rascunho e publique. Todos os ambientes precisam estar conectados a partir do inicial; as conexões são direcionais. O imóvel também precisa estar publicado para o tour aparecer em `/v/slug`.

Configure `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` (somente servidor) e `SUPABASE_TOUR_BUCKET` no `.env`. Após conferir o projeto, execute `npm run supabase:storage`: cria ou configura o bucket privado com limite de tamanho e MIME types. Nunca use bucket público. Limites iniciais: 10 tours/imóvel, 30 ambientes/tour e 40 uploads/tour. Não representam planos comerciais definitivos.

O banco pode usar PostgreSQL do Supabase via Prisma: provisione `imobview_app` com LOGIN/NOSUPERUSER/NOBYPASSRLS, sem herança do owner, configure `DATABASE_URL` com essa role e `DIRECT_DATABASE_URL` com a role de migrations, aplique `npm run db:migrate` e `scripts/database-grants.sql`. Utilize as strings de conexão/TLS disponibilizadas no seu projeto e valide RLS antes de abrir acesso externo. Não execute `db:setup` nem seed de demonstração no Supabase remoto. A migration de hardening bloqueia os papéis `anon`/`authenticated` nos dados internos.

A autenticação existente continua em Better Auth; as contas e sessões são persistidas no PostgreSQL do Supabase. Não houve migração de identidades para Supabase Auth. Consulte [a decisão dos tours](docs/adr/0002-tours.md).

### Ambiente conectado em 29/09/2026

O `.env` local foi conectado ao projeto **imobview**, referência `igdlejzstlajlvdvwipa`, em São Paulo. As oito migrations foram aplicadas e verificadas pelo Prisma; usuários, organizações, imóveis e tours locais foram preservados. O banco usa conexões distintas para runtime (`imobview_app`) e migrations (`imobview_migrator`), sem SUPERUSER/BYPASSRLS. Todas as tabelas internas possuem RLS. O bucket `imobview-tours` é privado, com limite de 20 MB.

A conexão usa o pooler em modo sessão, porta 5432, com `sslmode=verify-full` e o certificado oficial indicado por `sslrootcert`. O certificado está em `.local/supabase-ca.crt`; ao mover ou publicar a aplicação, provisione esse arquivo e ajuste o caminho na URL. Não desative a verificação TLS. [Conexões e TLS no Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

Foi verificado no projeto real: upload assinado por HTTP, validação e normalização do panorama, publicação, download assinado, bloqueio de leitura pública direta, isolamento entre organizações, retirada da publicação e login pelo navegador. Os registros e arquivos temporários de verificação foram removidos. A configuração anterior foi preservada em `.local/env-before-supabase.env`, ignorado pelo Git.

Os testes continuam no PostgreSQL local: `TEST_DATABASE_URL` e `TEST_DIRECT_DATABASE_URL` não devem apontar para o Supabase. Não execute `db:setup` com a configuração remota ativa; esse comando é exclusivo da fundação local. Para concessões administrativas específicas da plataforma, veja `scripts/supabase-platform-grants.sql`. A ausência de política em `_prisma_migrations` é intencional: somente o owner deve acessar o histórico.

## Banco e migrations

```bash
npm run db:generate
npm run db:dev -- --name nome_da_mudanca
npm run db:migrate
npm run db:seed
```

`db:dev` cria migration em desenvolvimento e pode precisar de permissão para shadow database. `db:migrate` aplica migrations existentes. Revise o SQL e atualize testes e seed a cada alteração.

Para ambiente gerenciado, provisione a role de aplicação com senha forte e use `scripts/database-grants.sql` depois das migrations. A função pública é SECURITY DEFINER, pertence ao owner de migrations e tem projeção e filtro explícitos. O runtime precisa ser outra role, sem herança da role proprietária. Não conceda acesso de banco diretamente ao navegador.

## Qualidade

```bash
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
npm audit --audit-level=high
```

E2E inicia a versão de produção na porta 3100 com TEST_DATABASE_URL; não reutiliza o servidor de desenvolvimento. Integração também usa exclusivamente o banco _test. Artefatos e screenshots: `test-results/` e `playwright-report/` (ignorados pelo Git; podem conter dados de teste/sessão).

A suíte cobre permissões, centavos, schemas, criação/edição/publicação/arquivamento, isolamento entre A e B pelo serviço e pelo banco, cookies forjados, autenticação e recuperação com token de uso único. O institucional é testado em 1440, 1024, 768 e 390 px.

CI: `.github/workflows/ci.yml`, com PostgreSQL real e as mesmas etapas. O workflow foi criado; a execução hospedada no GitHub depende de push do repositório.

## Arquitetura e documentação

```text
src/app/           rotas, layouts, metadata
src/components/    marca, UI e composição compartilhada
src/features/      auth, organizations, properties, tours
src/domain/        permissões e erros
src/server/        sessão, tenant, Prisma e logging
src/config/        validação de ambiente
prisma/            schema, migrations e seed
tests/             unitários, integração e E2E
docs/adr/          decisões arquiteturais
```

- [Decisões e isolamento](docs/adr/0001-foundation.md)
- [Roadmap e contratos futuros](docs/roadmap.md)
- [Logo, paleta e imagens](docs/brand.md)
- [Operação e pendências de produção](docs/operations.md)

## Antes da abertura comercial

Configurar domínio, banco gerenciado com backup/restore, SMTP autorizado e HTTPS; revisar privacidade/termos e identificar controlador/canal de titulares; definir planos/limites; implementar onboarding e confirmação de e-mail. Não há deploy realizado, serviço contratado ou garantia de readiness comercial implícita nesta entrega.

As páginas públicas não incluem endereços privados. Nenhum evento de analytics ou lead é coletado. Não publicar dados reais enquanto os requisitos operacionais e comerciais não estiverem resolvidos.
