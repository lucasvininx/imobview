import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { signPanoramas } from "@/server/supabase/storage";
import { tourDocumentSchema, type TourDocument } from "./schema";
import type { FloorPlanView, TourSceneView } from "./viewer-types";
// Signs every referenced image in one request; missing objects are dropped instead of breaking the tour.
export async function tourMedia(
  document: TourDocument,
  assets: { id: string; storageKey: string }[],
): Promise<{ scenes: TourSceneView[]; floorPlans: FloorPlanView[] }> {
  const keyOf = (assetId: string) =>
    assets.find((asset) => asset.id === assetId)?.storageKey;
  const keys = [
    ...document.scenes.map((scene) => keyOf(scene.assetId)),
    ...document.floorPlans.map((plan) => keyOf(plan.assetId)),
  ].filter((key): key is string => !!key);
  const urls = await signPanoramas(keys);
  const urlOf = (assetId: string) => {
    const key = keyOf(assetId);
    return key ? urls.get(key) : undefined;
  };
  const floorPlans = document.floorPlans.flatMap((plan) => {
    const url = urlOf(plan.assetId);
    return url ? [{ ...plan, url }] : [];
  });
  const planIds = new Set(floorPlans.map((plan) => plan.id));
  const scenes = document.scenes.flatMap((scene) => {
    const panoramaUrl = urlOf(scene.assetId);
    if (!panoramaUrl) return [];
    const planPosition =
      scene.planPosition && planIds.has(scene.planPosition.planId)
        ? scene.planPosition
        : null;
    return [{ ...scene, planPosition, panoramaUrl }];
  });
  return { scenes, floorPlans };
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
        ...(await tourMedia(tour.document, tour.assets)),
      };
    }),
  );
}
