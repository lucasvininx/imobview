import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Scan,
  MapPin,
  Building2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SearchForm } from "@/features/marketplace/search-form";
import { ListingCard } from "@/features/marketplace/listing-card";
import { searchMarketplace } from "@/features/marketplace/service";
import { searchSchema } from "@/features/marketplace/search";
export const dynamic = "force-dynamic";
export default async function Home() {
  const listings = await searchMarketplace(searchSchema.parse({}));
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="marketplace">
        <section className="market-hero container">
          <div className="market-hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> SEU PRÓXIMO CAPÍTULO COMEÇA AQUI
            </p>
            <h1>
              Um lugar para
              <br />
              chamar de <em>seu.</em>
            </h1>
            <p>
              Comprar ou alugar pode ser mais simples.
              <br />
              Conte o que procura. A gente conecta você ao seu próximo lar.
            </p>
            <div className="market-hero-note">
              <Scan size={20} />
              <span>
                Conheça por dentro.
                <br />
                <strong>Explore imóveis com tour 360°.</strong>
              </span>
            </div>
          </div>
          <div className="market-hero-photo">
            <Image
              src="/images/residencia.jpg"
              alt="Inspiração: casa contemporânea com jardim e piscina"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 55vw"
            />
            <span className="photo-caption">
              Inspiração para o seu próximo lar
            </span>
            <div className="hero-photo-label">
              <span className="hero-label-icon">
                <Building2 size={22} />
              </span>
              <span>
                Uma nova perspectiva.
                <strong>Do primeiro olhar à nova chave.</strong>
              </span>
              <ArrowUpRight size={22} />
            </div>
          </div>
        </section>
        <div className="container home-search">
          <SearchForm />
        </div>
        <section className="container market-section" id="imoveis">
          <div className="market-section-heading">
            <div>
              <p className="eyebrow">ENCONTRE SEU PRÓXIMO ENDEREÇO</p>
              <h2>Novas possibilidades, portas abertas.</h2>
              <p>Imóveis publicados pelas imobiliárias da nossa rede.</p>
            </div>
            <Link className="text-link" href="/buscar">
              Explorar todos <ArrowRight size={17} />
            </Link>
          </div>
          {listings.items.length ? (
            <div className="listing-grid">
              {listings.items.slice(0, 6).map((listing) => (
                <ListingCard key={listing.slug} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="market-empty">
              <MapPin size={28} />
              <h3>Seu próximo endereço pode estar chegando.</h3>
              <p>
                Novos imóveis aparecerão aqui assim que forem publicados pelas
                imobiliárias.
              </p>
              <Link className="button button-secondary" href="/buscar">
                Explorar busca
              </Link>
            </div>
          )}
        </section>
        <section className="market-how container" id="como-funciona">
          <div>
            <p className="eyebrow">DO SEU JEITO, NO SEU TEMPO</p>
            <h2>
              Menos procura.
              <br />
              Mais possibilidades.
            </h2>
          </div>
          {[
            {
              icon: Sparkles,
              title: "Descreva o seu lugar",
              text: "Cidade, bairro, quartos e orçamento. Escreva como você falaria com alguém.",
            },
            {
              icon: Scan,
              title: "Entre antes de visitar",
              text: "Explore fotos e tours 360° disponíveis para conhecer os detalhes de cada espaço.",
            },
            {
              icon: Building2,
              title: "Converse com quem conhece",
              text: "Gostou? Envie seu interesse diretamente à imobiliária responsável pelo imóvel.",
            },
          ].map(({ icon: Icon, title, text }, i) => (
            <article key={title}>
              <span className="how-number">0{i + 1}</span>
              <Icon size={24} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </section>
        <section className="market-professional container">
          <div>
            <p className="eyebrow">PARA IMOBILIÁRIAS E CORRETORES</p>
            <h2>
              Seu próximo cliente
              <br />
              também está procurando você.
            </h2>
            <p>
              Publique seus imóveis, crie tours 360° e acompanhe cada
              oportunidade em um só lugar.
            </p>
            <Link className="button button-primary" href="/para-imobiliarias">
              Conhecer a plataforma <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="professional-mark" aria-hidden="true">
            <Building2 size={100} strokeWidth={0.7} />
            <span>
              Imóveis. Pessoas.
              <br />
              <strong>Conexões.</strong>
            </span>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
