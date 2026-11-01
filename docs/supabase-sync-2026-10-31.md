# Sincronização e publicação — 31/10/2026

Projeto Supabase: `imobview`, referência `igdlejzstlajlvdvwipa` (São Paulo). Aplicação publicada em https://imobview-three.vercel.app.

## Banco e ambiente

- Variáveis de Production da Vercel recuperadas para `.env`, ignorado pelo Git. Uma cópia anterior permanece em `.local/vercel-production-2026-10-31.env`.
- Aplicadas as cinco migrations de outubro: jornada comercial, visitantes recorrentes, plantas/financiamento, detalhes dos tours e vista externa 3D. O histórico contém 14 migrations concluídas.
- O schema Prisma foi alinhado às constraints já existentes de fotos e visitas dos tours, preservando as relações e as ações `ON UPDATE NO ACTION`. A comparação com o banco não apontou diferenças.
- Preservados os nove imóveis, três tours e dois panoramas existentes. Todas as 19 tabelas públicas, incluindo o histórico Prisma, possuem RLS. `anon` e `authenticated` não podem acessar as tabelas internas.
- Runtime permanece com `imobview_app`, sem SUPERUSER/BYPASSRLS. O operador local usa `imobview_deployer`, sem SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB e com `NOINHERIT`, assumindo explicitamente `imobview_migrator` na conexão administrativa. Não publicar `DIRECT_DATABASE_URL` na Vercel.
- Certificado TLS em `.local/supabase-ca.crt`; `DATABASE_CA_CERT` atende à aplicação e aos scripts Node. A URL administrativa usa verificação completa de TLS e o certificado local.
- Bucket `imobview-tours` privado, limite de 20 MB e tipos de imagem permitidos. Upload assinado, download assinado e bloqueio de leitura pública verificados no Storage real; objeto temporário removido.

## Contas e operação

Foram criadas três contas com senhas aleatórias e hash Better Auth: proprietário/administrador (`OWNER`), corretor (`MEMBER`) e visualizador (`VIEWER`), na organização existente `imobiliaria-demo`. As credenciais estão apenas em `.local/access-2026-10-31.json` e na entrega privada ao titular. As credenciais e sessões das duas contas antigas `@imobview.test` foram removidas, preservando seus dados.

Backup anterior às alterações: `.local/backups/2026-10-31-before-sync`, com dump PostgreSQL e dois objetos de mídia criptografados. A chave está no `.env` administrativo. O dump foi restaurado em PostgreSQL 17 descartável, com todas as contagens conferidas e autenticação criptográfica das imagens validada. Esse backup ainda precisa de cópia externa e guarda separada da chave.

`CRON_SECRET` configurado na Vercel como Secret. `JOURNEY_RETENTION_ENABLED=false`: o cron diário apenas informa contagens, sem remover registros. A publicação do imóvel de demonstração `casa-modelo-tour-360` foi autorizada pelo titular. A aplicação continua com `SMTP_ENABLED=false`.

## Validação

- 52 testes unitários, 35 de integração e 15 E2E com Chromium passaram em ambiente local isolado.
- Lint, TypeScript e build de produção passaram. No Windows, a checagem de estilo usa `npx prettier --check . --end-of-line auto` por causa do checkout CRLF.
- Auditoria das dependências de produção: zero vulnerabilidades. Política de auditoria completa passou; persistem avisos moderados na cadeia de ferramentas de desenvolvimento.
- Publicação pela Vercel concluída; o alias `imobview-three.vercel.app` precisa apontar para o deployment de produção atual. O CLI também retorna um alias padrão diferente: conferir ambos antes de encerrar uma publicação futura.
- Evidências das verificações reais e do plano aplicado permanecem em `.local/production-smoke-2026-10-31.json` e `.local/migration-plan-2026-10-31.json`.

## Dependências para liberação comercial

O titular informou que ainda não dispõe de SMTP e identidade comercial. Continuam pendentes: provedor/remetente e DNS de e-mail; dados comerciais e contatos reais; revisão de termos, privacidade e retenção; cópia externa/agendamento de backups e monitor externo com alertas. Não marcar `LEGAL_REVIEWED=true` nem habilitar exclusão por retenção sem a decisão do responsável.

O build nunca aplica migrations. Para alterações futuras no banco, usar `npm run db:migrate` com a conexão administrativa local; `npm run launch:check` lista as pendências. A publicação desta entrega foi feita pelo CLI da Vercel a partir do código local; não houve commit ou push automático.
