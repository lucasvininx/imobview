import { afterEach, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { resolveSearch } from "@/features/marketplace/ai-search";
import { searchSchema } from "@/features/marketplace/search";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("keeps local search available without provider configuration", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const result = await resolveSearch(
    searchSchema.parse({ q: "casa em Campinas 3 quartos" }),
    async () => true,
  );
  expect(result.engine).toBe("local");
  expect(result.filters.city).toBe("campinas");
  expect(fetcher).not.toHaveBeenCalled();
});
it("validates model output and preserves explicitly selected filters", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
  vi.stubEnv("OPENAI_SEARCH_MODEL", "test-model");
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  purpose: "SALE",
                  type: "HOUSE",
                  city: "Campinas",
                  neighborhood: "Cambuí",
                  bedrooms: 3,
                  bathrooms: 2,
                  parkingSpaces: 4,
                  suites: 0,
                  maxPrice: 600000,
                  tokens: [],
                }),
              },
            ],
          },
        ],
      }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  const result = await resolveSearch(
    searchSchema.parse({
      q: "casa perto do Cambuí na cidade de Campinas",
      purpose: "RENT",
      maxPrice: 5000,
    }),
    async () => true,
  );
  expect(result.engine).toBe("ai");
  expect(result.filters).toMatchObject({
    purpose: "RENT",
    maxPrice: 5000,
    bedrooms: 3,
  });
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.store).toBe(false);
  expect(payload.text.format.strict).toBe(true);
});
it("falls back on provider failures or request limits without broadening criteria", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
  vi.stubEnv("OPENAI_SEARCH_MODEL", "test-model");
  const fetcher = vi.fn().mockRejectedValue(new Error("network failure"));
  vi.stubGlobal("fetch", fetcher);
  const input = searchSchema.parse({ q: "apartamento em Santos 4 quartos" });
  const limited = await resolveSearch(input, async () => false);
  expect(limited.engine).toBe("local");
  expect(fetcher).not.toHaveBeenCalled();
  const failed = await resolveSearch(input, async () => true);
  expect(failed.engine).toBe("local");
  expect(failed.filters.bedrooms).toBe(4);
});
