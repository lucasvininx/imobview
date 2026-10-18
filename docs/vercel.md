# Deploy na Vercel

Projeto: `imobview`. Endereço de produção: https://imobview-three.vercel.app.

## Configuração

As variáveis são configuradas somente no ambiente Production. Não copie todo o `.env` para a Vercel: credenciais de migração, seed, testes e backups não pertencem à aplicação publicada.

- `DATABASE_URL`: conexão do usuário restrito pelo pooler Supabase, sem caminhos locais de certificado.
- `DATABASE_CA_CERT`: conteúdo PEM da CA oficial do Supabase. O cliente verifica o certificado TLS; não desative `rejectUnauthorized`.
- `NEXT_PUBLIC_APP_URL`: endereço HTTPS de produção.
- `BETTER_AUTH_SECRET`: segredo aleatório exclusivo de produção.
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_TOUR_BUCKET`: projeto e bucket privado de mídia.
- `DEMO_PROPERTY_SLUG`: `casa-modelo-tour-360`.
- `SMTP_ENABLED=false`: recuperação de senha explicitamente indisponível enquanto não houver provedor de e-mail.

Para habilitar recuperação, configure `SMTP_ENABLED=true`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER` e `SMTP_PASSWORD`, e faça novo deploy. Valide a entrega antes de usar o fluxo de ativação de clientes.

## Publicação e verificação

Execute lint, typecheck, testes e build antes de `vercel deploy --prod`. O postinstall gera o Prisma Client. Migrações são aplicadas separadamente por operador autorizado, com a credencial de migração; o build não altera o banco.

A `.vercelignore` exclui `.env`, `.local`, backups, dependências e artefatos locais. Após publicar, confira `/api/health`, login, proteção de `/app` e `/demonstracao`. Se o Supabase estiver pausado, reative o projeto antes da verificação. Um build bem-sucedido não comprova disponibilidade do banco.

Não confunda publicação técnica com liberação comercial: acompanhe SMTP, conta real, documentos comerciais e monitoramento em `docs/lancamento.md`.

## Verificação em 18/10/2026

O projeto estava sem variáveis na Vercel e com o Supabase pausado. O banco foi reativado e a configuração TLS passou a aceitar a CA por variável, sem depender de arquivo no computador do desenvolvedor. Não havia deployment anterior registrado que permitisse identificar um erro histórico de build.

Next.js foi atualizado para 16.3.8, sharp para 0.35.5 e source-map-js para 1.2.2. A auditoria de dependências de produção não apontou vulnerabilidades. A auditoria completa ainda sinaliza a cadeia de desenvolvimento `eslint-config-next → fast-glob → micromatch → braces`; a sugestão automática de downgrade do Next ESLint para a versão 14 não foi aplicada. Acompanhar a correção dessa dependência de lint.
