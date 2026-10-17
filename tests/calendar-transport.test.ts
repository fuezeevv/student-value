import { describe, it, expect, vi, afterEach } from "vitest";
import {
  googleCalendarTransport,
  CalendarProviderError,
  exchangeCalendarConsent,
  type CalendarEventBody,
} from "../src/server/calendar/google-transport";
const body: CalendarEventBody = {
  summary: "[TEST] work",
  description: "[TEST] exact date",
  start: { date: "2026-11-20" },
  end: { date: "2026-11-21" },
  reminders: {
    useDefault: false,
    overrides: [{ method: "popup", minutes: 1440 }],
  },
  status: "confirmed",
  visibility: "private",
  transparency: "transparent",
  source: {
    url: "https://studentvalue1984.eu.cc/tasks/test",
    title: "Student Value",
  },
  extendedProperties: {
    private: { studentValueTask: "test", studentValueGroup: "test-group" },
  },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const response = (status: number, value = {}) =>
  new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("Real Calendar HTTP transport boundaries (mock wire only)", () => {
  it("upserts the same explicit event id after a lost insert response without creating a new id", async () => {
    const requests: { url: string; method: string; body: any }[] = [];
    const replies = [
      response(404),
      response(409),
      response(200, { id: "sv12345" }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        requests.push({
          url,
          method: String(init.method),
          body: JSON.parse(String(init.body)),
        });
        return replies.shift()!;
      }),
    );
    await googleCalendarTransport.putEvent(
      "[TEST] secret access",
      "isolated@group.calendar.google.com",
      "sv12345",
      body,
    );
    expect(requests.map((r) => r.method)).toEqual(["PUT", "POST", "PUT"]);
    expect(requests[1].body.id).toBe("sv12345");
    expect(
      requests.every((r) =>
        r.url.startsWith(
          "https://www.googleapis.com/calendar/v3/calendars/isolated%40group.calendar.google.com/",
        ),
      ),
    ).toBe(true);
    expect(requests.every((r) => r.url.includes("sendUpdates=none"))).toBe(
      true,
    );
    expect(requests[0].body.reminders.useDefault).toBe(false);
    expect(requests[0].body.attendees).toBeUndefined();
  });
  it("treats a missing deleted event as idempotent but never reports a temporary Google failure as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(410)),
    );
    await expect(
      googleCalendarTransport.removeEvent(
        "[TEST] access",
        "app-calendar",
        "event",
      ),
    ).resolves.toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response(503, {
          error: { message: "[TEST] PRIVATE_PROVIDER_RESPONSE" },
        }),
      ),
    );
    const error = await googleCalendarTransport
      .putEvent("[TEST] access", "app-calendar", "event", body)
      .catch((e) => e);
    expect(error).toBeInstanceOf(CalendarProviderError);
    expect(error.code).toBe("TEMPORARY");
    expect(String(error)).not.toContain("PRIVATE_PROVIDER_RESPONSE");
  });
  it("distinguishes disabled API from revoked refresh consent and sends tokens only to fixed Google HTTPS endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response(403, {
          error: { errors: [{ reason: "accessNotConfigured" }] },
        }),
      ),
    );
    await expect(
      googleCalendarTransport.createCalendar("[TEST] token", "marker"),
    ).rejects.toMatchObject({ code: "API_DISABLED" });
    vi.stubEnv("APP_ORIGIN", "https://studentvalue1984.eu.cc");
    vi.stubEnv("GOOGLE_CLIENT_ID", "12345-test.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "[TEST] client secret only");
    const calls: any[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: String(init.body) });
        return response(400, { error: "invalid_grant" });
      }),
    );
    await expect(
      googleCalendarTransport.refresh("[TEST] refresh token"),
    ).rejects.toMatchObject({ code: "REAUTH_REQUIRED" });
    expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
    expect(new URLSearchParams(calls[0].body).get("grant_type")).toBe(
      "refresh_token",
    );
  });
  it("rejects a partially granted scope before identity exchange or credential persistence", async () => {
    vi.stubEnv("APP_ORIGIN", "https://studentvalue1984.eu.cc");
    vi.stubEnv("GOOGLE_CLIENT_ID", "12345-test.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "[TEST] client secret only");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response(200, {
          scope: "openid email profile",
          id_token: "never-verified-with-missing-calendar-scope",
          access_token: "[TEST] token",
          token_type: "Bearer",
        }),
      ),
    );
    await expect(
      exchangeCalendarConsent("[TEST] code", {
        userId: "test",
        state: "state",
        nonce: "nonce",
        verifier: "verifier",
        expires: Date.now() + 1000,
      }),
    ).rejects.toMatchObject({ code: "SCOPE_NOT_GRANTED" });
  });
});
