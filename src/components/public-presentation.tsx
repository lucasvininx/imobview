import {
  MapPin,
  BedDouble,
  Expand,
  Car,
  Bath,
  MessageCircle,
  Scan,
  Calculator,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { Badge, ButtonLink } from "./ui";
import { PropertyGallery } from "./property-gallery";
import { ShareButton } from "./share-button";
import { money } from "@/lib/format";
import type { PublicProperty } from "@/features/properties/public-service";
import { PublicJourney } from "@/features/leads/public-journey";
import { whatsappUrl } from "@/features/organizations/schema";
import type { TourView } from "@/features/tours/viewer-types";
import { FinancingSimulator } from "@/features/financing/simulator";
import { ExteriorViewer } from "@/features/exterior/viewer";
import type { ExteriorConfig } from "@/features/exterior/schema";
import { TourViewer } from "@/features/tours/viewer";
import { InterestForm } from "@/features/marketplace/interest-form";
export function PublicPresentation({
  property,
  demo = false,
  tours = [],
  exterior = null,
}: {
  property: PublicProperty;
  demo?: boolean;
  tours?: TourView[];
  exterior?: ExteriorConfig | null;
}) {
  const canSimulate = property.forSale && property.priceCents > BigInt(0);
  const contact = whatsappUrl(
    property.whatsapp,
    `Olá! Tenho interesse no imóvel ${property.title}.`,
  );
  const images = property.photos.length
    ? property.photos
    : property.cover
      ? [property.cover]
      : [];
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container public-property">
        <Link href="/buscar" className="text-link property-back">
          <ArrowLeft size={16} /> Voltar aos imóveis
        </Link>
        {!demo && property.isDemo && (
          <p className="notice">
            Imóvel demonstrativo · Este cadastro é fictício. As imagens e os
            valores são ilustrativos e não representam uma oferta real.
          </p>
        )}
        {demo && (
          <p className="notice">
            Apresentação demonstrativa · Imóvel fictício. Explore os ambientes
            no tour 360°. As imagens e informações não representam uma oferta de
            venda.
          </p>
        )}
        <div className="public-property-info">
          <div>
            <Badge active>
              {demo
                ? "DEMONSTRAÇÃO"
                : property.forSale
                  ? "À VENDA"
                  : "PARA ALUGAR"}
            </Badge>
            <h1>{property.title}</h1>
            {property.internalCode && (
              <p>Referência: {property.internalCode}</p>
            )}
            {property.condominium && <p>Condomínio: {property.condominium}</p>}
            <p style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <MapPin size={15} />
              {property.neighborhood} · {property.city}, {property.state}
            </p>
            <nav
              className="property-shortcuts"
              aria-label="Explore este imóvel"
            >
              <a href="#contato-imovel">
                <MessageCircle size={17} />{" "}
                {property.forSale ? "Falar com a imobiliária" : "Quero alugar"}
              </a>
              {tours.length > 0 && (
                <a href="#tour-imovel">
                  <Scan size={17} /> Explorar tour 360°
                </a>
              )}
              {canSimulate && (
                <a href="#financiamento">
                  <Calculator size={17} /> Simular financiamento
                </a>
              )}
            </nav>
            <div className="public-specs">
              <span>
                <Expand size={18} />
                {property.area} m²
              </span>
              <span>
                <BedDouble size={18} />
                {property.bedrooms} quartos
              </span>
              {property.suites > 0 && <span>{property.suites} suíte(s)</span>}
              <span>
                <Bath size={18} />
                {property.bathrooms} banheiros
              </span>
              <span>
                <Car size={18} />
                {property.parkingSpaces} vagas
              </span>
            </div>
            <h2 style={{ fontSize: 24 }}>Um espaço para novas histórias.</h2>
            <p>{property.description}</p>
          </div>
          <aside className="public-price">
            <p>Apresentado por {property.organizationName}</p>
            <strong>
              {money(property.priceCents)}
              {!property.forSale && !demo && <small> /mês</small>}
            </strong>
            <ShareButton />
            <a className="button button-primary" href="#contato-imovel">
              <MessageCircle size={17} />{" "}
              {property.forSale
                ? "Tenho interesse neste imóvel"
                : "Tenho interesse em alugar"}
            </a>
            {demo || property.isDemo ? (
              <ButtonLink href="/buscar">Explorar outros imóveis ↗</ButtonLink>
            ) : (
              <div>
                {contact && (
                  <a
                    className="button button-primary"
                    href={contact}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Conversar no WhatsApp ↗
                  </a>
                )}
                {property.contactEmail && (
                  <a
                    className="button button-secondary"
                    href={`mailto:${property.contactEmail}?subject=${encodeURIComponent(property.title)}`}
                  >
                    Enviar e-mail
                  </a>
                )}
                {!contact && !property.contactEmail && (
                  <p>
                    Envie seu contato abaixo. A equipe responsável retornará
                    para conversar sobre este imóvel.
                  </p>
                )}
              </div>
            )}
            <p style={{ fontSize: 10 }}>Uma apresentação ImobView°</p>
          </aside>
        </div>
        {images.length > 0 && (
          <PropertyGallery images={images} title={property.title} />
        )}
        <section
          id="contato-imovel"
          className="property-contact"
          aria-label="Contato sobre o imóvel"
        >
          <div>
            <p className="eyebrow">SEU PRÓXIMO PASSO</p>
            <h2>
              {property.forSale
                ? "Vamos conversar sobre este imóvel?"
                : "Gostou? Saiba como alugar."}
            </h2>
            <p>Atendimento por {property.organizationName}.</p>
            <p>
              {property.forSale
                ? "Tire suas dúvidas e combine uma visita com a equipe responsável."
                : "Consulte a disponibilidade, as condições de locação e agende uma visita com a imobiliária ou corretor responsável."}
            </p>
          </div>
          {demo || property.isDemo ? (
            <p className="notice">
              Este imóvel é demonstrativo e não está disponível para
              contratação. Nos anúncios reais, você pode enviar seu contato
              diretamente à imobiliária responsável.
            </p>
          ) : (
            <InterestForm
              slug={property.slug}
              agency={property.organizationName}
              purpose={property.forSale ? "SALE" : "RENT"}
            />
          )}
        </section>
        <div id="tour-imovel">
          {tours.map((tour) => (
            <section key={tour.id} aria-label={tour.title}>
              <h2>{tour.title}</h2>
              {demo ? (
                <TourViewer
                  scenes={tour.scenes}
                  floorPlans={tour.floorPlans}
                  initialSceneId={tour.initialSceneId}
                />
              ) : (
                <PublicJourney slug={property.slug} tour={tour} />
              )}
            </section>
          ))}
        </div>
        {exterior && (
          <ExteriorViewer config={exterior} title={property.title} />
        )}
        {canSimulate && (
          <FinancingSimulator
            priceCents={Number(property.priceCents)}
            defaultRateBps={property.financingRateBps}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
