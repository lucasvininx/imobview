import { MapPin, BedDouble, Expand, Car, Bath } from "lucide-react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { Badge, ButtonLink } from "./ui";
import { PropertyGallery } from "./property-gallery";
import { ShareButton } from "./share-button";
import { money } from "@/lib/format";
import type { PublicProperty } from "@/features/properties/public-service";
export function PublicPresentation({
  property,
  demo = false,
}: {
  property: PublicProperty;
  demo?: boolean;
}) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container public-property">
        {demo && (
          <p className="notice">
            Apresentação demonstrativa · Imóvel fictício. Explore os ambientes
            pelas fotos. Vídeo e navegação 360° fazem parte das próximas etapas.
          </p>
        )}
        {property.cover && (
          <PropertyGallery
            images={
              demo
                ? [
                    property.cover,
                    "/images/interior.jpg",
                    "/images/residencia.jpg",
                  ]
                : [property.cover]
            }
            title={property.title}
          />
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
              <p>
                Consulte a imobiliária que compartilhou este imóvel para mais
                informações.
              </p>
            )}
            <p style={{ fontSize: 10 }}>Uma apresentação ImobView°</p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
