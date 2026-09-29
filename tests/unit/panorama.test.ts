import { expect, it } from "vitest";
import sharp from "sharp";
import { normalizePanorama } from "@/features/tours/normalize-panorama";
it("decodes a real panorama and strips metadata before promotion", async () => {
  const input = await sharp({
    create: { width: 1024, height: 512, channels: 3, background: "green" },
  })
    .withMetadata()
    .png()
    .toBuffer();
  const result = await normalizePanorama(input);
  const meta = await sharp(result.clean).metadata();
  expect(result.width).toBe(1024);
  expect(meta.format).toBe("jpeg");
  expect(meta.exif).toBeUndefined();
});
it("rejects corrupt files, ordinary photos and undersized panoramas", async () => {
  await expect(
    normalizePanorama(Buffer.from("not an image")),
  ).rejects.toMatchObject({ code: "VALIDATION" });
  for (const [width, height] of [
    [1024, 1024],
    [512, 256],
  ]) {
    const input = await sharp({
      create: { width, height, channels: 3, background: "green" },
    })
      .jpeg()
      .toBuffer();
    await expect(normalizePanorama(input)).rejects.toMatchObject({
      code: "VALIDATION",
    });
  }
});
