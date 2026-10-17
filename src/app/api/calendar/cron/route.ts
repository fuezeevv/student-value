import { NextRequest, NextResponse } from "next/server";
import { equalSecret } from "@/lib/auth/google";
import { calendarEnabled } from "@/server/calendar/crypto";
import { drainCalendarQueue } from "@/server/calendar/sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (
    secret.length < 32 ||
    !equalSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  if (!calendarEnabled())
    return NextResponse.json(
      { error: "Calendar unavailable" },
      { status: 503 },
    );
  try {
    const attempted = await drainCalendarQueue({
      budgetMs: 240000,
      maxUsers: 100,
    });
    return NextResponse.json(
      { status: "ok", attempted },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
