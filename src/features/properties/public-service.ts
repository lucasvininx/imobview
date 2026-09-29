import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { signPanoramas } from "@/server/supabase/storage";
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
  contactEmail: z.string().default(""),
  whatsapp: z.string().default(""),
  photos: z.array(z.string()).default([]),
});
export type PublicProperty = z.infer<typeof publicSchema>;
export async function getPublicProperty(slug: string) {
  if (!/^[a-z0-9-]{1,220}$/.test(slug)) return null;
  const rows = await db.$queryRaw<
    unknown[]
  >`SELECT * FROM public.get_published_property(${slug})`;
  if (!rows[0]) return null;
  const [extra] = await db.$queryRaw<
    unknown[]
  >`SELECT * FROM public.get_property_presentation(${slug})`;
  if (!extra) return null;
  const presentation = z
    .object({
      contactEmail: z.string(),
      whatsapp: z.string(),
      photos: z.array(z.object({ id: z.uuid(), storageKey: z.string() })),
    })
    .parse(extra);
  const urls = await signPanoramas(
    presentation.photos.map((photo) => photo.storageKey),
  );
  return {
    ...publicSchema.parse(rows[0]),
    contactEmail: presentation.contactEmail,
    whatsapp: presentation.whatsapp,
    photos: [...urls.values()],
  };
}
