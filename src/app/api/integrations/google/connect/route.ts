import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireWorkspace } from "@/server/session";
import { readEnv } from "@/config/env";
import { getSettings } from "@/features/integrations/service";
import { googleAuthorization } from "@/features/integrations/providers";
import { seal } from "@/features/integrations/crypto";
import type { GoogleSettings } from "@/features/integrations/schema";

export async function GET() {
  const { actor } = await requireWorkspace();
  const base = readEnv().NEXT_PUBLIC_APP_URL;
  try {
    const settings = await getSettings<GoogleSettings>(actor, "GOOGLE");
    if (!settings?.enabled)
      return NextResponse.redirect(
        new URL("/app/integracoes/google?google=setup", base),
      );
    const state = randomBytes(32).toString("base64url"),
      verifier = randomBytes(48).toString("base64url");
    const redirect = new URL(
      "/api/integrations/google/callback",
      base,
    ).toString();
    const response = NextResponse.redirect(
      googleAuthorization(
        settings.credentials.clientId,
        redirect,
        state,
        createHash("sha256").update(verifier).digest("base64url"),
      ),
    );
    response.cookies.set(
      "imobview.google-oauth",
      seal(
        { ...actor, state, verifier, expires: Date.now() + 600000 },
        "google-oauth",
      ),
      {
        httpOnly: true,
        secure: new URL(base).protocol === "https:",
        sameSite: "lax",
        maxAge: 600,
        path: "/api/integrations/google",
      },
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/app/integracoes/google?google=error", base),
    );
  }
}
