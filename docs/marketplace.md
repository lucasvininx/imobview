# Portal público, clientes e CRM

O endereço `/` apresenta a busca de compra e locação. `/buscar` consulta o catálogo entre organizações e abre os imóveis em `/v/slug`. `/para-imobiliarias` apresenta o produto profissional; login e painel permanecem em `/login` e `/app`.

A busca retorna somente imóveis publicados, sem arquivamento, com cidade, área e preço preenchidos. Imóveis `isDemo=true`, os exemplos do seed e o `DEMO_PROPERTY_SLUG` configurado ficam fora do catálogo comercial. Os registros e tours de demonstração continuam disponíveis nos seus links anteriores. Novos imóveis comuns recebem `isDemo=false`.

## Pesquisa inteligente

Sem serviço externo, o interpretador reconhece venda/locação, tipo, cidade, bairro, quartos, banheiros, suítes, vagas e orçamento em reais, incluindo números por extenso e “mil”/“milhão”. Quantidades são mínimas; preços são máximos. Características restantes são procuradas no texto do anúncio. Os filtros estruturados têm prioridade sobre a descrição. Os critérios aplicados ficam visíveis. Resultados possuem ordenação e paginação de 12 imóveis.

Exemplo: `alugar casa em Campinas no bairro Cambuí com três quartos dois banheiros quatro vagas até 4 mil`.

A interpretação por IA está implementada via Responses API e Structured Outputs, conforme a [documentação oficial da OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). Configure **no servidor** `OPENAI_API_KEY` e `OPENAI_SEARCH_MODEL`, escolhendo um modelo que aceite esse formato. Nenhuma chamada paga é feita sem ambas as variáveis. O ambiente atual não possui essa configuração.

O provedor recebe somente o texto da consulta, sem acesso ao banco ou aos clientes. Saídas são validadas, filtros explícitos são preservados, respostas não são armazenadas pelo parâmetro `store:false`, e o catálogo é sempre decidido pelo SQL. Timeout de cinco segundos, recusa, erro ou limite retornam ao interpretador local. O cache em memória guarda até 100 interpretações por cinco minutos; há limite compartilhado em banco de 20 novas chamadas por hora por origem de rede. O teste do contrato da API usa respostas simuladas; uma chamada real depende das credenciais.

## Contatos e atendimento

- `/app/leads`: base de clientes com paginação de 30, busca e filtros de origem e completude. O acesso usa organização e permissões da sessão, com RLS no PostgreSQL.
- `/app/leads/novo`: cadastro pela equipe, mesmo sem imóvel definido. Requer nome e pelo menos e-mail ou celular.
- `/app/leads/id`: atualização de nome, e-mail, celular, CPF com dígitos verificadores e nascimento; imóvel de interesse opcional. Completo = os cinco dados pessoais preenchidos. Os cadastros recebidos dos tours e portal normalmente ficam a completar.
- `/app/crm`: funil de atendimento com etapas agrupadas, responsável e nível de interesse. Alterações de etapa e anotações usam a ficha do contato. O quadro considera até 200 contatos com atividade recente; a base completa permanece paginada em Leads.
- O formulário público “Tenho interesse” envia nome, e-mail e celular à organização do imóvel mediante autorização, sem depender de tour. O banco resolve a organização pelo slug publicado, impede envio para rascunhos e demos, limita abuso e reaproveita envios repetidos com o mesmo contato/imóvel. O contato não é sobrescrito por visitantes.

## Analytics e aparência

Analytics apresenta quatro indicadores comerciais, evolução diária, conclusão dos tours, origens, ambientes e simulações. A janela cobre hoje e os 29 dias anteriores em `America/Sao_Paulo`. Visitas e comportamento consideram somente medição autorizada; propostas/fechamentos são os registros da equipe para leads recebidos nesse período.

O tema claro é o padrão. O botão de tema fica no portal, na autenticação e no painel. A preferência é persistida por cookie e aplicada pelo servidor antes da renderização.

## Banco e validação

A migration `20261104120000_marketplace_lead_profiles` adiciona CPF, nascimento e marcação dos exemplos, permite lead sem imóvel, mantém o vínculo direto com a organização e cria as projeções públicas restritas ao runtime. Não remove registros existentes. Aplique com `npm run db:migrate` usando a conexão administrativa antes de executar o novo código contra um banco existente; gere o cliente com `npm run db:generate`.

Em 04/11/2026, a migration foi aplicada ao Supabase conectado e a preservação dos registros foi conferida: 5 usuários, 2 organizações, 9 imóveis, 3 tours, 3 leads, 1 corretor e 2 panoramas. A projeção pública e a restrição das funções aos papéis autorizados foram verificadas. O catálogo comercial está vazio: os exemplos existentes permanecem no painel, fora das ofertas públicas. Publicar imóveis reais e completos passa a alimentar o portal. Essa atualização do código ainda precisa de publicação na hospedagem da aplicação.

Testes novos cobrem interpretação, CPF, provedor de IA com respostas simuladas, isolamento, cadastro sem imóvel, captação pública, exclusão dos exemplos do catálogo e a jornada completa pelo navegador. Integração e E2E usam exclusivamente PostgreSQL local isolado.
