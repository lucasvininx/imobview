# Lançamento do beta ImobView

Escopo: entrada assistida de imobiliárias, cadastro de imóveis, fotos, tours 360° conectados, publicação, compartilhamento e contato comercial. A publicação da aplicação é responsabilidade do Lucas. Data alvo de validação: 02/10/2026; liberar clientes somente após os bloqueios abaixo serem resolvidos.

## Implementado

- Contato da imobiliária em Configurações, com validação de WhatsApp brasileiro e e-mail, edição por OWNER/ADMIN e exibição apenas nos seus imóveis publicados.
- Fotos convencionais por imóvel: upload direto para Storage privado, validação real do conteúdo, remoção de metadados, JPEG otimizado, galeria e capa pública. Até 20 fotos, 10 MB por original e 34 megapixels.
- Tours: navegação protegida contra descarte acidental por links internos; cópia de recuperação no sessionStorage da aba; recuperação manual somente para a mesma versão do servidor. Salvamento continua explícito.
- Retomada de validação e descarte de uploads; panoramas referenciados no rascunho ou snapshot publicado não podem ser excluídos.
- Limites por organização centralizados e protegidos contra concorrência. Valores iniciais de beta: 30 imóveis ativos, 300 panoramas e 2048 MB reservados; não são uma tabela comercial definitiva. Cada arquivo reserva 40 MB para original e versão final, portanto o armazenamento pode ser atingido antes do limite de panoramas.
- Demonstração institucional conectada ao imóvel publicado `casa-modelo-tour-360`. `DEMO_PROPERTY_SLUG` permite trocar o exemplo.
- Criação assistida de contas com senha aleatória não divulgada; o titular estabelece sua senha através da recuperação por e-mail. Sem cadastro público ou cobrança fictícia.
- Exportação autenticada dos dados da organização (JSON, sem senhas, sessões ou outras imobiliárias).
- Backup criptografado de banco e objetos, teste de restauração em banco local novo, limpeza de envios abandonados e autenticação expirada.
- Health check, logs estruturados e integração opcional com receptor de alertas HTTPS.

## Dependências externas ainda obrigatórias

- [ ] Razão social/nome responsável, identificação aplicável, e-mail de suporte, WhatsApp e domínio fornecidos por Lucas.
- [ ] Serviço SMTP real, remetente autorizado e configuração DNS. O código e teste SMTP local não comprovam entrega em Gmail/Outlook.
- [ ] Condições comerciais, suporte e retenção aprovados; textos de termos e privacidade revisados antes de `LEGAL_REVIEWED=true`.
- [ ] Conta real do proprietário provisionada; depois desativar as credenciais demonstrativas sem excluir o imóvel exemplo.
- [ ] Backup replicado fora deste computador e chave guardada separadamente. Um backup local não substitui recuperação de desastre.
- [ ] Agendar backup, limpeza e monitoramento no ambiente operacional escolhido; informar receptor de alertas e confirmar recebimento.
- [ ] Após publicação: repetir login, recuperação de senha, upload grande, publicação, contato, duas organizações isoladas e compartilhamento real em celular.

## Roteiro do primeiro cliente

1. Acordar condições do beta e preparar arquivo privado `.local/cliente.json` conforme `docs/operations.md`.
2. Criar conta/organização com `npm run customer:create -- .local/cliente.json --apply`.
3. Orientar o titular a acessar `/recuperar-senha`. O comando não envia mensagens automaticamente.
4. Configurar nome e contato comercial em `/app/configuracoes`.
5. Cadastrar imóvel, enviar fotos e panoramas conforme `docs/fotos-360.md`, conectar ambientes, salvar e publicar tour e imóvel.
6. Conferir a página pública em janela sem login e verificar o destinatário do WhatsApp.

## Adiado conscientemente

Cobrança automática, planos públicos definitivos, equipes com convites, analytics de negócio, vídeo/HLS, CRM e domínios por imobiliária. A autenticação usa Better Auth sobre PostgreSQL do Supabase; Storage também usa Supabase. Não houve migração para Supabase Auth.

## Limitações técnicas explícitas

A normalização de imagens ocorre no servidor com limites de tamanho/pixels e transação de até 120 segundos. Não existe fila de processamento; é necessário medir memória e timeout no host publicado. URLs de leitura expiram em 15 minutos; recarregar a página renova o acesso se o conteúdo continuar publicado. Arquivos removidos deixam de ser assinados, mas uma URL já emitida pode funcionar até expirar. Envios recentes descartados mantêm uma reserva até a limpeza após 24 horas para impedir que uma URL de upload ainda válida recrie objetos sem rastreamento. A galeria do imóvel publicado é atualizada imediatamente; o tour continua usando snapshot de publicação.

## Validação de 30/09/2026

Panorama real de 8192 × 4096 px e 4,80 MB: normalização local em aproximadamente 225 ms, saída de 4,76 MB, pico RSS do processo em 321 MB. É uma medição local de arquivo único, sem rede, não um benchmark de concorrência ou garantia do host de produção.

A verificação automatizada do ambiente confirma role restrita, bucket privado, demonstração publicada e chave de backup. Ainda sinaliza ausência de SMTP externo, identidade comercial, revisão dos documentos, conta real, desativação das contas demo e monitor externo. O endereço público será configurado na publicação por Lucas.

Passaram: formatter, lint, typecheck, 23 testes unitários, 20 de integração, build e 13 E2E. O teste do tour ganhou uma regressão adicional para garantir que o upload atualize o editor sem recarregar a página inteira; falhou antes da correção e passou depois. A galeria também foi validada diretamente no Supabase real (upload, normalização, leitura pública, arquivamento e isolamento entre organizações); os registros de verificação foram removidos.

As páginas de edição de imóvel e tour declaram `maxDuration=120` para as Server Actions. O host escolhido ainda precisa suportar esse limite e a memória necessária para processar panoramas grandes.
