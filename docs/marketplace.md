# Portal público, clientes e CRM

O endereço `/` apresenta a busca de compra e locação. `/buscar` consulta o catálogo entre organizações e abre os imóveis em `/v/slug`. `/para-imobiliarias` apresenta o produto profissional; login e painel permanecem em `/login` e `/app`.

A busca retorna imóveis publicados, sem arquivamento, com cidade, área e preço preenchidos. As abas Todos, Comprar e Alugar abrem imediatamente o catálogo da finalidade escolhida, sem exigir texto ou localização. A troca de aba limpa a pesquisa anterior. Imóveis `isDemo=true` também aparecem, com selo de demonstração no cartão e aviso de imóvel fictício na página. Novos imóveis comuns recebem `isDemo=false`.

## Pesquisa inteligente

Sem serviço externo, o interpretador reconhece venda/locação, tipo, cidade, bairro, quartos, banheiros, suítes, vagas e orçamento em reais, incluindo números por extenso e “mil”/“milhão”. Quantidades são mínimas; preços são máximos. Características restantes são procuradas no texto do anúncio. Os filtros estruturados têm prioridade sobre a descrição. Os critérios aplicados ficam visíveis. Resultados possuem ordenação e paginação de 12 imóveis.

Exemplo: `alugar casa em Campinas no bairro Cambuí com três quartos dois banheiros quatro vagas até 4 mil`.

O catálogo usa diretamente o interpretador local e não chama um provedor de IA, mesmo que existam credenciais no ambiente. A frase `casa em Campinas` é convertida em tipo Casa e cidade Campinas e consulta o estoque cadastrado. Nenhuma configuração de IA é necessária. O adaptador experimental de IA permanece isolado do fluxo da busca.

## Contatos e atendimento

- `/app/leads`: base de clientes com paginação de 30, busca e filtros de origem e completude. O acesso usa organização e permissões da sessão, com RLS no PostgreSQL.
- `/app/leads/novo`: cadastro pela equipe, mesmo sem imóvel definido. Requer nome e pelo menos e-mail ou celular.
- `/app/leads/id`: atualização de nome, e-mail, celular, CPF com dígitos verificadores e nascimento; imóvel de interesse opcional. Completo = os cinco dados pessoais preenchidos. Os cadastros recebidos dos tours e portal normalmente ficam a completar.
- `/app/crm`: quadro com uma coluna para cada etapa comercial. Arrastar o contato ou usar o seletor do cartão salva somente o status, sem sobrescrever corretor ou anotações. Há alça de arraste para mouse/toque, confirmação de salvamento, retorno à posição anterior em caso de falha e proteção contra alterações concorrentes. Proposta e fechamento registram as mesmas datas usadas pela ficha. O quadro considera até 200 contatos com atividade recente; a base completa permanece paginada em Leads.
- O formulário público “Tenho interesse” envia nome, e-mail e celular à organização do imóvel mediante autorização, sem depender de tour. O banco resolve a organização pelo slug publicado, impede envio para rascunhos e demos, limita abuso e reaproveita envios repetidos com o mesmo contato/imóvel. O contato não é sobrescrito por visitantes.

## Analytics e aparência

Analytics apresenta quatro indicadores comerciais, evolução diária, conclusão dos tours, origens, ambientes e simulações. A janela cobre hoje e os 29 dias anteriores em `America/Sao_Paulo`. Visitas e comportamento consideram somente medição autorizada; propostas/fechamentos são os registros da equipe para leads recebidos nesse período.

O tema claro é o padrão. O botão de tema fica no portal, na autenticação e no painel. A preferência é persistida por cookie e aplicada pelo servidor antes da renderização.

## Banco e validação

A migration `20261104120000_marketplace_lead_profiles` adiciona CPF, nascimento e marcação dos exemplos, permite lead sem imóvel, mantém o vínculo direto com a organização e cria as projeções públicas restritas ao runtime. Não remove registros existentes. Aplique com `npm run db:migrate` usando a conexão administrativa antes de executar o novo código contra um banco existente; gere o cliente com `npm run db:generate`.

Em 04/11/2026, a migration inicial foi aplicada ao Supabase conectado e a preservação dos registros foi conferida: 5 usuários, 2 organizações, 9 imóveis, 3 tours, 3 leads, 1 corretor e 2 panoramas. A migration `20261104180000_catalog_demo_browsing` passa a incluir os exemplos identificados no catálogo e fornece a marcação de demonstração às páginas públicas, mantendo as funções restritas ao runtime.

`npm run db:seed-marketplace` simula o cadastro de 20 exemplos (10 para venda e 10 para locação) em Campinas, Valinhos e São Paulo. `npm run db:seed-marketplace -- --apply` efetiva na organização `imobiliaria-demo`. O comando é idempotente, respeita o limite da organização, não cria contas, não remove registros e não sobrescreve anúncios. As imagens e valores são ilustrativos; o formulário de interesse é reservado aos imóveis reais. A publicação do código na hospedagem continua separada da aplicação das migrations.

Testes cobrem interpretação local, CPF, isolamento, cadastro sem imóvel, captação pública, listagem por finalidade e paginação, identificação dos exemplos, movimentação do CRM, datas comerciais e conflito entre atualizações. O navegador valida arraste real, arraste pela alça, persistência após recarregar, recuperação de falhas e os temas claro/escuro. Integração e E2E usam exclusivamente PostgreSQL local isolado.
