import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_FLOW_COOKIE,
  googleAuthorizationUrl,
  googleConfiguration,
  makeGoogleFlow,
  secureCookie,
} from "@/lib/auth/google";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== process.env.APP_ORIGIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const config = googleConfiguration();
  if (!config)
    return NextResponse.json({ error: "Sign-in unavailable" }, { status: 503 });
  try {
    if (Number(request.headers.get("content-length") ?? "0") > 2048)
      throw Error("Invalid request");
    const form = await request.formData();
    const invite = form.get("invite") ?? "";
    if (typeof invite !== "string") throw Error("Invalid invitation");
    const { flow, cookie } = makeGoogleFlow(
      invite.trim(),
      process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ?? "",
    );
    const response = NextResponse.redirect(
      googleAuthorizationUrl(config, flow),
      303,
    );
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(GOOGLE_FLOW_COOKIE, cookie, {
      ...secureCookie,
      maxAge: 600,
    });
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=signin", process.env.APP_ORIGIN),
      303,
    );
  }
}
