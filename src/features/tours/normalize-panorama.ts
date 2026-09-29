import sharp, { type Metadata } from "sharp";
import { DomainError } from "@/domain/errors";
import { MAX_PANORAMA_BYTES } from "./schema";
export async function normalizePanorama(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_PANORAMA_BYTES)
    throw new DomainError("VALIDATION", "Arquivo vazio ou acima do limite.");
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, { limitInputPixels: 34_000_000 }).metadata();
  } catch {
    throw new DomainError(
      "VALIDATION",
      "Imagem corrompida ou formato inválido.",
    );
  }
  const { width, height, format } = metadata;
  if (
    !width ||
    !height ||
    width !== height * 2 ||
    width < 1024 ||
    width > 8192 ||
    !["jpeg", "png", "webp"].includes(format ?? "") ||
    (metadata.pages ?? 1) > 1
  )
    throw new DomainError(
      "VALIDATION",
      "Use panorama 360° equiretangular 2:1, entre 1024 e 8192 pixels de largura, em JPEG, PNG ou WebP estático.",
    );
  // Decode and re-encode to validate all pixels, discard metadata and make the
  // final object immutable. The upload token can never overwrite this path.
  const clean = await sharp(bytes, { limitInputPixels: 34_000_000 })
    .jpeg({ quality: 90 })
    .toBuffer();
  return { clean, width, height };
}
