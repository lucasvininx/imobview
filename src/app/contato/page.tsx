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
          Leve seus imóveis até quem está procurando um novo lugar. Nossa equipe
          ajuda sua imobiliária a organizar o portfólio, preparar tours 360° e
          acompanhar os contatos recebidos.
        </p>
        <h2>Uma nova perspectiva para o seu negócio</h2>
        <p>
          Conheça as ferramentas para imobiliárias e corretores. Fale com nossa
          equipe sobre condições, implantação e suporte para a sua operação.
        </p>
        <ButtonLink href="/para-imobiliarias">
          Conhecer a plataforma ↗
        </ButtonLink>
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
            O atendimento comercial está indisponível neste momento. Você pode
            explorar o portal ou acessar sua conta profissional.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
