import { randomBytes } from "node:crypto";
import { kickCalendarUpdates } from "@/server/calendar/background";
import { calendarConsentCallback } from "@/server/calendar/callback";
import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_FLOW_COOKIE,
  SESSION_COOKIE,
  exchangeGoogleCode,
  googleConfiguration,
  readGoogleFlow,
  secureCookie,
  hashToken,
} from "@/lib/auth/google";
import { isDevAuthEnabled } from "@/lib/auth/dev-policy";
import { prisma } from "@/lib/db/prisma";
import {
  decryptPkceCookie,
  isAllowedRedirectUri,
} from "@/server/adapters/mobile-auth";
import {
  completeGoogleLogin,
  resolveGoogleLoginGroup,
} from "@/server/domain/google-login";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const calendarResponse = await calendarConsentCallback(request);
  if (calendarResponse) return calendarResponse;
  const response = NextResponse.redirect(
    new URL("/login?error=signin", process.env.APP_ORIGIN),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(GOOGLE_FLOW_COOKIE, "", { ...secureCookie, maxAge: 0 });
  try {
    const config = googleConfiguration();
    if (!config) return response;
    const p = request.nextUrl.searchParams;
    if (
      p.has("error") ||
      p.getAll("state").length !== 1 ||
      p.getAll("code").length !== 1
    )
      throw Error("Invalid callback");
    const code = p.get("code")!;
    if (!code || code.length > 4096) throw Error("Invalid code");
    const flow = readGoogleFlow(
      request.cookies.get(GOOGLE_FLOW_COOKIE)?.value ?? "",
      p.get("state")!,
      process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ?? "",
    );
    const identity = await exchangeGoogleCode(code, flow, config);
    const groupId = await resolveGoogleLoginGroup(identity, flow.invite);
    const session = await completeGoogleLogin(identity, groupId, flow.invite);
    kickCalendarUpdates(session.userId);

    const pkceCookieName = isDevAuthEnabled()
      ? "mobile_pkce"
      : "__Host-mobile-pkce";
    const pkceRaw = request.cookies.get(pkceCookieName)?.value;
    if (pkceRaw) {
      const pkce = decryptPkceCookie(pkceRaw);
      if (pkce && isAllowedRedirectUri(pkce.redirectUri)) {
        const exchangeCode = randomBytes(32).toString("base64url");
        await prisma.session.create({
          data: {
            userId: session.userId,
            tokenHash: hashToken(exchangeCode),
            expiresAt: new Date(Date.now() + 60_000), // 60s single-use
            userAgent: `exchange:${pkce.challenge}:${pkce.redirectUri}`,
          },
        });

        const redirectUrl = new URL(pkce.redirectUri);
        redirectUrl.searchParams.set("code", exchangeCode);
        redirectUrl.searchParams.set("state", pkce.state);

        const mobileResponse = NextResponse.redirect(redirectUrl.href, 303);
        mobileResponse.headers.set("Cache-Control", "no-store");
        mobileResponse.headers.set("Referrer-Policy", "no-referrer");
        mobileResponse.cookies.set(pkceCookieName, "", {
          ...secureCookie,
          maxAge: 0,
        });
        return mobileResponse;
      }
    }

    response.cookies.set("__Host-sv-group", groupId, {
      ...secureCookie,
      maxAge: 14 * 86400,
    });
    response.headers.set("Location", new URL("/", process.env.APP_ORIGIN).href);
    response.cookies.set(SESSION_COOKIE, session.token, {
      ...secureCookie,
      expires: session.expiresAt,
    });
  } catch {
    // Never log authorization codes, tokens, invitations, provider responses, or student identity.
  }
  return response;
}
