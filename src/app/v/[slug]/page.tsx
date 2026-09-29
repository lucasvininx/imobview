import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProperty } from "@/features/properties/public-service";
import { PublicPresentation } from "@/components/public-presentation";
import { publicTours } from "@/features/tours/presentation";
const getProperty = cache(getPublicProperty);
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const property = await getProperty(slug);
  if (!property)
    return {
      title: "Imóvel indisponível",
      robots: { index: false, follow: false },
    };
  return {
    title: property.title,
    description: property.description.slice(0, 160),
    alternates: { canonical: `/v/${property.slug}` },
    openGraph: {
      title: property.title,
      description: property.description.slice(0, 160),
      url: `/v/${property.slug}`,
      images: [`/v/${property.slug}/capa`],
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const property = await getProperty(slug);
  if (!property) notFound();
  const tours = await publicTours(slug);
  return <PublicPresentation property={property} tours={tours} />;
}
