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
  captureLeads: z.boolean().default(false),
  internalCode: z.string().default(""),
  condominium: z.string().default(""),
  suites: z.number().default(0),
  forSale: z.boolean().default(false),
  financingRateBps: z.number().default(1150),
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
  const [settings] = await db.$queryRaw<
    {
      captureLeads: boolean;
      internalCode: string;
      condominium: string;
      suites: number;
    }[]
  >`SELECT * FROM public.get_journey_settings(${slug})`;
  const [financing] = await db.$queryRaw<
    { purpose: string; priceCents: bigint; financingRateBps: number }[]
  >`SELECT * FROM public.get_financing_settings(${slug})`;
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
    captureLeads: settings?.captureLeads ?? false,
    internalCode: settings?.internalCode ?? "",
    condominium: settings?.condominium ?? "",
    suites: settings?.suites ?? 0,
    forSale:
      financing?.purpose === "SALE" &&
      (financing?.priceCents ?? BigInt(0)) > BigInt(0),
    financingRateBps: financing?.financingRateBps ?? 1150,
    contactEmail: presentation.contactEmail,
    whatsapp: presentation.whatsapp,
    photos: [...urls.values()],
  };
}
