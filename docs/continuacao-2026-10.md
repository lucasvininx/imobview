# Continuação do desenvolvimento — outubro de 2026

Branch: `feat/lead-intelligence-tours-3d` (a partir de `main` em `f42698e`).

## O que entrou

- **Nota de interesse dos leads** (Quente / Morno / Frio, 0–100, com motivos): `src/features/leads/score.ts`. Lista ordenada por interesse, filtro e leads quentes no painel.
- **Visitante que volta é reconhecido**: mesmo e-mail no mesmo imóvel reaproveita o lead; o navegador guarda uma chave aleatória (só o hash vai para o banco, tabela `LeadDevice`). Dados de contato nunca são sobrescritos; diferenças viram observação.
- **Retenção automática** (desligada por padrão): `/api/cron/retention` + `vercel.json`, controlada por `CRON_SECRET` e `JOURNEY_RETENTION_ENABLED`.
- **Tour 360°**: planta baixa (até 5 pavimentos, marcação dos ambientes, minimapa clicável), pontos de informação ("i", `@photo-sphere-viewer/markers-plugin`), dica com o destino nas setas, abertura na direção inicial ao pular por botões/planta, navegação em linha rolável com muitos pontos.
- **Simulador de financiamento** (SAC/Price) nos imóveis à venda; a parcela é recalculada no banco (`record_tour_event`). Simulações aparecem na ficha do lead, no analytics e contam na nota. Taxa inicial por imobiliária em Configurações.
- **Vista 3D externa** (`src/features/exterior`, three.js 0.185.1 — mesma versão do Photo Sphere Viewer): maquete paramétrica do condomínio, controle tipo drone, sol e sombras por data/horário, horas de sol direto na fachada. A página pública recebe coordenadas arredondadas (~1 km).
- **Correções do teste de qualidade**: exportação do lead com simulações (BigInt), simulações na exportação completa, mensagens do simulador, pausa da renderização 3D fora da tela, rótulo acessível do horário.

## Migrações novas (aplicar em ordem)

1. `20261025120000_returning_visitors`
2. `20261026120000_floor_plans_financing`
3. `20261027120000_tour_details`
4. `20261028120000_exterior_view`

Local: `npm run db:migrate` (e no banco de testes com `DIRECT_DATABASE_URL` apontando para o `_test`). Produção (Supabase): aplicar com a credencial de migração **antes** de publicar o código.

## Rodar no seu computador

Siga o README (`npm install`, `npm run setup:env`, PostgreSQL local na porta 55432, `npm run db:setup`, `npm run dev`). O `db:setup` cria o banco do zero com as contas de demonstração; a senha fica em `SEED_PASSWORD` no seu `.env`.

Os dados de demonstração usados nos testes locais (tours com 17 pontos, plantas, vista 3D, leads fictícios) **não estão no repositório**, porque ele é público. Sem Supabase configurado, uploads de fotos/panoramas ficam indisponíveis.

## Verificação feita

- 52 testes unitários, 35 de integração e 15 E2E (Chromium) passando.
- Teste exploratório como visitante e administrador (34 etapas).

## Pendências conhecidas

- **Segurança**: atualizar `next` (16.3.8 tem falha crítica publicada), `zod` e `vite` antes de qualquer cliente real — `npm run audit:ci` aponta.
- Aviso do `pg` sobre consultas simultâneas na mesma conexão (ficha do lead); vai quebrar no `pg@9`.
- Páginas do painel com `notFound()` respondem HTTP 200 por causa do `loading.tsx` (sem vazamento de dados).
- Em Windows dentro do OneDrive, a otimização de imagens do `next dev` pode travar; reiniciar o servidor resolve. Prefira uma pasta fora do OneDrive.
- Produção: reativar o Supabase, configurar SMTP, `CRON_SECRET` e revisar os textos de consentimento/privacidade (mencionam simulações e a chave do navegador).
