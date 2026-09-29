import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTenant, type Actor } from "@/server/tenant";
import { DomainError } from "@/domain/errors";
import { reserveUpload, maxPhotosPerProperty } from "@/domain/entitlements";
import {
  createPanoramaUpload,
  inspectAndPromotePhoto,
  removeTemporaryPanorama,
  signPanoramas,
} from "@/server/supabase/storage";

const photoSchema = z.object({
  propertyId: z.uuid(),
  fileName: z.string().min(1).max(160),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});
export async function listPhotos(actor: Actor, propertyId: string) {
  z.uuid().parse(propertyId);
  const photos = await withTenant(actor, "property:read", (tx) =>
    tx.propertyPhoto.findMany({
      where: { propertyId, organizationId: actor.organizationId },
      orderBy: { createdAt: "asc" },
    }),
  );
  const urls = await signPanoramas(
    photos.filter((p) => p.status === "READY").map((p) => p.storageKey),
  );
  return photos
    .filter((p) => p.status !== "FAILED")
    .map((p) => ({
      id: p.id,
      fileName: p.fileName,
      ready: p.status === "READY",
      url: urls.get(p.storageKey) ?? "",
    }));
}
export async function authorizePhoto(actor: Actor, input: unknown) {
  const validated = photoSchema.parse(input);
  const parsed = {
    propertyId: validated.propertyId,
    fileName: validated.fileName,
    size: validated.size,
  };
  const photo = await withTenant(actor, "property:update", async (tx) => {
    const property = await tx.property.findFirst({
      where: { id: parsed.propertyId, organizationId: actor.organizationId },
    });
    if (!property) throw new DomainError("NOT_FOUND", "Imóvel não encontrado.");
    if (property.status === "ARCHIVED")
      throw new DomainError("CONFLICT", "Imóvel arquivado.");
    await reserveUpload(tx, actor.organizationId, false);
    if (
      (await tx.propertyPhoto.count({
        where: {
          propertyId: property.id,
          organizationId: actor.organizationId,
        },
      })) >= maxPhotosPerProperty
    )
      throw new DomainError(
        "CONFLICT",
        "Limite de 20 fotos por imóvel. Remova fotos sem uso.",
      );
    const id = randomUUID();
    const prefix = `${actor.organizationId}/photos/${property.id}/${id}`;
    return tx.propertyPhoto.create({
      data: {
        ...parsed,
        id,
        organizationId: actor.organizationId,
        storageKey: `${prefix}/photo.jpg`,
        uploadKey: `${prefix}/upload`,
      },
    });
  });
  return { id: photo.id, url: await createPanoramaUpload(photo.uploadKey) };
}
export async function finalizePhoto(actor: Actor, id: string) {
  z.uuid().parse(id);
  return withTenant(
    actor,
    "property:update",
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PropertyPhoto" WHERE id=${id}::uuid AND "organizationId"=${actor.organizationId}::uuid FOR UPDATE`;
      const photo = await tx.propertyPhoto.findFirst({
        where: { id, organizationId: actor.organizationId },
      });
      if (!photo) throw new DomainError("NOT_FOUND", "Foto não encontrada.");
      if (photo.status === "READY") return;
      if (photo.status === "FAILED")
        throw new DomainError(
          "CONFLICT",
          "Este envio foi descartado. Envie uma nova foto.",
        );
      await inspectAndPromotePhoto(
        photo.uploadKey,
        photo.storageKey,
        photo.size,
      );
      await tx.propertyPhoto.update({
        where: { id },
        data: { status: "READY" },
      });
      await removeTemporaryPanorama(photo.uploadKey).catch(() => undefined);
    },
    120000,
  );
}
export async function removePhoto(actor: Actor, id: string) {
  z.uuid().parse(id);
  return withTenant(
    actor,
    "property:update",
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PropertyPhoto" WHERE id=${id}::uuid AND "organizationId"=${actor.organizationId}::uuid FOR UPDATE`;
      const photo = await tx.propertyPhoto.findFirst({
        where: { id, organizationId: actor.organizationId },
      });
      if (!photo) throw new DomainError("NOT_FOUND", "Foto não encontrada.");
      await removeTemporaryPanorama(photo.uploadKey);
      await removeTemporaryPanorama(photo.storageKey);
      if (Date.now() - photo.createdAt.getTime() < 24 * 60 * 60 * 1000) {
        await tx.propertyPhoto.update({
          where: { id, organizationId: actor.organizationId },
          data: { status: "FAILED" },
        });
      } else
        await tx.propertyPhoto.delete({
          where: { id, organizationId: actor.organizationId },
        });
    },
    30000,
  );
}
