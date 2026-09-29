# Fotos para tours ImobView°

Cada ambiente usa uma foto esférica completa, já costurada e exportada em projeção equiretangular. A imagem cobre 360° ao redor e 180° do teto ao chão. O ImobView conecta esses panoramas; não transforma automaticamente fotografias comuns em uma visita 360°.

| Item              | Especificação                                             |
| ----------------- | --------------------------------------------------------- |
| Proporção         | Exatamente 2:1; largura = 2 × altura                      |
| Recomendado       | 4096 × 2048 pixels                                        |
| Maior detalhe     | 6000 × 3000 ou 8192 × 4096 pixels                         |
| Mínimo aceito     | 1024 × 512 pixels, apenas para testes de baixa resolução  |
| Largura permitida | Entre 1024 e 8192 pixels, mantendo 2:1                    |
| Formatos          | JPEG/JPG, PNG ou WebP estático                            |
| Peso máximo       | 20 MB por arquivo                                         |
| Quantidade        | Até 30 ambientes por tour; um panorama por ambiente/ponto |

Use câmera 360° ou captura que gere a esfera completa. Panorâmica parcial do celular, lente ultrawide/0,5× e fotografia convencional não bastam. Posicione a câmera nivelada, aproximadamente a 1,50 m de altura, com iluminação consistente e sem pessoas em movimento. Para ambientes grandes, fotografe vários pontos.

No aplicativo da câmera, costure as lentes e exporte como foto 360° equiretangular em JPG. Não envie duas imagens circulares, cubemaps, arquivos brutos, HEIC, HDR, EXR ou vídeos. Não recorte nem estique o resultado; redimensione proporcionalmente se estiver acima do limite. Confira teto, chão, horizonte e a emenda lateral. Nomeie os arquivos como `sala-360.jpg` e `quarto-360.jpg`.

Após enviar: adicione os ambientes, escolha o inicial, marque os pontos de navegação, crie conexões de ida e volta, salve e publique. A validação automática confere formato, peso e dimensões; a cobertura da esfera e a qualidade da costura precisam ser revisadas visualmente.

## Exemplo publicado

Na Imobiliária Demo, **Casa Modelo 360° — Demonstração** possui sala e quarto conectados nos dois sentidos. Página pública local: `/v/casa-modelo-tour-360`. Dados do imóvel e conexões são ilustrativos; não é um anúncio de venda nem uma reprodução da planta real.

Panoramas de terceiros, disponíveis sob [CC0 pela Poly Haven](https://polyhaven.com/license): [Lythwood Lounge](https://polyhaven.com/a/lythwood_lounge) e [Lythwood Room](https://polyhaven.com/a/lythwood_room). Foram utilizados os JPGs equiretangulares de 8192 × 4096 pixels disponibilizados pelo acervo, enviados pelo fluxo de validação e Storage da aplicação. Não se trata de imagens geradas por IA.
