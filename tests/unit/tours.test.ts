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
    })),
  };
}
describe("Tour publication and external input", () => {
  it("rejects empty tours and disconnected rooms", () => {
    expect(
      publicationIssues({ initialSceneId: null, scenes: [] }),
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
