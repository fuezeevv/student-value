import { googleConfiguration, verifyGoogleIdentity } from "@/lib/auth/google";
import { CALENDAR_SCOPE, type CalendarFlow } from "./crypto";
export class CalendarProviderError extends Error {
  constructor(
    public code: string,
    public status = 0,
  ) {
    super("Calendar provider request failed");
    this.name = "CalendarProviderError";
  }
}
const accessTokenSchema = (body: any) => {
  if (
    typeof body.access_token !== "string" ||
    body.access_token.length > 20000 ||
    body.token_type?.toLowerCase() !== "bearer"
  )
    throw new CalendarProviderError("INVALID_TOKEN_RESPONSE");
  return body.access_token as string;
};
async function tokenRequest(body: URLSearchParams) {
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new CalendarProviderError("TEMPORARY");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new CalendarProviderError(
      data.error === "invalid_grant" ? "REAUTH_REQUIRED" : "TEMPORARY",
      response.status,
    );
  return data;
}
export async function exchangeCalendarConsent(
  code: string,
  flow: CalendarFlow,
) {
  const config = googleConfiguration();
  if (!config) throw new CalendarProviderError("NOT_CONFIGURED");
  const data = await tokenRequest(
    new URLSearchParams({
      client_id: config.id,
      client_secret: config.secret,
      code,
      code_verifier: flow.verifier,
      redirect_uri: config.callback,
      grant_type: "authorization_code",
    }),
  );
  if (
    typeof data.id_token !== "string" ||
    !String(data.scope ?? "")
      .split(" ")
      .includes(CALENDAR_SCOPE)
  )
    throw new CalendarProviderError("SCOPE_NOT_GRANTED");
  const identity = await verifyGoogleIdentity(
    data.id_token,
    config.id,
    flow.nonce,
  );
  const accessToken = accessTokenSchema(data);
  const refreshToken =
    typeof data.refresh_token === "string" && data.refresh_token.length <= 20000
      ? data.refresh_token
      : null;
  return { identity, accessToken, refreshToken };
}
export interface CalendarTransport {
  refresh(refreshToken: string): Promise<string>;
  checkCalendar(
    accessToken: string,
    calendarId: string,
    marker: string,
  ): Promise<boolean>;
  createCalendar(accessToken: string, marker: string): Promise<string>;
  putEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    body: CalendarEventBody,
  ): Promise<void>;
  removeEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void>;
  muteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void>;
  revoke(refreshToken: string): Promise<void>;
}
export interface CalendarEventBody {
  summary: string;
  description: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  reminders: {
    useDefault: false;
    overrides: { method: "popup"; minutes: number }[];
  };
  status: "confirmed";
  transparency: "transparent";
  visibility: "private";
  source: { url: string; title: string };
  extendedProperties: {
    private: { studentValueTask: string; studentValueGroup: string };
  };
}
async function calendarRequest(
  accessToken: string,
  path: string,
  method = "GET",
  body?: unknown,
) {
  let response: Response;
  try {
    response = await fetch("https://www.googleapis.com/calendar/v3" + path, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new CalendarProviderError("TEMPORARY");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const reasons = JSON.stringify(
      error.error?.errors?.map((e: any) => e.reason) ??
        error.error?.details?.map((e: any) => e.reason) ??
        [],
    );
    const code =
      response.status === 401
        ? "REAUTH_REQUIRED"
        : response.status === 429 ||
            response.status >= 500 ||
            /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|dailyLimitExceeded/i.test(
              reasons,
            )
          ? "TEMPORARY"
          : reasons.includes("accessNotConfigured") ||
              reasons.includes("SERVICE_DISABLED")
            ? "API_DISABLED"
            : response.status === 403
              ? "PERMISSION"
              : response.status === 404
                ? "NOT_FOUND"
                : response.status === 410
                  ? "GONE"
                  : response.status === 409
                    ? "CONFLICT"
                    : "PROVIDER_REJECTED";
    throw new CalendarProviderError(code, response.status);
  }
  if (response.status === 204) return {};
  return response.json();
}
const calendarPath = (id: string) => `/calendars/${encodeURIComponent(id)}`;
export const googleCalendarTransport: CalendarTransport = {
  async checkCalendar(token, id, marker) {
    const data = await calendarRequest(token, calendarPath(id));
    return (
      data.id === id &&
      typeof data.description === "string" &&
      data.description.endsWith(marker)
    );
  },
  async refresh(refreshToken) {
    const config = googleConfiguration();
    if (!config) throw new CalendarProviderError("NOT_CONFIGURED");
    return accessTokenSchema(
      await tokenRequest(
        new URLSearchParams({
          client_id: config.id,
          client_secret: config.secret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      ),
    );
  },
  async createCalendar(token, marker) {
    const data = await calendarRequest(token, "/calendars", "POST", {
      summary: "Student Value 1.984",
      description: `Личные учебные сроки. Изменения вносите в Student Value. ${marker}`,
      timeZone: "Europe/Moscow",
    });
    if (
      typeof data.id !== "string" ||
      data.id === "primary" ||
      data.id.length > 1000
    )
      throw new CalendarProviderError("INVALID_CALENDAR_RESPONSE");
    return data.id;
  },
  async putEvent(token, id, eventId, body) {
    const path = calendarPath(id) + `/events/${eventId}?sendUpdates=none`;
    try {
      await calendarRequest(token, path, "PUT", body);
    } catch (error) {
      if (
        !(error instanceof CalendarProviderError) ||
        !["NOT_FOUND", "GONE"].includes(error.code)
      )
        throw error;
      try {
        await calendarRequest(
          token,
          calendarPath(id) + "/events?sendUpdates=none",
          "POST",
          { ...body, id: eventId },
        );
      } catch (insertError) {
        if (
          !(insertError instanceof CalendarProviderError) ||
          insertError.code !== "CONFLICT"
        )
          throw insertError;
        await calendarRequest(token, path, "PUT", body);
      }
    }
  },
  async removeEvent(token, id, eventId) {
    try {
      await calendarRequest(
        token,
        calendarPath(id) + `/events/${eventId}?sendUpdates=none`,
        "DELETE",
      );
    } catch (error) {
      if (
        !(error instanceof CalendarProviderError) ||
        !["NOT_FOUND", "GONE"].includes(error.code)
      )
        throw error;
    }
  },
  async muteEvent(token, id, eventId) {
    try {
      await calendarRequest(
        token,
        calendarPath(id) + `/events/${eventId}?sendUpdates=none`,
        "PATCH",
        { reminders: { useDefault: false, overrides: [] } },
      );
    } catch (error) {
      if (
        !(error instanceof CalendarProviderError) ||
        !["NOT_FOUND", "GONE"].includes(error.code)
      )
        throw error;
    }
  },
  async revoke(refreshToken) {
    let response;
    try {
      response = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      });
    } catch {
      throw new CalendarProviderError("TEMPORARY");
    }
    if (!response.ok && response.status !== 400)
      throw new CalendarProviderError("TEMPORARY", response.status);
  },
};
