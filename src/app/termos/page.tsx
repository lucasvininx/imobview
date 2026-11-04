import { businessContact } from "@/config/business";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
export const metadata = { title: "Termos de uso" };
export default function Page() {
  const business = businessContact();
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container legal-page">
        <p className="eyebrow">SOBRE ESTA VERSÃO</p>
        <h1>Termos de uso</h1>
        <p>
          O ImobView° permite buscar imóveis publicados por imobiliárias e
          corretores. As informações, disponibilidade e condições de cada oferta
          são de responsabilidade da imobiliária anunciante. A página de
          demonstração identificada como tal contém imóveis fictícios.
        </p>
        <h2>Acesso à plataforma</h2>
        <p>
          O acesso à área profissional é restrito a contas autorizadas. Não
          publique dados pessoais, imagens sem autorização ou informações de
          terceiros neste ambiente.
        </p>
        <h2>Planos e disponibilidade</h2>
        <p>
          O envio de interesse ou a solicitação de visita não reserva um imóvel
          nem confirma uma contratação. A imobiliária combina os detalhes com o
          interessado. Condições comerciais da plataforma, limites e suporte são
          definidos diretamente com a equipe; não há contratação automática.
        </p>
        <h2>Responsável e atendimento</h2>
        {business.name && (
          <p>
            {business.name}
            {business.registration ? ` · ${business.registration}` : ""}
          </p>
        )}
        {business.email ? (
          <p>
            Para suporte, acesso, exportação ou exclusão dos seus dados, entre
            em contato pelo{" "}
            <a href={`mailto:${business.email}`}>{business.email}</a>. A equipe
            confirma a identidade e a autorização antes de atender solicitações.
          </p>
        ) : (
          <p>
            O responsável deve configurar a identificação e o canal de
            atendimento antes da abertura comercial.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
