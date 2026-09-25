import sharp from "sharp";
// User-authorized deterministic extraction: bright white pixels are the logo;
// all source background pixels are substantially darker and green-tinted.
const { data, info } = await sharp("public/brand/imobview-original.png")
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const luminance = Math.min(data[i], data[i + 1], data[i + 2]);
  data[i + 3] = Math.round(
    Math.max(0, Math.min(1, (luminance - 100) / 140)) * 255,
  );
  data[i] = data[i + 1] = data[i + 2] = 248;
}
await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim()
  .png()
  .toFile("public/brand/imobview-logo.png");
