import { businessContact } from "@/config/business";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ButtonLink } from "@/components/ui";
export const metadata = { title: "Vamos conversar" };
export default function Page() {
  const contact = businessContact();
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container legal-page">
        <p className="eyebrow">UMA NOVA PERSPECTIVA COMEÇA AQUI</p>
        <h1>Vamos abrir novas portas.</h1>
        <p>
          Apresente seus imóveis com tours 360° interativos. O beta tem entrada
          acompanhada: ajudamos sua equipe a criar a conta, preparar panoramas e
          publicar o primeiro imóvel.
        </p>
        <h2>Conheça o produto agora</h2>
        <p>
          Explore a demonstração e fale com nossa equipe sobre os limites,
          condições e suporte do beta.
        </p>
        <ButtonLink href="/demonstracao">Explorar demonstração ↗</ButtonLink>
        {contact.whatsapp && (
          <p>
            <a
              className="button button-primary"
              href={contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              Falar com a equipe no WhatsApp
            </a>
          </p>
        )}
        {contact.email && (
          <p>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </p>
        )}
        {!contact.whatsapp && !contact.email && (
          <p className="notice">
            O canal comercial ainda não foi configurado. A demonstração está
            disponível para você conhecer o produto.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
