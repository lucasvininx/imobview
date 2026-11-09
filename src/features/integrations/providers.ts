import "server-only";
import { z } from "zod";
import type { GoogleSettings, EmailSettings, WhatsAppSettings } from "./schema";

export class ProviderError extends Error {
  constructor(
    public code: string,
    public retryable = false,
  ) {
    super(code);
  }
}
async function request(url: string, options: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ProviderError("PROVIDER_UNAVAILABLE", true);
  }
  if (!response.ok)
    throw new ProviderError(
      `HTTP_${response.status}`,
      response.status === 429 || response.status >= 500,
    );
  if (response.status === 204) return {};
  return response.json() as Promise<unknown>;
}
export const googleScopes = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
export function googleAuthorization(
  clientId: string,
  redirectUri: string,
  state: string,
  challenge: string,
) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: googleScopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}
export async function exchangeGoogleCode(
  settings: GoogleSettings,
  code: string,
  verifier: string,
  redirectUri: string,
) {
  const tokens = z
    .object({
      access_token: z.string().min(1),
      refresh_token: z.string().min(1),
      scope: z.string(),
    })
    .parse(
      await request("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: settings.clientId,
          client_secret: settings.clientSecret,
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      }),
    );
  if (
    !googleScopes
      .slice(2)
      .every((scope) => tokens.scope.split(" ").includes(scope))
  )
    throw new ProviderError("GOOGLE_SCOPES_MISSING");
  const profile = z
    .object({ sub: z.string(), email: z.email(), email_verified: z.boolean() })
    .parse(
      await request("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }),
    );
  if (!profile.email_verified)
    throw new ProviderError("GOOGLE_EMAIL_UNVERIFIED");
  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    email: profile.email,
    subject: profile.sub,
  };
}
export async function googleAccess(
  settings: GoogleSettings,
  refreshToken: string,
) {
  return z.object({ access_token: z.string().min(1) }).parse(
    await request("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    }),
  ).access_token;
}
export async function googleCalendars(accessToken: string) {
  const calendars: { id: string; summary: string; primary?: boolean }[] = [];
  let pageToken = "";
  for (let page = 0; page < 10; page++) {
    const url = new URL(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    );
    url.search = new URLSearchParams({
      minAccessRole: "writer",
      maxResults: "250",
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    const result = z
      .object({
        items: z
          .array(
            z.object({
              id: z.string(),
              summary: z.string(),
              primary: z.boolean().optional(),
            }),
          )
          .default([]),
        nextPageToken: z.string().optional(),
      })
      .parse(
        await request(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
    calendars.push(...result.items);
    pageToken = result.nextPageToken ?? "";
    if (!pageToken) return calendars;
  }
  throw new ProviderError("GOOGLE_CALENDAR_LIMIT");
}
export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
) {
  try {
    await request(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?sendUpdates=none`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
    );
  } catch (error) {
    if (
      !(error instanceof ProviderError) ||
      !["HTTP_404", "HTTP_410"].includes(error.code)
    )
      throw error;
  }
}
export async function putGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: {
    summary: string;
    description: string;
    location: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
  },
) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...event, id: eventId, status: "confirmed" }),
  };
  let data: unknown;
  try {
    data = await request(`${url}?sendUpdates=none`, options);
  } catch (error) {
    if (!(error instanceof ProviderError) || error.code !== "HTTP_409")
      throw error;
    try {
      data = await request(`${url}/${eventId}?sendUpdates=none`, {
        ...options,
        method: "PATCH",
      });
    } catch (patchError) {
      // Google keeps tombstones for deleted deterministic IDs; revive a cancelled event.
      if (
        !(patchError instanceof ProviderError) ||
        patchError.code !== "HTTP_410"
      )
        throw patchError;
      throw new ProviderError("GOOGLE_EVENT_REMOVED");
    }
  }
  const parsed = z
    .object({ id: z.string(), htmlLink: z.string().optional() })
    .parse(data);
  const link = parsed.htmlLink ? new URL(parsed.htmlLink) : null;
  return {
    providerId: parsed.id,
    url:
      link && ["www.google.com", "calendar.google.com"].includes(link.hostname)
        ? link.toString()
        : "",
  };
}
export async function validateWhatsApp(
  settings: Omit<WhatsAppSettings, "verifyToken">,
) {
  const headers = { Authorization: `Bearer ${settings.accessToken}` };
  const phone = z
    .object({ id: z.string(), display_phone_number: z.string().optional() })
    .parse(
      await request(
        `https://graph.facebook.com/${settings.apiVersion}/${settings.phoneNumberId}?fields=id,display_phone_number`,
        { headers },
      ),
    );
  if (phone.id !== settings.phoneNumberId)
    throw new ProviderError("WHATSAPP_NUMBER_MISMATCH");
  const templates = z
    .object({
      data: z.array(
        z.object({
          name: z.string(),
          status: z.string(),
          language: z.string(),
          components: z.array(
            z
              .object({ type: z.string(), text: z.string().optional() })
              .passthrough(),
          ),
        }),
      ),
    })
    .parse(
      await request(
        `https://graph.facebook.com/${settings.apiVersion}/${settings.businessAccountId}/message_templates?name=${encodeURIComponent(settings.template)}&fields=name,status,language,components`,
        { headers },
      ),
    );
  const template = templates.data.find(
    (item) =>
      item.name === settings.template &&
      item.language === settings.language &&
      item.status === "APPROVED",
  );
  const body =
    template?.components.find((component) => component.type === "BODY")?.text ??
    "";
  const variables = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((match) =>
    Number(match[1]),
  );
  if (
    !template ||
    variables.join(",") !== "1,2,3,4,5" ||
    template.components.some(
      (c) => c.type !== "BODY" && JSON.stringify(c).includes("{{"),
    )
  )
    throw new ProviderError("WHATSAPP_TEMPLATE_INVALID");
  return phone.display_phone_number ?? settings.phoneNumberId;
}
export async function sendWhatsApp(
  settings: WhatsAppSettings,
  phone: string,
  parameters: string[],
) {
  const result = z
    .object({ messages: z.array(z.object({ id: z.string() })).min(1) })
    .parse(
      await request(
        `https://graph.facebook.com/${settings.apiVersion}/${settings.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "template",
            template: {
              name: settings.template,
              language: { code: settings.language },
              components: [
                {
                  type: "body",
                  parameters: parameters.map((text) => ({
                    type: "text",
                    text,
                  })),
                },
              ],
            },
          }),
        },
      ),
    );
  return result.messages[0].id;
}
export async function sendEmail(
  settings: EmailSettings,
  to: string,
  subject: string,
  text: string,
  idempotencyKey: string,
) {
  const result = z.object({ id: z.string() }).parse(
    await request("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: `${settings.fromName.replace(/[<>\r\n]/g, "")} <${settings.fromEmail}>`,
        to: [z.email().parse(to)],
        subject,
        text,
        ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
      }),
    }),
  );
  return result.id;
}
