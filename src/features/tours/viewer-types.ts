import type { TourDocument } from "./schema";
export type TourSceneView = TourDocument["scenes"][number] & {
  panoramaUrl: string;
};
