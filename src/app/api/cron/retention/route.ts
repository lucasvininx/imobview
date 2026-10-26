import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { reportError } from "@/server/logger";
export const dynamic = "force-dynamic";
// Vercel Cron sends "Authorization: Bearer $CRON_SECRET". Without
// JOURNEY_RETENTION_ENABLED=true the job only reports what would be removed.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    secret.length < 32 ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    return new Response(null, { status: 401 });
  const apply = process.env.JOURNEY_RETENTION_ENABLED === "true";
  try {
    const [result] = await db.$queryRaw<
      { visits: bigint; leads: bigint; devices: bigint }[]
    >`SELECT * FROM public.purge_journey_data(${apply})`;
    return Response.json(
      {
        applied: apply,
        visits: Number(result.visits),
        leads: Number(result.leads),
        devices: Number(result.devices),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    await reportError("retention.failed", error);
    return Response.json(
      { applied: false },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
