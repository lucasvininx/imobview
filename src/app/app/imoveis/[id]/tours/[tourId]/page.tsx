import { notFound } from "next/navigation";
import { z } from "zod";
import { requireWorkspace } from "@/server/session";
import { getTour } from "@/features/tours/service";
import { tourDocumentSchema } from "@/features/tours/schema";
import { TourEditor } from "@/features/tours/editor";
import { PageHeader, ButtonLink } from "@/components/ui";
import { can } from "@/domain/permissions";
import { DomainError } from "@/domain/errors";
import { signPanoramas, storageConfigured } from "@/server/supabase/storage";
export const maxDuration = 120;
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; tourId: string }>;
}) {
  const { id, tourId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(tourId).success)
    notFound();
  const { actor, membership } = await requireWorkspace();
  const tour = await getTour(actor, tourId).catch((error) => {
    if (error instanceof DomainError) notFound();
    throw error;
  });
  if (tour.propertyId !== id) notFound();
  const document = tourDocumentSchema.parse(tour.draft);
  const assets = tour.assets.filter((asset) => asset.status === "READY");
  const ready = storageConfigured();
  const urls = ready
    ? await signPanoramas(assets.map((asset) => asset.storageKey))
    : new Map<string, string>();
  return (
    <>
      <PageHeader
        eyebrow="EDITOR DE TOUR 360°"
        title={tour.title}
        description={tour.property.title}
        action={
          <ButtonLink variant="secondary" href={`/app/imoveis/${id}`}>
            Voltar ao imóvel
          </ButtonLink>
        }
      />
      <TourEditor
        id={tour.id}
        initialTitle={tour.title}
        initialDocument={document}
        initialVersion={tour.version}
        initialStatus={tour.status}
        incompleteAssets={tour.assets
          .filter((asset) => asset.status === "PENDING")
          .map((asset) => ({ id: asset.id, fileName: asset.fileName }))}
        initialAssets={assets.map((asset) => ({
          id: asset.id,
          fileName: asset.fileName,
          url: urls.get(asset.storageKey) ?? "",
        }))}
        canEdit={
          can(membership.role, "property:update") &&
          tour.property.status !== "ARCHIVED"
        }
        canPublish={
          can(membership.role, "property:publish") &&
          tour.property.status !== "ARCHIVED"
        }
        storageReady={ready}
      />
    </>
  );
}
