import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  BedDouble,
  Bath,
  Car,
  Expand,
  Scan,
  Building2,
  ArrowUpRight,
} from "lucide-react";
import type { Listing } from "./service";
import { money } from "@/lib/format";
const types = {
  HOUSE: "Casa",
  APARTMENT: "Apartamento",
  LAND: "Terreno",
  COMMERCIAL: "Comercial",
};
export function ListingCard({ listing: p }: { listing: Listing }) {
  return (
    <Link href={`/v/${p.slug}`} className="listing-card">
      <div className="listing-image">
        {p.image ? (
          <Image
            src={p.image}
            alt={p.title}
            fill
            sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
            unoptimized={!p.image.startsWith("/")}
          />
        ) : (
          <div className="listing-no-photo">
            <Building2 size={40} strokeWidth={1} />
            <span>Fotos em breve</span>
          </div>
        )}
        <span className="listing-purpose">
          {p.purpose === "RENT" ? "Para alugar" : "À venda"}
        </span>
        {p.hasTour && (
          <span className="listing-tour">
            <Scan size={13} /> Tour 360°
          </span>
        )}
      </div>
      <div className="listing-body">
        <span className="listing-type">{types[p.type]}</span>
        <h3>{p.title}</h3>
        <p className="listing-location">
          <MapPin size={13} />
          {[p.neighborhood, p.city, p.state].filter(Boolean).join(" · ")}
        </p>
        <div className="listing-specs">
          <span>
            <Expand size={14} /> {p.area} m²
          </span>
          <span>
            <BedDouble size={14} /> {p.bedrooms}
          </span>
          <span>
            <Bath size={14} /> {p.bathrooms}
          </span>
          <span>
            <Car size={14} /> {p.parkingSpaces}
          </span>
        </div>
        <div className="listing-price">
          <strong>
            {money(p.priceCents)}
            {p.purpose === "RENT" && <small>/mês</small>}
          </strong>
          <ArrowUpRight size={19} />
        </div>
        <p className="listing-agency">{p.organizationName}</p>
      </div>
    </Link>
  );
}
