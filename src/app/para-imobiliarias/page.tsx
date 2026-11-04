import Link from "next/link";
import {
  Building2,
  Scan,
  ContactRound,
  ChartColumn,
  ArrowUpRight,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
export const metadata = { title: "Para imobiliárias e corretores" };
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container professional-page">
        <p className="eyebrow">IMOBVIEW PARA PROFISSIONAIS</p>
        <h1>
          Seu portfólio encontra
          <br />
          novas possibilidades.
        </h1>
        <p className="professional-intro">
          Uma plataforma para publicar imóveis, aproximar clientes e acompanhar
          cada etapa do atendimento da sua imobiliária.
        </p>
        <div className="hero-ctas">
          <Link href="/login" className="button button-primary">
            Acessar minha imobiliária <ArrowUpRight size={17} />
          </Link>
          <Link href="/contato" className="button button-secondary">
            Falar com a equipe
          </Link>
        </div>
        <div className="professional-features">
          {[
            {
              icon: Building2,
              title: "Um portal para seus imóveis",
              text: "Publique ofertas de venda e locação e seja encontrado pela busca inteligente.",
            },
            {
              icon: Scan,
              title: "Visitas que começam online",
              text: "Fotos e tours 360° para apresentar os ambientes antes da visita presencial.",
            },
            {
              icon: ContactRound,
              title: "Leads e CRM, cada um no seu lugar",
              text: "Organize sua base de clientes e acompanhe as negociações em um funil dedicado.",
            },
            {
              icon: ChartColumn,
              title: "Dados para decidir",
              text: "Acompanhe captação, visitas, propostas e resultados com métricas da sua operação.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article className="form-card" key={title}>
              <Icon size={27} />
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
