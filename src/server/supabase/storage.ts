import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizePanorama } from "@/features/tours/normalize-panorama";
import { MAX_PANORAMA_BYTES } from "@/features/tours/schema";
import { DomainError } from "@/domain/errors";
import sharp from "sharp";
const storageEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
  SUPABASE_TOUR_BUCKET: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .default("imobview-tours"),
});
export function storageConfigured() {
  return storageEnv.safeParse(process.env).success;
}
function storage() {
  const parsed = storageEnv.safeParse(process.env);
  if (!parsed.success)
    throw new DomainError(
      "CONFLICT",
      "Conecte o Supabase Storage para enviar panoramas. A configuração ainda não foi concluída.",
    );
  const env = parsed.data;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(env.SUPABASE_TOUR_BUCKET);
}
export async function createPanoramaUpload(key: string) {
  const { data, error } = await storage().createSignedUploadUrl(key, {
    upsert: false,
  });
  if (error)
    throw new DomainError(
      "CONFLICT",
      "Não foi possível autorizar o upload. Confira a configuração do Storage.",
    );
  return data.signedUrl;
}
export async function inspectAndPromotePanorama(
  uploadKey: string,
  storageKey: string,
  expectedSize: number,
) {
  const bucket = storage();
  const { data: info, error: infoError } = await bucket.info(uploadKey);
  if (
    infoError ||
    !info ||
    info.size !== expectedSize ||
    info.size > MAX_PANORAMA_BYTES
  )
    throw new DomainError(
      "VALIDATION",
      "O arquivo enviado possui tamanho diferente do autorizado.",
    );
  const { data, error } = await bucket.download(uploadKey);
  if (error || !data)
    throw new DomainError(
      "VALIDATION",
      "O upload ainda não foi concluído. Tente novamente.",
    );
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length !== expectedSize)
    throw new DomainError("VALIDATION", "Arquivo incompleto.");
  const { clean, width, height } = await normalizePanorama(bytes);
  if (clean.length > MAX_PANORAMA_BYTES)
    throw new DomainError(
      "VALIDATION",
      "Imagem otimizada muito grande. Exporte um JPEG menor.",
    );
  const result = await bucket.upload(storageKey, clean, {
    contentType: "image/jpeg",
    upsert: false,
    cacheControl: "300",
  });
  if (result.error) {
    // A retried finalization may find its immutable object already uploaded.
    const existing = await bucket.download(storageKey);
    if (
      !existing.data ||
      !Buffer.from(await existing.data.arrayBuffer()).equals(clean)
    )
      throw new DomainError(
        "CONFLICT",
        "Não foi possível finalizar o panorama. Tente novamente.",
      );
  }
  return { width, height };
}
export async function removeTemporaryPanorama(key: string) {
  const { error } = await storage().remove([key]);
  if (error)
    throw new DomainError(
      "CONFLICT",
      "Não foi possível remover o arquivo. Tente novamente.",
    );
}
export async function signPanoramas(keys: string[]) {
  if (!keys.length) return new Map<string, string>();
  const { data, error } = await storage().createSignedUrls(keys, 900);
  if (error)
    throw new DomainError(
      "CONFLICT",
      "Não foi possível carregar os panoramas.",
    );
  return new Map(
    data.flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [],
    ),
  );
}

export async function inspectAndPromotePhoto(
  uploadKey: string,
  storageKey: string,
  expectedSize: number,
) {
  const bucket = storage();
  const info = await bucket.info(uploadKey);
  if (
    info.error ||
    info.data?.size !== expectedSize ||
    expectedSize > 10 * 1024 * 1024
  )
    throw new DomainError(
      "VALIDATION",
      "Envie uma foto de até 10 MB e aguarde o upload terminar.",
    );
  const result = await bucket.download(uploadKey);
  if (result.error || !result.data)
    throw new DomainError("VALIDATION", "Upload incompleto. Tente novamente.");
  const bytes = Buffer.from(await result.data.arrayBuffer());
  if (bytes.length !== expectedSize)
    throw new DomainError("VALIDATION", "Arquivo incompleto.");
  let clean: Buffer;
  try {
    const input = sharp(bytes, { limitInputPixels: 34_000_000 });
    const meta = await input.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
      (meta.pages ?? 1) > 1 ||
      !meta.width ||
      !meta.height ||
      Math.min(meta.width, meta.height) < 320
    )
      throw new Error("invalid-image");
    clean = await input
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new DomainError(
      "VALIDATION",
      "Use JPEG, PNG ou WebP estático, com pelo menos 320 px de cada lado e até 34 megapixels.",
    );
  }
  if (clean.length > MAX_PANORAMA_BYTES)
    throw new DomainError("VALIDATION", "Imagem otimizada acima do limite.");
  const uploaded = await bucket.upload(storageKey, clean, {
    contentType: "image/jpeg",
    upsert: false,
    cacheControl: "300",
  });
  if (uploaded.error) {
    const existing = await bucket.download(storageKey);
    if (
      !existing.data ||
      !Buffer.from(await existing.data.arrayBuffer()).equals(clean)
    )
      throw new DomainError(
        "CONFLICT",
        "Não foi possível finalizar a foto. Tente novamente.",
      );
  }
}
