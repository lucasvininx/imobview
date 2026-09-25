# ADR 0001 — Fundação do ImobView°

Status: aceita no primeiro ciclo, 25/09/2026.

## Contexto e decisão

O repositório estava vazio. A primeira entrega implementa a fundação, o institucional e um fluxo vertical de imóveis; não implementa o roadmap completo.

Next.js App Router + React + TypeScript strict, Tailwind 4, componentes próprios, React Hook Form e Zod. Server Components são o padrão. Better Auth gerencia credenciais, sessões e recuperação; Prisma 7 com adapter PostgreSQL persiste os dados. SMTP é uma porta externa explícita. Nenhum provedor pago foi contratado.

A integração segue [Better Auth / Next.js](https://better-auth.com/docs/integrations/next) e [Prisma / Better Auth](https://better-auth.com/docs/adapters/prisma). Com generateId=uuid, IDs de autenticação possuem default UUID no banco.

## Limites

- app: rotas, metadata e composição.
- features: validações, casos de uso, formulários e Server Actions.
- domain: permissões e erros sem dependência do Next.js.
- server: banco, sessão, contexto de organização e logging.
- components: linguagem visual reutilizável.
- prisma: schema, migrations e seed.
- tests: unitários, integração PostgreSQL e E2E Chromium.

Services usam Prisma dentro da transação de tenant. Não foi criada uma camada genérica de repositories que apenas duplicaria as chamadas do ORM. Uma extração futura preserva os serviços como fronteira.

## Segurança e organizações

User é independente de Organization. Membership define o papel em cada organização. O cookie de seleção é apenas uma preferência; a associação real é consultada no servidor. O cliente nunca define userId.

Toda operação de imóvel executa autenticação, membership, permissão, contexto transacional, query limitada ao tenant e RLS. SET LOCAL via set_config(..., true) não vaza contexto para conexões reutilizadas. A role de runtime não é proprietária das tabelas, não é superusuária e não tem BYPASSRLS.

A página pública usa função SECURITY DEFINER com search_path fixo, slug parametrizado, filtro PUBLISHED e projeção explícita sem IDs privados. A função pertence ao dono de migrations. RLS é habilitada sem FORCE para permitir exclusivamente essa projeção executada como owner; a aplicação utiliza outra role. Nunca use a conexão de migrations no runtime.

As tabelas de autenticação são compartilhadas por definição. Memberships e organizações são consultadas por userId autenticado; não existe endpoint de acesso direto ao banco no navegador. Gestão de membros e criação de organizações fora do seed ainda não são expostas.

## Escopo intencional

Cadastro fechado para piloto; sem sign-up público. Convites, confirmação de e-mail e onboarding comercial são próximos passos. Não há bypass de login, credencial fixa publicada, billing fictício ou métricas inventadas.

Imóveis são salvos explicitamente, com três etapas e proteção contra fechamento com alterações não salvas. Autosave remoto será incorporado depois; não gravamos descrições privadas em localStorage.

Dinheiro usa centavos BigInt. Datas usam timestamptz UTC. Arquivamento retira imediatamente a página pública. A listagem limita resultados a 100; paginação é uma evolução explícita.

## Portabilidade

Aplicação pode ser publicada na Vercel com PostgreSQL e SMTP gerenciados. A separação /app facilita futuro subdomínio. Não foi realizado deploy nem criado serviço externo.

Overrides de deepmerge-ts e mysql2 corrigem advisories transitórios da CLI Prisma 7.10.0. Migrations, geração e build foram verificados com os overrides; removê-los quando o upstream incorporar versões corrigidas.
