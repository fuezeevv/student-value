import { NextRequest, NextResponse } from "next/server";
import {
  APP_GROUP_CODE,
  GOOGLE_FLOW_COOKIE,
  SESSION_COOKIE,
  exchangeGoogleCode,
  googleConfiguration,
  readGoogleFlow,
  secureCookie,
} from "@/lib/auth/google";
import { completeGoogleLogin } from "@/server/domain/google-login";
import { prisma } from "@/lib/db/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
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
    const group = await prisma.studyGroup.findUnique({
      where: { code: APP_GROUP_CODE },
      select: { id: true },
    });
    if (!group) throw Error("Enrollment unavailable");
    const session = await completeGoogleLogin(identity, group.id, flow.invite);
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
