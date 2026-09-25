import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  ArrowUpRight,
  MapPin,
  BedDouble,
  Expand,
} from "lucide-react";
import { Badge } from "./ui";
import { money } from "@/lib/format";
import { statusLabels } from "@/features/properties/schema";
import type { Property } from "@/generated/prisma/client";
export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link href={`/app/imoveis/${property.id}`} className="property-card">
      <div className="property-card-image">
        {property.cover ? (
          <Image
            src={property.cover}
            alt={property.title}
            fill
            sizes="(max-width: 500px) 100vw, 33vw"
          />
        ) : (
          <Building2 size={35} />
        )}
        <Badge active={property.status === "PUBLISHED"}>
          {statusLabels[property.status]}
        </Badge>
      </div>
      <div className="property-card-body">
        <h3>{property.title}</h3>
        <p>
          <MapPin size={12} />
          {property.neighborhood ? property.neighborhood + ", " : ""}
          {property.city} · {property.state}
        </p>
        <div className="property-details">
          <span>
            <Expand size={13} />
            {property.area} m²
          </span>
          <span>
            <BedDouble size={13} />
            {property.bedrooms} quartos
          </span>
        </div>
        <div className="property-card-bottom">
          <strong>{money(property.priceCents)}</strong>
          <ArrowUpRight size={18} />
        </div>
      </div>
    </Link>
  );
}
