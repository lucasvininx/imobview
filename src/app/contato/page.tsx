import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ButtonLink } from "@/components/ui";
export const metadata = { title: "Vamos conversar" };
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container legal-page">
        <p className="eyebrow">UMA NOVA PERSPECTIVA COMEÇA AQUI</p>
        <h1>Vamos abrir novas portas.</h1>
        <p>
          O ImobView° está em fase de desenvolvimento. Estamos preparando uma
          experiência para imobiliárias e corretores que querem apresentar seus
          imóveis de uma nova forma.
        </p>
        <h2>Conheça o produto agora</h2>
        <p>
          Explore a apresentação demonstrativa. O canal comercial e a abertura
          de novas contas serão anunciados no lançamento.
        </p>
        <ButtonLink href="/demonstracao">Explorar demonstração ↗</ButtonLink>
        <p className="notice" style={{ marginTop: 30 }}>
          Ainda não recebemos solicitações por este site. Nenhum dado de contato
          é coletado nesta página.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
