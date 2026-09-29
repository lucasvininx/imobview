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
          O ImobView° está em desenvolvimento. A demonstração contém imóveis
          fictícios e não representa oferta de compra, venda ou locação.
        </p>
        <h2>Acesso à plataforma</h2>
        <p>
          O acesso é restrito a contas autorizadas para testes. Não publique
          dados pessoais, imagens sem autorização ou informações de terceiros
          neste ambiente.
        </p>
        <h2>Planos e disponibilidade</h2>
        <p>
          As propostas de planos apresentadas são conceituais. Não há cobrança
          nem contratação automática nesta versão. Condições comerciais,
          limites, responsabilidades e suporte serão definidos em termos
          próprios antes do lançamento.
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
