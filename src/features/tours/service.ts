import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTenant, type Actor } from "@/server/tenant";
import { DomainError } from "@/domain/errors";
import {
  reserveUpload,
  maxToursPerProperty,
  maxAssetsPerTour,
} from "@/domain/entitlements";
import {
  publicationIssues,
  saveTourSchema,
  tourDocumentSchema,
  uploadSchema,
} from "./schema";
import {
  createPanoramaUpload,
  inspectAndPromotePanorama,
  removeTemporaryPanorama,
} from "@/server/supabase/storage";
const idSchema = z.uuid();
export function listTours(actor: Actor, propertyId: string) {
  idSchema.parse(propertyId);
  return withTenant(actor, "property:read", (tx) =>
    tx.tour.findMany({
      where: { propertyId, organizationId: actor.organizationId },
      orderBy: { createdAt: "asc" },
    }),
  );
}
export function getTour(actor: Actor, id: string) {
  idSchema.parse(id);
  return withTenant(actor, "property:read", async (tx) => {
    const tour = await tx.tour.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        assets: { orderBy: { createdAt: "asc" } },
        property: { select: { title: true, slug: true, status: true } },
      },
    });
    if (!tour) throw new DomainError("NOT_FOUND", "Tour não encontrado.");
    return tour;
  });
}
export function createTour(actor: Actor, propertyId: string, title: string) {
  idSchema.parse(propertyId);
  z.string().trim().min(2).max(120).parse(title);
  return withTenant(actor, "property:create", async (tx) => {
    const property = await tx.property.findFirst({
      where: { id: propertyId, organizationId: actor.organizationId },
    });
    if (!property) throw new DomainError("NOT_FOUND", "Imóvel não encontrado.");
    if (property.status === "ARCHIVED")
      throw new DomainError("CONFLICT", "Imóvel arquivado.");
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${propertyId}::uuid FOR UPDATE`;
    if (
      (await tx.tour.count({
        where: { propertyId, organizationId: actor.organizationId },
      })) >= maxToursPerProperty
    )
      throw new DomainError(
        "CONFLICT",
        "Este imóvel atingiu o limite de 10 tours.",
      );
    return tx.tour.create({
      data: {
        propertyId,
        organizationId: actor.organizationId,
        title: title.trim(),
      },
    });
  });
}
export function saveTour(actor: Actor, input: unknown) {
  const parsed = saveTourSchema.parse(input);
  return withTenant(actor, "property:update", async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Tour" WHERE id=${parsed.id}::uuid AND "organizationId"=${actor.organizationId}::uuid FOR UPDATE`;
    const tour = await tx.tour.findFirst({
      where: { id: parsed.id, organizationId: actor.organizationId },
      include: { property: { select: { status: true } } },
    });
    if (!tour) throw new DomainError("NOT_FOUND", "Tour não encontrado.");
    if (tour.status === "ARCHIVED" || tour.property.status === "ARCHIVED")
      throw new DomainError("CONFLICT", "Este conteúdo está arquivado.");
    const assetIds = [
      ...new Set(parsed.document.scenes.map((scene) => scene.assetId)),
    ];
    if (
      (await tx.panoramaAsset.count({
        where: {
          id: { in: assetIds },
          organizationId: actor.organizationId,
          tourId: tour.id,
          status: "READY",
        },
      })) !== assetIds.length
    )
      throw new DomainError(
        "VALIDATION",
        "Use apenas panoramas validados deste tour.",
      );
    const result = await tx.tour.updateMany({
      where: {
        id: tour.id,
        organizationId: actor.organizationId,
        version: parsed.version,
      },
      data: {
        title: parsed.title,
        draft: parsed.document,
        version: { increment: 1 },
      },
    });
    if (!result.count)
      throw new DomainError(
        "CONFLICT",
        "O tour foi alterado em outra aba. Recarregue antes de salvar.",
      );
    return parsed.version + 1;
  });
}
export function publishTour(
  actor: Actor,
  id: string,
  version: number,
  publish: boolean,
) {
  idSchema.parse(id);
  z.number().int().positive().parse(version);
  return withTenant(actor, "property:publish", async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Tour" WHERE id=${id}::uuid AND "organizationId"=${actor.organizationId}::uuid FOR UPDATE`;
    const tour = await tx.tour.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { property: { select: { status: true } } },
    });
    if (!tour) throw new DomainError("NOT_FOUND", "Tour não encontrado.");
    if (tour.status === "ARCHIVED" || tour.property.status === "ARCHIVED")
      throw new DomainError("CONFLICT", "Este conteúdo está arquivado.");
    const document = tourDocumentSchema.parse(tour.draft);
    if (publish) {
      const issues = publicationIssues(document);
      if (issues.length) throw new DomainError("VALIDATION", issues[0]);
      const ids = [...new Set(document.scenes.map((s) => s.assetId))];
      if (
        (await tx.panoramaAsset.count({
          where: {
            id: { in: ids },
            tourId: id,
            organizationId: actor.organizationId,
            status: "READY",
          },
        })) !== ids.length
      )
        throw new DomainError("VALIDATION", "Há panoramas não validados.");
    }
    const result = await tx.tour.updateMany({
      where: { id, organizationId: actor.organizationId, version },
      data: {
        status: publish ? "PUBLISHED" : "DRAFT",
        ...(publish ? { published: { ...document, title: tour.title } } : {}),
        publishedAt: publish ? new Date() : null,
        version: { increment: 1 },
      },
    });
    if (!result.count)
      throw new DomainError(
        "CONFLICT",
        "O tour foi alterado em outra aba. Recarregue antes de publicar.",
      );
    return version + 1;
  });
}
export async function authorizePanorama(actor: Actor, input: unknown) {
  const parsed = uploadSchema.parse(input);
  const id = randomUUID();
  const asset = await withTenant(actor, "property:update", async (tx) => {
    const tour = await tx.tour.findFirst({
      where: { id: parsed.tourId, organizationId: actor.organizationId },
      include: { property: { select: { status: true } } },
    });
    if (!tour) throw new DomainError("NOT_FOUND", "Tour não encontrado.");
    if (tour.status === "ARCHIVED" || tour.property.status === "ARCHIVED")
      throw new DomainError("CONFLICT", "Conteúdo arquivado.");
    await reserveUpload(tx, actor.organizationId, true);
    await tx.$queryRaw`SELECT id FROM "Tour" WHERE id=${tour.id}::uuid FOR UPDATE`;
    if (
      (await tx.panoramaAsset.count({
        where: {
          tourId: tour.id,
          organizationId: actor.organizationId,
          status: { in: ["PENDING", "READY"] },
        },
      })) >= maxAssetsPerTour
    )
      throw new DomainError(
        "CONFLICT",
        "Limite de 40 uploads por tour atingido.",
      );
    const prefix = `${actor.organizationId}/${tour.id}/${id}`;
    return tx.panoramaAsset.create({
      data: {
        id,
        organizationId: actor.organizationId,
        ...parsed,
        storageKey: `${prefix}/panorama.jpg`,
        uploadKey: `${prefix}/upload`,
      },
    });
  });
  try {
    return { id: asset.id, url: await createPanoramaUpload(asset.uploadKey) };
  } catch (error) {
    await withTenant(actor, "property:update", (tx) =>
      tx.panoramaAsset.updateMany({
        where: { id: asset.id, organizationId: actor.organizationId },
        data: { status: "FAILED" },
      }),
    );
    throw error;
  }
}
export async function finalizePanorama(actor: Actor, id: string) {
  idSchema.parse(id);
  return withTenant(
    actor,
    "property:update",
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PanoramaAsset" WHERE id=${id}::uuid AND "organizationId"=${actor.organizationId}::uuid FOR UPDATE`;
      const asset = await tx.panoramaAsset.findFirst({
        where: { id, organizationId: actor.organizationId },
      });
      if (!asset) throw new DomainError("NOT_FOUND", "Arquivo não encontrado.");
      if (asset.status === "READY") return asset;
      if (asset.status !== "PENDING")
        throw new DomainError("CONFLICT", "Envie o arquivo novamente.");
      const metadata = await inspectAndPromotePanorama(
        asset.uploadKey,
        asset.storageKey,
        asset.size,
      );
      const ready = await tx.panoramaAsset.update({
        where: { id, organizationId: actor.organizationId },
        data: { ...metadata, status: "READY" },
      });
      await removeTemporaryPanorama(asset.uploadKey).catch(() => undefined);
      return ready;
    },
    120000,
  );
}

