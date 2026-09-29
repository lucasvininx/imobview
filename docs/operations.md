# Operação do beta

## Ambiente atual

A aplicação roda localmente e usa PostgreSQL e Storage privados no projeto Supabase ImobView. Better Auth gerencia as sessões. O runtime utiliza `imobview_app`, sem superuser ou BYPASSRLS; migrations usam outra role. A aplicação ainda não foi publicada. SMTP local é apenas para desenvolvimento.

Não copie `.env`, backups ou `.local` para o Git. No host da aplicação configure somente os segredos necessários ao runtime. `DIRECT_DATABASE_URL`, chave de backup e arquivos de clientes pertencem ao ambiente administrativo. TLS do PostgreSQL deve validar o certificado; adapte `sslrootcert` para um caminho existente no host, sem desativar a validação.

## Provisionar cliente

Crie `.local/cliente.json` com:

```json
{
  "name": "Nome do responsável",
  "email": "titular@example.com",
  "organization": "Nome da imobiliária",
  "slug": "imobiliaria-exemplo",
  "maxProperties": 30,
  "maxPanoramas": 300,
  "maxStorageMB": 2048
}
```

Execute `npm run customer:create -- .local/cliente.json` para validar e adicione `--apply` para criar. O comando é transacional e recusa e-mail/slug duplicados. Nenhuma senha é exibida ou enviada: o titular usa `/recuperar-senha` para definir a senha por um link de uso único enviado pelo Better Auth. Abertura de conta depende de SMTP real funcionando. A conta permanece com `emailVerified=false`; não há fluxo separado de confirmação de e-mail nesta versão.

Para ajustar limites, use um arquivo com `slug`, `maxProperties`, `maxPanoramas`, `maxStorageMB` e `npm run customer:limits -- arquivo.json --apply`. Reduzir um limite não exclui conteúdo existente, mas impede novas reservas. Não há cobrança automática.

Depois de validar uma conta real sua, execute `npm run ops:disable-demo` e revise a quantidade; `--apply` remove credenciais e sessões dos usuários `@imobview.test`, preservando organizações, imóveis e tours. Não execute enquanto a única forma de entrar for a conta demonstrativa. Não rode seed na nuvem.

## SMTP e contato

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`. Use remetente e domínio autorizados e configure SPF/DKIM/DMARC no provedor. `npm run launch:check` verifica conectividade sem enviar e-mail; complete o teste pelo formulário com uma conta real.

Configure `BUSINESS_LEGAL_NAME`, `BUSINESS_REGISTRATION`, `BUSINESS_EMAIL`, `BUSINESS_WHATSAPP` para o site. Os contatos de cada imobiliária são independentes e ficam em Configurações. Publicar exige revisão dos termos, privacidade, responsabilidades e retenção pelo responsável; `LEGAL_REVIEWED=true` apenas registra essa decisão, não realiza a revisão.

## Backup e restauração

Instale `pg_dump` e `pg_restore` em versão compatível com o PostgreSQL. Gere `BACKUP_ENCRYPTION_KEY` com 32 bytes aleatórios em hexadecimal e guarde uma cópia em local seguro separado do backup. Configure `BACKUP_DIRECTORY`, preferencialmente volume protegido com cópia externa.

`npm run ops:backup` cria um dump do schema público e copia os objetos READY referenciados em fotos/panoramas. O banco e os metadados utilizam a mesma snapshot consistente. Cada arquivo é cifrado com AES-256-GCM e IV aleatório. Somente diretórios com `manifest.enc` completo são backups utilizáveis. Objetos PENDING não são conteúdo final e não são copiados. O utilitário limita o dump a 512 MB em memória; em escala maior, adotar streaming/backup gerenciado.

Para ensaiar restauração, configure `RESTORE_TEST_DATABASE_URL` para localhost, nome novo terminado em `_restore_test`, e execute `npm run ops:restore-test -- caminho/do/backup`. O comando recusa bancos existentes e destinos remotos. Cria um banco novo, restaura o dump, compara contagens e autentica/descriptografa todas as imagens. Não altera Storage ou banco remoto. A recuperação completa do serviço exige também repor os objetos no bucket correto e aplicar `scripts/database-grants.sql`; planeje um ensaio de ambiente completo antes de prometer RTO/RPO.

Uma cópia do banco real e duas imagens de demonstração foram restauradas localmente em 29/09/2026. Isso não comprova agendamento nem cópia externa. Agende backups diários, preserve cópias segundo a retenção aprovada e monitore o código de saída. Não há exclusão automática de backups.

## Limpeza e limites

`npm run ops:cleanup` lista até 100 envios PENDING/FAILED de cada tipo com mais de 24 horas desde a última alteração. `--apply` remove objetos e registros. Execute diariamente; arquivos READY nunca são apagados pela rotina. Exclusão manual só libera imediatamente registros antigos: uploads recentes ficam como FAILED até expirar o prazo para evitar recriação por URLs assinadas ainda válidas. Finalização e exclusão usam locks de linha para impedir corrida.

`npm run ops:cleanup-auth -- --apply` remove sessões e verificações expiradas há mais de um dia, além de rate limits antigos. Execute diariamente. Ambos os comandos emitem somente contagens e mensagens sem credenciais.

## Observabilidade

`GET /api/health` consulta o banco e retorna somente estado agregado. `npm run ops:monitor` verifica esse endpoint em `OPERATIONS_MONITOR_URL`; use um agendador externo a cada 5 minutos e alerte quando o processo retornar código não zero. Logs JSON possuem evento, classificação segura do erro e timestamp, sem corpo, e-mail, token ou senha.

`OPERATIONS_ALERT_WEBHOOK_URL` integra erros não tratados e falhas do health check com um receptor HTTPS que aceite JSON. Configure e teste o receptor escolhido. O envio limita a um evento por minuto por processo e tem timeout de 3 segundos; isso não é uma fila garantida de alertas. Uma falha total do host exige monitoramento externo, pois o próprio aplicativo não poderá avisar.

## Suporte, exportação e exclusão

OWNER/ADMIN podem exportar metadados da própria organização em Configurações; JSON não contém credenciais, sessões ou outras organizações e não inclui os arquivos binários. Para entregar arquivos de mídia em uma solicitação, confirme o solicitante, a organização e o escopo; faça uma exportação administrativa direcionada, não entregue um backup global.

Para exclusão/encerramento, confirmar a identidade e possíveis vínculos com outras imobiliárias; retirar imóveis/tours da publicação, revogar acesso e sessões apropriados e aplicar a retenção aprovada antes de remover dados/objetos. Não apagar o usuário global se ele ainda opera em outra organização. Registrar quem solicitou, escopo, confirmação e execução sem incluir segredos. Uma ferramenta de exclusão definitiva autônoma não está exposta no produto.

## Validação de lançamento

Execute `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, `npm run build`, `npm run test:e2e` e `npm run launch:check`. O CI repete qualidade e E2E em banco descartável. O banco de testes deve ser local e isolado, configurado em `TEST_DATABASE_URL` e `TEST_DIRECT_DATABASE_URL`.

Veja `docs/lancamento.md` para pendências que dependem de dados comerciais, serviços externos e validação após publicação.
