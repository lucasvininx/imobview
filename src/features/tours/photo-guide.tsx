export function PhotoGuide() {
  return (
    <section className="tour-photo-guide" aria-labelledby="photo-guide-title">
      <h2 id="photo-guide-title">Como devem ser as fotos do tour?</h2>
      <p>
        Envie{" "}
        <strong>uma foto esférica 360° completa por ponto de visita</strong>, já
        montada em um único arquivo retangular. Ela deve mostrar todas as
        direções, incluindo teto e chão.
      </p>
      <dl className="tour-photo-specs">
        <div>
          <dt>Projeção e proporção</dt>
          <dd>Equiretangular, 2:1</dd>
          <small>A largura é exatamente o dobro da altura.</small>
        </div>
        <div>
          <dt>Resolução recomendada</dt>
          <dd>4096 × 2048 pixels</dd>
          <small>Bom equilíbrio entre nitidez e carregamento.</small>
        </div>
        <div>
          <dt>Formato e tamanho</dt>
          <dd>JPG, PNG ou WebP · até 20 MB</dd>
          <small>Imagem estática. Prefira JPG para fotografias.</small>
        </div>
      </dl>
      <details>
        <summary>Ver exemplos, limites e como fotografar</summary>
        <div className="tour-photo-guide-body">
          <div
            className="tour-photo-diagram"
            role="img"
            aria-label="Panorama retangular com largura duas vezes maior que a altura. A borda superior representa o teto, a inferior o chão e as laterais se encontram ao fechar a esfera."
          >
            <span>TETO · 90° acima</span>
            <strong>← 360° ao redor →</strong>
            <span>CHÃO · 90° abaixo</span>
          </div>
          <h3>Arquivos aceitos</h3>
          <ul>
            <li>
              <strong>4096 × 2048 px:</strong> recomendado para começar.
            </li>
            <li>
              <strong>6000 × 3000 ou 8192 × 4096 px:</strong> mais detalhe;
              mantenha o arquivo em até 20 MB.
            </li>
            <li>
              <strong>1024 × 512 px:</strong> mínimo aceito, indicado apenas
              para testes pela baixa nitidez.
            </li>
            <li>
              Outras dimensões são aceitas se a largura estiver entre 1024 e
              8192 px e for exatamente o dobro da altura.
            </li>
          </ul>
          <h3>Como capturar e exportar</h3>
          <ol>
            <li>
              Use uma câmera 360° ou um processo de captura que gere uma{" "}
              <strong>esfera completa de 360° × 180°</strong>. A panorâmica
              comum do celular e a lente 0,5× não cobrem essa esfera.
            </li>
            <li>
              Posicione a câmera nivelada, em um tripé estável, aproximadamente
              a 1,50 m do chão. Deixe espaço em volta, sem encostar em paredes
              ou móveis.
            </li>
            <li>
              Organize o ambiente, mantenha a iluminação consistente e evite
              pessoas se movimentando. Faça uma captura por posição; em
              ambientes grandes, use mais de um ponto.
            </li>
            <li>
              No aplicativo da câmera, faça a costura das lentes e exporte como{" "}
              <strong>foto 360° equiretangular em JPG</strong>. Não envie o
              arquivo bruto com duas imagens circulares.
            </li>
            <li>
              Confira a emenda entre as laterais, o horizonte, o teto e o chão.
              Não recorte, estique ou adicione bordas. Apenas redimensione
              mantendo a proporção 2:1, se necessário.
            </li>
            <li>
              Nomeie os arquivos, por exemplo <code>sala-360.jpg</code> e{" "}
              <code>quarto-360.jpg</code>. Envie, adicione os ambientes e crie
              os pontos de ida e de volta.
            </li>
          </ol>
          <p className="notice">
            <strong>Não servem como panorama:</strong> foto comum 4:3 ou 16:9,
            panorâmica parcial, captura de tela, imagem com duas lentes
            circulares, cubemap, vídeo, HEIC, RAW, HDR ou EXR. Exporte primeiro
            para um dos formatos aceitos. Recortar uma foto comum para 2:1 não
            cria as partes do ambiente que não foram fotografadas.
          </p>
          <p>
            O sistema confere formato, tamanho e dimensões. A cobertura completa
            da esfera e a qualidade das emendas precisam ser conferidas na
            prévia antes de publicar.
          </p>
        </div>
      </details>
    </section>
  );
}
