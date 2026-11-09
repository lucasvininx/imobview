import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { signPanoramas } from "@/server/supabase/storage";
import { interpretSearch, searchSchema, type SearchInput } from "./search";

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
  isDemo: z.boolean(),
});
export type Listing = z.infer<typeof listingSchema> & { image: string | null };
export async function searchMarketplace(
  input: SearchInput,
  imageLimit?: number,
) {
  const filters = interpretSearch(searchSchema.parse(input));
  const [row] = await db.$queryRaw<
    { result: unknown }[]
  >`SELECT public.search_published_properties(${JSON.stringify(filters)}::jsonb) AS result`;
  const result = z
    .object({ total: z.number(), items: z.array(listingSchema) })
    .parse(row.result);
  const items = result.items.slice(0, imageLimit);
  const keys = items.flatMap((item) => (item.photoKey ? [item.photoKey] : []));
  const urls = keys.length
    ? await signPanoramas(keys)
    : new Map<string, string>();
  return {
    total: result.total,
    engine: "local" as const,
    filters,
    items: items.map((item) => ({
      ...item,
      image: (item.photoKey ? urls.get(item.photoKey) : null) ?? item.cover,
    })),
  };
}
