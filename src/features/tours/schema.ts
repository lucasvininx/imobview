import { z } from "zod";
export const MAX_PANORAMA_BYTES = 20 * 1024 * 1024;
export const MAX_SCENES = 30;
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
export const sceneSchema = z.object({
  id: z.uuid(),
  assetId: z.uuid(),
  title: z.string().trim().min(1).max(80),
  initialYaw: positionSchema.shape.yaw,
  initialPitch: positionSchema.shape.pitch,
  hotspots: z.array(hotspotSchema).max(50),
});
export const tourDocumentSchema = z
  .object({
    initialSceneId: z.uuid().nullable(),
    scenes: z.array(sceneSchema).max(MAX_SCENES),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set(doc.scenes.map((scene) => scene.id));
    if (ids.size !== doc.scenes.length)
      ctx.addIssue({ code: "custom", message: "Ambientes duplicados." });
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
export const uploadSchema = z.object({
  tourId: z.uuid(),
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
