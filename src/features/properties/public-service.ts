import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
const publicSchema = z.object({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  city: z.string(),
  state: z.string(),
  neighborhood: z.string(),
  priceCents: z.bigint(),
  area: z.number(),
  bedrooms: z.number(),
  bathrooms: z.number(),
  parkingSpaces: z.number(),
  cover: z.string().nullable(),
  organizationName: z.string(),
});
export type PublicProperty = z.infer<typeof publicSchema>;
export async function getPublicProperty(slug: string) {
  if (!/^[a-z0-9-]{1,220}$/.test(slug)) return null;
  const rows = await db.$queryRaw<
    unknown[]
  >`SELECT * FROM public.get_published_property(${slug})`;
  return rows[0] ? publicSchema.parse(rows[0]) : null;
}
