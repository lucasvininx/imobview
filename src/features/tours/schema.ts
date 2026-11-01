import { z } from "zod";
export const MAX_PANORAMA_BYTES = 20 * 1024 * 1024;
export const MAX_SCENES = 30;
export const MAX_FLOOR_PLANS = 5;
export const positionSchema = z.object({
  yaw: z
    .number()
    .finite()
    .min(-Math.PI * 2)
    .max(Math.PI * 2),
  pitch: z
    .number()
    .finite()
    .min(-Math.PI / 2)
    .max(Math.PI / 2),
});
export const hotspotSchema = positionSchema.extend({
  id: z.uuid(),
  targetSceneId: z.uuid(),
  label: z.string().trim().min(1).max(80),
});
// Clickable "i" with a short description of a feature of the room.
export const infoPointSchema = positionSchema.extend({
  id: z.uuid(),
  title: z.string().trim().min(1).max(60),
  text: z.string().trim().max(280).default(""),
});
export const MAX_INFO_POINTS = 20;
// Marker position as a fraction of the floor plan image (0 = left/top, 1 = right/bottom).
export const planPositionSchema = z.object({
  planId: z.uuid(),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
});
export const sceneSchema = z.object({
  id: z.uuid(),
  assetId: z.uuid(),
  title: z.string().trim().min(1).max(80),
  initialYaw: positionSchema.shape.yaw,
  initialPitch: positionSchema.shape.pitch,
  hotspots: z.array(hotspotSchema).max(50),
  planPosition: planPositionSchema.nullable().default(null),
  infoPoints: z.array(infoPointSchema).max(MAX_INFO_POINTS).default([]),
});
export const floorPlanSchema = z.object({
  id: z.uuid(),
  assetId: z.uuid(),
  title: z.string().trim().min(1).max(40),
});
// Documents saved before floor plans existed parse with an empty list.
export const tourDocumentSchema = z
  .object({
    initialSceneId: z.uuid().nullable(),
    scenes: z.array(sceneSchema).max(MAX_SCENES),
    floorPlans: z.array(floorPlanSchema).max(MAX_FLOOR_PLANS).default([]),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set(doc.scenes.map((scene) => scene.id));
    if (ids.size !== doc.scenes.length)
      ctx.addIssue({ code: "custom", message: "Ambientes duplicados." });
    const planIds = new Set(doc.floorPlans.map((plan) => plan.id));
    if (planIds.size !== doc.floorPlans.length)
      ctx.addIssue({ code: "custom", message: "Plantas duplicadas." });
    const sceneAssets = new Set(doc.scenes.map((scene) => scene.assetId));
    if (doc.floorPlans.some((plan) => sceneAssets.has(plan.assetId)))
      ctx.addIssue({
        code: "custom",
        message: "Uma imagem não pode ser panorama e planta ao mesmo tempo.",
      });
    for (const scene of doc.scenes)
      if (
        new Set(scene.infoPoints.map((point) => point.id)).size !==
        scene.infoPoints.length
      )
        ctx.addIssue({
          code: "custom",
          message: "Pontos de informação duplicados.",
        });
    for (const scene of doc.scenes)
      if (scene.planPosition && !planIds.has(scene.planPosition.planId))
        ctx.addIssue({
          code: "custom",
          message: "O ambiente aponta para uma planta inexistente.",
        });
    if (doc.initialSceneId && !ids.has(doc.initialSceneId))
      ctx.addIssue({ code: "custom", message: "Ambiente inicial inválido." });
    for (const scene of doc.scenes) {
      if (
        new Set(scene.hotspots.map((hotspot) => hotspot.id)).size !==
        scene.hotspots.length
      )
        ctx.addIssue({ code: "custom", message: "Pontos duplicados." });
      for (const hotspot of scene.hotspots)
        if (
          !ids.has(hotspot.targetSceneId) ||
          hotspot.targetSceneId === scene.id
        )
          ctx.addIssue({
            code: "custom",
            message: "O destino deve ser outro ambiente deste tour.",
          });
    }
  });
export type TourDocument = z.infer<typeof tourDocumentSchema>;
export const assetKinds = ["PANORAMA", "FLOOR_PLAN"] as const;
export const uploadSchema = z.object({
  tourId: z.uuid(),
  kind: z.enum(assetKinds).default("PANORAMA"),
  fileName: z.string().min(1).max(160),
  size: z.number().int().positive().max(MAX_PANORAMA_BYTES),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export const saveTourSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  title: z.string().trim().min(2).max(120),
  document: tourDocumentSchema,
});
export function publicationIssues(document: TourDocument): string[] {
  if (!document.scenes.length || !document.initialSceneId)
    return ["Adicione ao menos um panorama e escolha o ambiente inicial."];
  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const link of document.scenes.find((scene) => scene.id === id)
      ?.hotspots ?? [])
      visit(link.targetSceneId);
  };
  visit(document.initialSceneId);
  return reachable.size === document.scenes.length
    ? []
    : [
        "Conecte todos os ambientes a partir do ambiente inicial antes de publicar.",
      ];
}
