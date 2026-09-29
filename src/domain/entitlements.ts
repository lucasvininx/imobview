import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "./errors";

export const uploadReservationBytes = 40 * 1024 * 1024;
export const maxToursPerProperty = 10;
export const maxAssetsPerTour = 40;
export const maxPhotosPerProperty = 20;

// Serialize reservations per organization to prevent concurrent uploads exceeding quotas.
export async function organizationUsage(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId}::uuid FOR UPDATE`;
  const organization = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  const properties = await tx.property.count({
    where: { organizationId, status: { not: "ARCHIVED" } },
  });
  const panoramas = await tx.panoramaAsset.count({ where: { organizationId } });
  const photos = await tx.propertyPhoto.count({ where: { organizationId } });
  const reservedBytes =
    BigInt(panoramas + photos) * BigInt(uploadReservationBytes);
  return { organization, properties, panoramas, photos, reservedBytes };
}

export async function reserveUpload(
  tx: Prisma.TransactionClient,
  organizationId: string,
  panorama: boolean,
) {
  const usage = await organizationUsage(tx, organizationId);
  if (panorama && usage.panoramas >= usage.organization.maxPanoramas)
    throw new DomainError(
      "CONFLICT",
      "Limite de panoramas da organização atingido. Remova arquivos sem uso ou solicite ajuste do plano.",
    );
  if (
    usage.reservedBytes + BigInt(uploadReservationBytes) >
    usage.organization.maxStorageBytes
  )
    throw new DomainError(
      "CONFLICT",
      "Limite de armazenamento reservado atingido. Remova arquivos sem uso ou solicite ajuste do plano.",
    );
}
