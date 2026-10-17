import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { secureCookie } from "@/lib/auth/google";
import {
  CALENDAR_FLOW_COOKIE,
  calendarEnabled,
  readCalendarFlow,
} from "./crypto";
import { exchangeCalendarConsent } from "./google-transport";
import { attachPersonalCalendar } from "./connections";
import { kickCalendarUpdates } from "./background";
/** Uses the already registered sign-in redirect, but a separately encrypted/session-bound consent cookie. */
export async function calendarConsentCallback(
  request: NextRequest,
): Promise<NextResponse | null> {
  const cookie = request.cookies.get(CALENDAR_FLOW_COOKIE)?.value;
  if (!cookie) return null;
  const user = await getCurrentUser().catch(() => null);
  const params = request.nextUrl.searchParams;
  let flow;
  try {
    if (
      !user?.groupId ||
      !calendarEnabled() ||
      params.getAll("state").length !== 1
    )
      throw Error("Invalid calendar callback");
    flow = readCalendarFlow(
      cookie,
      params.get("state")!,
      user.id,
      process.env.CALENDAR_TOKEN_KEY!,
    );
  } catch {
    return null;
  }
  const response = NextResponse.redirect(
    new URL("/calendar?error=connect", process.env.APP_ORIGIN),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(CALENDAR_FLOW_COOKIE, "", {
    ...secureCookie,
    maxAge: 0,
  });
  try {
    if (
      params.has("error") ||
      params.getAll("code").length !== 1 ||
      !params.get("code") ||
      params.get("code")!.length > 4096
    )
      throw Error("Invalid calendar code");
    const grant = await exchangeCalendarConsent(params.get("code")!, flow);
    await attachPersonalCalendar(
      user!.id,
      grant.identity.sub,
      grant.refreshToken,
    );
    response.headers.set(
      "Location",
      new URL("/calendar?connected=1", process.env.APP_ORIGIN).href,
    );
    kickCalendarUpdates(user!.id);
  } catch {
    /* No provider token, code, email or response is logged. Existing sign-in session stays unchanged. */
  }
  return response;
}
