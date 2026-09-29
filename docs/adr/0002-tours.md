# 0002 — Tours com panoramas e Storage privado

O primeiro formato operacional é 360° equiretangular, usando Photo Sphere Viewer carregado sob demanda. Cada tour pertence a um imóvel e organização; FKs compostas impedem relações entre tenants. O serviço autentica membership e permissão antes de trabalhar com RLS transacional. Papéis do Data API não acessam tabelas internas.

O documento de rascunho contém ambientes, orientação inicial e conexões direcionais. UUIDs, destinos, quantidade e coordenadas são validados com Zod. Publicação exige grafo conectado a partir do ambiente inicial. O snapshot publicado inclui nome e documento; salvar não altera o snapshot. Versão otimista evita sobrescrever edições de outra aba. Retirar publicação ou arquivar imóvel bloqueia novas consultas públicas.

O navegador envia diretamente ao Supabase com URL assinada para um caminho temporário. O backend confere o tamanho, decodifica com limite de pixels, exige proporção 2:1 e formato estático, e reencoda JPEG sem metadados em outro caminho imutável. O token de upload não autoriza sobrescrever a versão validada. Finalização repetida aceita objeto idêntico. Apenas assets READY do mesmo tour podem entrar no documento.

As URLs de leitura expiram em 15 minutos. Links já emitidos podem funcionar até expirar mesmo após retirar publicação. Uma página aberta por mais tempo pode precisar ser recarregada. Limites de imagens tornam a validação síncrona controlada; processamento de vídeo permanece fora do escopo e exigirá jobs.

Supabase está conectado para Storage e PostgreSQL. Better Auth permanece ativo para preservar as contas existentes; migrar para Supabase Auth exige estratégia de vinculação de identidades e testes próprios. Nenhuma credencial de serviço chega ao browser. Não há fallback local de storage na aplicação.

Testes de integração usam PostgreSQL real, incluindo RLS e snapshots. E2E usa o SDK real contra um servidor local de contrato de Storage, incluindo upload HTTP e validação de pixels. O servidor de contrato só existe em tests/fixtures e escuta loopback. Em 29/09/2026 também foi executada verificação no projeto Supabase conectado, cobrindo upload, publicação, leitura assinada e isolamento. O contrato de `Storage.info()` usa `size` no nível superior; `metadata` é dado customizável e nunca deve ser a fonte de validação do tamanho.

Limitações operacionais: não há coletor automático de uploads abandonados ou assets não utilizados, autosave, migração de usuários, cobrança, geração de 360° a partir de fotografias comuns ou processamento de vídeos. Definir retenção e limpeza de temporários antes da abertura comercial; não remover objetos usados por snapshots publicados.
