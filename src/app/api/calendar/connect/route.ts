import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { googleConfiguration, secureCookie } from "@/lib/auth/google";
import {
  calendarEnabled,
  makeCalendarFlow,
  CALENDAR_FLOW_COOKIE,
  CALENDAR_SCOPE,
} from "@/server/calendar/crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== process.env.APP_ORIGIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user?.groupId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!calendarEnabled())
    return NextResponse.json(
      { error: "Calendar unavailable" },
      { status: 503 },
    );
  const config = googleConfiguration();
  if (!config)
    return NextResponse.json(
      { error: "Calendar unavailable" },
      { status: 503 },
    );
  const { flow, cookie } = makeCalendarFlow(
    user.id,
    process.env.CALENDAR_TOKEN_KEY!,
  );
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.id,
    redirect_uri: config.callback,
    response_type: "code",
    scope: `openid email profile ${CALENDAR_SCOPE}`,
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256")
      .update(flow.verifier)
      .digest("base64url"),
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent select_account",
  }).toString();
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(CALENDAR_FLOW_COOKIE, cookie, {
    ...secureCookie,
    maxAge: 600,
  });
  return response;
}
