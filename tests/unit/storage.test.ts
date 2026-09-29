import { expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
const bucket = vi.hoisted(() => ({
  info: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from: () => bucket } }),
}));
import {
  inspectAndPromotePanorama,
  removeTemporaryPanorama,
  inspectAndPromotePhoto,
} from "@/server/supabase/storage";
it("keeps failed storage deletion retryable instead of reporting success", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-only-secret-not-a-real-key");
  bucket.remove.mockResolvedValue({ error: { message: "failure" } });
  try {
    await expect(removeTemporaryPanorama("temporary")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  } finally {
    vi.unstubAllEnvs();
  }
});
it("rejects non-image photo contents despite an authorized MIME type", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-only-secret-not-a-real-key");
  const bytes = Buffer.from("<script>alert(1)</script>");
  bucket.info.mockResolvedValue({ data: { size: bytes.length }, error: null });
  bucket.download.mockResolvedValue({ data: new Blob([bytes]), error: null });
  try {
    await expect(
      inspectAndPromotePhoto("temp", "final", bytes.length),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  } finally {
    vi.unstubAllEnvs();
  }
});
it("validates the Storage info V2 size field, not user metadata", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-only-secret-not-a-real-key");
  const bytes = await sharp({
    create: { width: 1024, height: 512, channels: 3, background: "green" },
  })
    .jpeg()
    .toBuffer();
  bucket.info.mockResolvedValue({
    data: { size: bytes.length, metadata: {} },
    error: null,
  });
  bucket.download.mockResolvedValue({
    data: new Blob([new Uint8Array(bytes)]),
    error: null,
  });
  bucket.upload.mockResolvedValue({ error: null });
  try {
    await expect(
      inspectAndPromotePanorama("temporary", "final", bytes.length),
    ).resolves.toEqual({ width: 1024, height: 512 });
    bucket.info.mockResolvedValue({
      data: { size: bytes.length + 1, metadata: { size: bytes.length } },
      error: null,
    });
    await expect(
      inspectAndPromotePanorama("temporary", "final", bytes.length),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  } finally {
    vi.unstubAllEnvs();
  }
});
