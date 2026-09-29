import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { signPanoramas } from "@/server/supabase/storage";
import { tourDocumentSchema, type TourDocument } from "./schema";
import type { TourSceneView } from "./viewer-types";
export async function sceneViews(
  document: TourDocument,
  assets: { id: string; storageKey: string }[],
): Promise<TourSceneView[]> {
  const keys = document.scenes
    .map(
      (scene) => assets.find((asset) => asset.id === scene.assetId)?.storageKey,
    )
    .filter((key): key is string => !!key);
  const urls = await signPanoramas(keys);
  return document.scenes.flatMap((scene) => {
    const key = assets.find((asset) => asset.id === scene.assetId)?.storageKey;
    const panoramaUrl = key ? urls.get(key) : undefined;
    return panoramaUrl ? [{ ...scene, panoramaUrl }] : [];
  });
}
const publicTourSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  document: tourDocumentSchema,
  assets: z.array(z.object({ id: z.uuid(), storageKey: z.string() })),
});
export async function publicTours(slug: string) {
  if (!/^[a-z0-9-]{1,220}$/.test(slug)) return [];
  const rows = await db.$queryRaw<
    unknown[]
  >`SELECT * FROM public.get_published_tours(${slug})`;
  return Promise.all(
    rows.map(async (row) => {
      const tour = publicTourSchema.parse(row);
      return {
        id: tour.id,
        title: tour.title,
        initialSceneId: tour.document.initialSceneId,
        scenes: await sceneViews(tour.document, tour.assets),
      };
    }),
  );
}
