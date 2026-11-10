# Apartamento Aurora

Abra `/v/apartamento-jardim-demo`. O cadastro foi preparado na organização `imobiliaria-demo`, aproveitando um apartamento demonstrativo sem fotos ou tours. Não foram alterados anúncios reais, usuários ou configurações da organização.

128 m², dois quartos (uma suíte), dois banheiros e duas vagas, com valor ilustrativo de R$ 1.280.000. Os oito ambientes são sala de estar e jantar, cozinha, área gourmet, varanda, suíte principal, quarto de hóspedes, banheiro social e banheiro da suíte.

## Roteiro da reunião

1. Abra a página pública e clique em uma foto para mostrar a galeria. As setas do teclado trocam as imagens; Escape fecha.
2. Clique em “Explorar tour 360°”, preencha o formulário e autorize a medição. Depois clique em “Iniciar tour 360°”. Visitantes reconhecidos também confirmam uma nova visita antes do acesso. Arraste a imagem para olhar ao redor, use os controles de zoom e tela cheia.
3. Passe pela cozinha, área gourmet e varanda usando os nomes dos ambientes ou as setas do panorama. Cada seta mostra seu destino. Existem 14 conexões direcionais, com caminho de volta para todos os cômodos. A área gourmet é acessada pela varanda; quartos e banheiro social, pelo corredor da sala.
4. Clique nos pontos da planta para entrar nos quartos e banheiros. Os pontos “i” mostram detalhes de cada ambiente.
5. Abra a simulação de financiamento e altere entrada, prazo ou sistema SAC/Price.

Todos os tours públicos, inclusive `/demonstracao` e este apartamento, exigem identificação e autorização de medição antes de iniciar. Os panoramas só são assinados e enviados após o cadastro. O tempo conta com o tour visível, janela em foco e atividade recente; é possível parar a medição durante a visita. O contato comercial deste imóvel continua identificado como demonstração.

## Arquivos e cadastro

- Imagens revisadas: `public/demo/apartamento-aurora/panoramas-v2/` e `public/demo/apartamento-aurora/fotos-v2/`. Os arquivos originais permanecem em `panoramas/` e `fotos/`.
- Planta: `public/demo/apartamento-aurora/planta.webp`, esquemática e sem escala.
- Provisionamento: `npx tsx scripts/seed-apartment-demo.ts` simula; com `--apply`, grava no banco configurado e envia as mídias ao bucket privado já configurado. Reexecuções reconhecem o cadastro pronto sem duplicá-lo. O comando só modifica este cadastro marcado como demonstração; valida proporção, limites e conectividade, usa transação e remove uploads novos em caso de falha.
- Revisão de mídia e navegação: `npx tsx scripts/upgrade-apartment-demo.ts` simula; com `--apply`, atualiza os 16 arquivos no Storage privado, os pontos de navegação e a capa. Preserva os objetos originais, salva o estado anterior em `.local/aurora-before-quality-*.json` e mantém um rascunho diferente da versão publicada. Os pontos revisados estão em `scripts/apartment-demo-layout.ts`.
- As fotos públicas são vistas dos mesmos panoramas, restauradas individualmente para reduzir a perda de detalhe causada pela ampliação de recortes. A aplicação usa as cópias do Storage privado com URLs temporárias; a capa local serve para catálogo e compartilhamento.

## Origem das imagens

Imagens ilustrativas geradas com a ferramenta integrada `image_gen`, sem fotografia de um imóvel real. Não constituem levantamento arquitetônico: a continuidade espacial e as dimensões não têm precisão de captura real. Essa natureza demonstrativa também aparece na página pública. Para apresentar um imóvel real, substitua por panoramas equiretangulares capturados no local.

Na revisão, a ferramenta integrada `image_gen` editou cada panorama e cada foto para recuperar textura e nitidez, preservando a composição. As fotos foram entregues em 1536 × 1024; os panoramas, em 1774 × 887. Não se trata de captura 8K. A exportação JPEG usa qualidade 95/96 com crominância 4:4:4. O Magnific recusou o aprimoramento por cota diária esgotada e não cobrou créditos.

Prompt de revisão dos panoramas: “Faithfully enhance this EXACT existing 360-degree equirectangular panorama. Maximum native resolution, exact 2:1. Preserve every door, window, furnishing, object, plant, projection, horizon, lighting, color and image boundary. No redesign, reframing, addition or cropping. Improve natural microdetail of stone, wood, linen and foliage; remove compression blur without halos.”

Prompt de revisão das fotos: “Restore this EXACT existing apartment photograph enlarged from a panorama crop. Reconstruct crisp photographic detail at native output resolution, 3:2. Preserve the same framing, perspective, architecture, furniture, plants, lighting, colors and object positions. No additions, redesign or crop. Resolve natural fibers, grain, stone pores, glass and foliage, with no oversharpening.”

Especificação comum usada nos prompts: “ONE photorealistic architectural 360-degree equirectangular panorama, exact 2:1 aspect ratio, full spherical 360x180 projection, seamless left/right edge, ceiling top pole and floor bottom pole, level horizon. Contemporary luxury Brazilian apartment in Cambuí, Campinas. Warm natural oak, ivory plaster, travertine, linen beige, olive accents, slim black metal frames, morning daylight. Eye-height camera centered in room at 1.55m. No people, text or logos.”

Variações do conjunto de prompts:

- Sala: sofá de linho bege, mesa de centro em travertino, poltrona verde, jantar em carvalho, varanda ao fundo, acesso à cozinha e corredor íntimo.
- Cozinha: armários em carvalho, bancada e ilha claras, torneira preta, eletrodomésticos embutidos, acesso à sala.
- Gourmet: churrasqueira elétrica em parede de pedra clara, armários em carvalho, bancada e banquetas, acesso à varanda.
- Varanda: oitavo andar, esquadrias pretas, bairro arborizado, duas poltronas de fibra, plantas e acesso à sala.
- Suíte: cama king com roupa clara, cabeceira e armários em carvalho, almofadas verdes, janela e acesso ao banheiro privativo.
- Quarto: cama de casal, roupa bege, armário em carvalho, bancada de trabalho e janela preta.
- Banheiro social: travertino, bancada de madeira com cuba branca, metais pretos, box de vidro, vaso sanitário e toalha.
- Banheiro da suíte: travertino, bancada suspensa com duas cubas, metais pretos, espelho iluminado, box e vaso sanitário.
