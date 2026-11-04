import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { signPanoramas } from "@/server/supabase/storage";
import { searchSchema, type SearchInput } from "./search";
import { resolveSearch } from "./ai-search";
import { headers } from "next/headers";
import { createHmac, randomUUID } from "node:crypto";
import { readEnv } from "@/config/env";

const listingSchema = z.object({
  title: z.string(),
  slug: z.string(),
  city: z.string(),
  state: z.string(),
  neighborhood: z.string(),
  priceCents: z.number(),
  area: z.number(),
  bedrooms: z.number(),
  bathrooms: z.number(),
  parkingSpaces: z.number(),
  cover: z.string().nullable(),
  photoKey: z.string().nullable(),
  purpose: z.enum(["SALE", "RENT"]),
  type: z.enum(["HOUSE", "APARTMENT", "LAND", "COMMERCIAL"]),
  organizationName: z.string(),
  hasTour: z.boolean(),
});
export type Listing = z.infer<typeof listingSchema> & { image: string | null };
export async function searchMarketplace(input: SearchInput) {
  const { filters, engine } = await resolveSearch(
    searchSchema.parse(input),
    async () => {
      const h = await headers();
      const address = process.env.VERCEL
        ? (h.get("x-vercel-forwarded-for") ?? "unknown")
        : "local";
      const hash = createHmac("sha256", readEnv().BETTER_AUTH_SECRET)
        .update(address)
        .digest("hex");
      const key = `marketplace-ai:${hash}:${Math.floor(Date.now() / 3600000)}`;
      const [limit] = await db.$queryRaw<
        { count: number }[]
      >`INSERT INTO "RateLimit"(id,key,count,"lastRequest") VALUES(${randomUUID()},${key},1,${Date.now()}) ON CONFLICT(key) DO UPDATE SET count="RateLimit".count+1,"lastRequest"=EXCLUDED."lastRequest" RETURNING count`;
      return limit.count <= 20;
    },
  );
  const [row] = await db.$queryRaw<
    { result: unknown }[]
  >`SELECT public.search_published_properties(${JSON.stringify({ ...filters, demoSlug: process.env.DEMO_PROPERTY_SLUG ?? "" })}::jsonb) AS result`;
  const result = z
    .object({ total: z.number(), items: z.array(listingSchema) })
    .parse(row.result);
  const keys = result.items.flatMap((item) =>
    item.photoKey ? [item.photoKey] : [],
  );
  const urls = keys.length
    ? await signPanoramas(keys)
    : new Map<string, string>();
  return {
    total: result.total,
    engine,
    filters,
    items: result.items.map((item) => ({
      ...item,
      image: (item.photoKey ? urls.get(item.photoKey) : null) ?? item.cover,
    })),
  };
}
