import { MapPin, BedDouble, Expand, Car, Bath } from "lucide-react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { Badge, ButtonLink } from "./ui";
import { PropertyGallery } from "./property-gallery";
import { ShareButton } from "./share-button";
import { money } from "@/lib/format";
import type { PublicProperty } from "@/features/properties/public-service";
import { TourViewer } from "@/features/tours/viewer";
import { whatsappUrl } from "@/features/organizations/schema";
import type { TourSceneView } from "@/features/tours/viewer-types";
export function PublicPresentation({
  property,
  demo = false,
  tours = [],
}: {
  property: PublicProperty;
  demo?: boolean;
  tours?: {
    id: string;
    title: string;
    initialSceneId: string | null;
    scenes: TourSceneView[];
  }[];
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
            <TourViewer
              scenes={tour.scenes}
              initialSceneId={tour.initialSceneId}
            />
          </section>
        ))}
        {demo && (
          <p className="notice">
            Apresentação demonstrativa · Imóvel fictício. Explore os ambientes
            pelas fotos. Vídeo e navegação 360° fazem parte das próximas etapas.
          </p>
        )}
        {images.length > 0 && (
          <PropertyGallery images={images} title={property.title} />
        )}
        <div className="public-property-info">
          <div>
            <Badge active>{demo ? "DEMONSTRAÇÃO" : "IMÓVEL PUBLICADO"}</Badge>
            <h1>{property.title}</h1>
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
                    Consulte a imobili?ria que compartilhou este imóvel para
                    mais informa??es.
                  </p>
                )}
              </div>
            )}
            <p style={{ fontSize: 10 }}>Uma apresentação ImobView°</p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
