import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  publicationIssues,
  tourDocumentSchema,
  uploadSchema,
  MAX_PANORAMA_BYTES,
  type TourDocument,
} from "@/features/tours/schema";
const first = randomUUID(),
  second = randomUUID();
function document(): TourDocument {
  return {
    initialSceneId: first,
    scenes: [first, second].map((id) => ({
      id,
      assetId: randomUUID(),
      title: "Ambiente",
      initialYaw: 0,
      initialPitch: 0,
      hotspots: [],
      planPosition: null,
      infoPoints: [],
    })),
    floorPlans: [],
  };
}
describe("Tour publication and external input", () => {
  it("rejects empty tours and disconnected rooms", () => {
    expect(
      publicationIssues({ initialSceneId: null, scenes: [], floorPlans: [] }),
    ).toHaveLength(1);
    expect(publicationIssues(document())).toHaveLength(1);
  });
  it("accepts a connected graph with cycles", () => {
    const doc = document();
    doc.scenes[0].hotspots.push({
      id: randomUUID(),
      targetSceneId: second,
      label: "Quarto",
      yaw: 1,
      pitch: 0,
    });
    doc.scenes[1].hotspots.push({
      id: randomUUID(),
      targetSceneId: first,
      label: "Sala",
      yaw: -1,
      pitch: 0,
    });
    expect(tourDocumentSchema.safeParse(doc).success).toBe(true);
    expect(publicationIssues(doc)).toEqual([]);
  });
  it("rejects foreign destinations, repeated scenes and nonfinite positions", () => {
    const doc = document();
    doc.scenes[0].hotspots.push({
      id: randomUUID(),
      targetSceneId: randomUUID(),
      label: "Outro",
      yaw: 0,
      pitch: 0,
    });
    expect(tourDocumentSchema.safeParse(doc).success).toBe(false);
    doc.scenes[0].hotspots = [];
    doc.scenes.push(doc.scenes[0]);
    expect(tourDocumentSchema.safeParse(doc).success).toBe(false);
    doc.scenes.pop();
    doc.scenes[0].initialYaw = Infinity;
    expect(tourDocumentSchema.safeParse(doc).success).toBe(false);
  });
  it("parses tours saved before floor plans existed", () => {
    const legacy = {
      initialSceneId: first,
      scenes: document().scenes.map((scene) => ({
        id: scene.id,
        assetId: scene.assetId,
        title: scene.title,
        initialYaw: 0,
        initialPitch: 0,
        hotspots: [],
      })),
    };
    const parsed = tourDocumentSchema.parse(legacy);
    expect(parsed.floorPlans).toEqual([]);
    expect(parsed.scenes[0].planPosition).toBeNull();
    expect(parsed.scenes[0].infoPoints).toEqual([]);
  });
  it("places rooms only on plans of this tour and keeps plan images distinct", () => {
    const doc = document();
    const plan = { id: randomUUID(), assetId: randomUUID(), title: "Térreo" };
    doc.floorPlans.push(plan);
    doc.scenes[0].planPosition = { planId: plan.id, x: 0.25, y: 0.75 };
    expect(tourDocumentSchema.safeParse(doc).success).toBe(true);
    doc.scenes[0].planPosition = { planId: randomUUID(), x: 0.25, y: 0.75 };
    expect(tourDocumentSchema.safeParse(doc).success).toBe(false);
    doc.scenes[0].planPosition = { planId: plan.id, x: 1.5, y: 0 };
    expect(tourDocumentSchema.safeParse(doc).success).toBe(false);
    doc.scenes[0].planPosition = null;
    doc.floorPlans[0] = { ...plan, assetId: doc.scenes[1].assetId };
    expect(tourDocumentSchema.safeParse(doc).success).toBe(false);
  });
  it("accepts information points with bounded text and unique ids", () => {
    const doc = document();
    const point = {
      id: randomUUID(),
      title: "Piso em porcelanato",
      text: "Antiderrapante, 60 × 60 cm.",
      yaw: 1,
      pitch: -0.2,
    };
    doc.scenes[0].infoPoints.push(point);
    expect(tourDocumentSchema.safeParse(doc).success).toBe(true);
    doc.scenes[0].infoPoints.push(point);
    expect(tourDocumentSchema.safeParse(doc).success).toBe(false);
    doc.scenes[0].infoPoints = [{ ...point, title: "x".repeat(61) }];
    expect(tourDocumentSchema.safeParse(doc).success).toBe(false);
    doc.scenes[0].infoPoints = [{ ...point, text: "x".repeat(281) }];
    expect(tourDocumentSchema.safeParse(doc).success).toBe(false);
    doc.scenes[0].infoPoints = [{ ...point, title: " " }];
    expect(tourDocumentSchema.safeParse(doc).success).toBe(false);
  });
  it("defaults uploads to panoramas and accepts floor plans explicitly", () => {
    const input = {
      tourId: randomUUID(),
      fileName: "planta.png",
      size: 1024,
      mimeType: "image/png",
    };
    expect(uploadSchema.parse(input).kind).toBe("PANORAMA");
    expect(uploadSchema.parse({ ...input, kind: "FLOOR_PLAN" }).kind).toBe(
      "FLOOR_PLAN",
    );
    expect(uploadSchema.safeParse({ ...input, kind: "VIDEO" }).success).toBe(
      false,
    );
  });
  it("rejects oversize, empty and non-image uploads", () => {
    const input = {
      tourId: randomUUID(),
      fileName: "sala.jpg",
      size: 1024,
      mimeType: "image/jpeg",
    };
    expect(uploadSchema.safeParse(input).success).toBe(true);
    for (const change of [
      { size: MAX_PANORAMA_BYTES + 1 },
      { size: 0 },
      { mimeType: "image/svg+xml" },
    ]) {
      expect(uploadSchema.safeParse({ ...input, ...change }).success).toBe(
        false,
      );
    }
  });
});
