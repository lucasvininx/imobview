import { getPublicProperty } from "@/features/properties/public-service";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const property = await getPublicProperty((await params).slug);
  if (!property) return new Response(null, { status: 404 });
  const cover =
    property.photos[0] || property.cover || "/brand/imobview-original.png";
  return new Response(null, {
    status: 307,
    headers: {
      Location: new URL(cover, process.env.NEXT_PUBLIC_APP_URL).href,
      "Cache-Control": "no-store",
    },
  });
}
