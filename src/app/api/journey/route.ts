import { recordEvent } from "@/features/leads/public-service";
import { readEnv } from "@/config/env";
import { journeyOriginAllowed } from "@/features/leads/origin";
export async function POST(request: Request) {
  if (
    !journeyOriginAllowed(
      request.headers.get("origin"),
      request.url,
      readEnv().NEXT_PUBLIC_APP_URL,
      process.env.NODE_ENV === "development",
    )
  )
    return new Response(null, { status: 403 });
  // Stream with a hard cap; do not trust Content-Length on public endpoints.
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2048) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    chunks.push(value);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      !body ||
      typeof body !== "object" ||
      !("token" in body) ||
      !("event" in body)
    )
      return new Response(null, { status: 400 });
    const ok = await recordEvent(body.token, body.event);
    return Response.json(
      { ok },
      { status: ok ? 200 : 409, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
