import type { TourDocument } from "./schema";
export type TourSceneView = TourDocument["scenes"][number] & {
  panoramaUrl: string;
};
export type FloorPlanView = TourDocument["floorPlans"][number] & {
  url: string;
};
export type TourView = {
  id: string;
  title: string;
  initialSceneId: string | null;
  scenes: TourSceneView[];
  floorPlans: FloorPlanView[];
};
