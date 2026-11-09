import { SiteHeader } from "@/components/site-header";

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main
        id="conteudo"
        className="container public-property"
        aria-busy="true"
      >
        <div className="property-loading" role="status">
          <p className="eyebrow">SEU PRÓXIMO ENDEREÇO</p>
          <h1>Preparando os detalhes do imóvel…</h1>
          <p>Fotos, informações e formas de conversar com a imobiliária.</p>
        </div>
      </main>
    </>
  );
}