export async function removePanorama(actor: Actor, id: string) {
  idSchema.parse(id);
  return withTenant(
    actor,
    "property:update",
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PanoramaAsset" WHERE id=${id}::uuid AND "organizationId"=${actor.organizationId}::uuid FOR UPDATE`;
      const asset = await tx.panoramaAsset.findFirst({
        where: { id, organizationId: actor.organizationId },
        include: { tour: true },
      });
      if (!asset) throw new DomainError("NOT_FOUND", "Arquivo não encontrado.");
      await tx.$queryRaw`SELECT id FROM "Tour" WHERE id=${asset.tourId}::uuid FOR UPDATE`;
      const tour = await tx.tour.findUniqueOrThrow({
        where: { id: asset.tourId },
      });
      const draft = tourDocumentSchema.parse(tour.draft);
      const published = tour.published
        ? tourDocumentSchema.parse(tour.published)
        : null;
      if (
        [...draft.scenes, ...(published?.scenes ?? [])].some(
          (scene) => scene.assetId === id,
        )
      )
        throw new DomainError(
          "CONFLICT",
          "Este panorama está no rascunho ou na última publicação. Remova o ambiente, salve e publique a atualização antes de excluir o arquivo.",
        );
      // Delete storage before releasing the reservation; a failed removal remains retryable.
      await removeTemporaryPanorama(asset.uploadKey);
      await removeTemporaryPanorama(asset.storageKey);
      // Keep a tombstone while a previously issued upload URL may still be valid.
      // Otherwise an old URL could recreate an untracked object after deletion.
      if (Date.now() - asset.createdAt.getTime() < 24 * 60 * 60 * 1000) {
        await tx.panoramaAsset.update({
          where: { id, organizationId: actor.organizationId },
          data: { status: "FAILED" },
        });
      } else
        await tx.panoramaAsset.delete({
          where: { id, organizationId: actor.organizationId },
        });
    },
    30000,
  );
}
