import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/server/session";
import { withTenant } from "@/server/tenant";
import { readEnv } from "@/config/env";
import { calendarContext, getSettings } from "@/features/integrations/service";
import {
  exchangeGoogleCode,
  googleCalendars,
} from "@/features/integrations/providers";
import { seal, unseal } from "@/features/integrations/crypto";
import type { GoogleSettings } from "@/features/integrations/schema";

export async function GET(request: Request) {
  const { actor } = await requireWorkspace();
  const base = readEnv().NEXT_PUBLIC_APP_URL;
  const store = await cookies();
  const pending = store.get("imobview.google-oauth")?.value;
  const finish = (result: string) => {
    const response = NextResponse.redirect(
      new URL(`/app/integracoes?google=${result}`, base),
    );
    response.cookies.set("imobview.google-oauth", "", {
      httpOnly: true,
      secure: new URL(base).protocol === "https:",
      sameSite: "lax",
      maxAge: 0,
      path: "/api/integrations/google",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  try {
    if (!pending) return finish("expired");
    const state = z
      .object({
        organizationId: z.uuid(),
        userId: z.string(),
        state: z.string(),
        verifier: z.string(),
        expires: z.number(),
      })
      .parse(unseal(pending, "google-oauth"));
    const params = new URL(request.url).searchParams;
    const received = Buffer.from(params.get("state") ?? ""),
      expected = Buffer.from(state.state);
    if (
      state.expires < Date.now() ||
      state.organizationId !== actor.organizationId ||
      state.userId !== actor.userId ||
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      return finish("expired");
    if (params.has("error")) return finish("denied");
    const code = z.string().min(1).max(4096).parse(params.get("code"));
    const settings = await getSettings<GoogleSettings>(actor, "GOOGLE");
    if (!settings?.enabled) return finish("setup");
    const token = await exchangeGoogleCode(
      settings.credentials,
      code,
      state.verifier,
      new URL("/api/integrations/google/callback", base).toString(),
    );
    const calendars = await googleCalendars(token.accessToken);
    const primary =
      calendars.find((calendar) => calendar.primary) ?? calendars[0];
    if (!primary) return finish("no-calendar");
    await withTenant(actor, "lead:update", (tx) =>
      tx.calendarConnection.upsert({
        where: { organizationId_userId: actor },
        create: {
          ...actor,
          secret: seal(
            { refreshToken: token.refreshToken, subject: token.subject },
            calendarContext(actor.organizationId, actor.userId),
          ),
          accountEmail: token.email,
          calendarId: primary.id,
          calendarName: primary.summary,
        },
        update: {
          secret: seal(
            { refreshToken: token.refreshToken, subject: token.subject },
            calendarContext(actor.organizationId, actor.userId),
          ),
          accountEmail: token.email,
          calendarId: primary.id,
          calendarName: primary.summary,
          connected: true,
        },
      }),
    );
    return finish("connected");
  } catch {
    return finish("error");
  }
}
