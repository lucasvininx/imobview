# Apartamento Aurora

Abra `/v/apartamento-jardim-demo`. O cadastro foi preparado na organização `imobiliaria-demo`, aproveitando um apartamento demonstrativo sem fotos ou tours. Não foram alterados anúncios reais, usuários ou configurações da organização.

128 m², dois quartos (uma suíte), dois banheiros e duas vagas, com valor ilustrativo de R$ 1.280.000. Os oito ambientes são sala de estar e jantar, cozinha, área gourmet, varanda, suíte principal, quarto de hóspedes, banheiro social e banheiro da suíte.

## Roteiro da reunião

1. Abra a página pública e clique em uma foto para mostrar a galeria. As setas do teclado trocam as imagens; Escape fecha.
2. Clique em “Explorar tour 360°” e “Iniciar tour 360°”. Arraste a imagem para olhar ao redor, use os controles de zoom e tela cheia.
3. Passe pela cozinha, área gourmet e varanda usando os nomes dos ambientes ou as setas do panorama. Existem 16 conexões direcionais, com caminho de volta para todos os cômodos.
4. Clique nos pontos da planta para entrar nos quartos e banheiros. Os pontos “i” mostram detalhes de cada ambiente.
5. Abra a simulação de financiamento e altere entrada, prazo ou sistema SAC/Price.

O tour deste cadastro demonstrativo abre sem identificação. Os anúncios reais mantêm seu fluxo de cadastro de visitantes. O contato comercial fica identificado como demonstração e não envia leads fictícios.

## Arquivos e cadastro

- Imagens: `public/demo/apartamento-aurora/panoramas/` e `public/demo/apartamento-aurora/fotos/`.
- Planta: `public/demo/apartamento-aurora/planta.webp`, esquemática e sem escala.
- Provisionamento: `npx tsx scripts/seed-apartment-demo.ts` simula; com `--apply`, grava no banco configurado e envia as mídias ao bucket privado já configurado. Reexecuções reconhecem o cadastro pronto sem duplicá-lo. O comando só modifica este cadastro marcado como demonstração; valida proporção, limites e conectividade, usa transação e remove uploads novos em caso de falha.
- As fotos públicas são projeções retangulares dos mesmos panoramas do tour. A aplicação usa as cópias do Storage privado com URLs temporárias; a capa local serve para catálogo e compartilhamento.

## Origem das imagens

Imagens ilustrativas geradas com a ferramenta integrada `image_gen`, sem fotografia de um imóvel real. Não constituem levantamento arquitetônico: a continuidade espacial e as dimensões não têm precisão de captura real. Essa natureza demonstrativa também aparece na página pública. Para apresentar um imóvel real, substitua por panoramas equiretangulares capturados no local.

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
