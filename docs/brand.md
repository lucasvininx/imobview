# Marca e imagens

- Original fornecido pelo usuário: public/brand/imobview-original.png.
- PNG transparente utilizável: public/brand/imobview-logo.png.
- Referência visual fornecida: public/brand/brand-reference.png.
- Paleta principal: #0B0F0E, #064E3B, #10B981, #F8FAF9 e #94A3B8. Tons auxiliares e tokens em src/app/globals.css.
- Fonte: Manrope via next/font. O build precisa de acesso ao Google Fonts; considerar hospedar o arquivo localmente antes de um build offline.

A ferramenta integrada imagegen foi utilizada inicialmente com o prompt: “Remove only the entire dark green background and preserve the exact white symbol and exact white ImobView° lettering. Produce clean flat white logo PNG with genuine alpha transparent background, no shadows, no added text, no changed geometry.”

As duas saídas geradas apresentaram artefatos e não foram incorporadas. O usuário autorizou processamento local. scripts/prepare-brand.mjs extrai a marca branca por luminância do original, preserva alpha e recorta o espaço excedente. A variante final foi conferida sobre fundo escuro.

Fotos ilustrativas hospedadas localmente a partir do Unsplash:

- https://images.unsplash.com/photo-1613490493576-7fde63acd811 — residência;
- https://images.unsplash.com/photo-1600210492486-724fe5c67fb0 — sala;
- https://images.unsplash.com/photo-1600607687939-ce8a6c25118c — interior.

Não representam ofertas reais. Substituir por imagens autorizadas dos imóveis ao implementar upload.
