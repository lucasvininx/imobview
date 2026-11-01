import { MapPin, BedDouble, Expand, Car, Bath } from "lucide-react";
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
        {tours.map((tour) => (
          <section key={tour.id} aria-label={tour.title}>
            <h2>{tour.title}</h2>
            <PublicJourney
              slug={property.slug}
              tour={tour}
              capture={!demo && property.captureLeads}
            />
          </section>
        ))}
        {exterior && (
          <ExteriorViewer config={exterior} title={property.title} />
        )}
        {demo && (
          <p className="notice">
            Apresentação demonstrativa · Imóvel fictício. Explore os ambientes
            no tour 360°. As imagens e informações não representam uma oferta de
            venda.
          </p>
        )}
        {images.length > 0 && (
          <PropertyGallery images={images} title={property.title} />
        )}
        <div className="public-property-info">
          <div>
            <Badge active>{demo ? "DEMONSTRAÇÃO" : "IMÓVEL PUBLICADO"}</Badge>
            <h1>{property.title}</h1>
            {property.internalCode && (
              <p>Referência: {property.internalCode}</p>
            )}
            {property.condominium && <p>Condomínio: {property.condominium}</p>}
            <p style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <MapPin size={15} />
              {property.neighborhood} · {property.city}, {property.state}
            </p>
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
            <strong>{money(property.priceCents)}</strong>
            <ShareButton />
            {demo ? (
              <ButtonLink href="/contato">Conhecer o ImobView ↗</ButtonLink>
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
                    Consulte a imobiliária que compartilhou este imóvel para
                    mais informações.
                  </p>
                )}
              </div>
            )}
            <p style={{ fontSize: 10 }}>Uma apresentação ImobView°</p>
          </aside>
        </div>
        {property.forSale && (
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
