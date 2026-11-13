import { NextRequest, NextResponse } from "next/server";
import { loadFacultyGroups } from "@/server/schedule/ruz-catalog";
export async function GET(req: NextRequest) {
  const value = req.nextUrl.searchParams.get("faculty") || "125";
  if (!/^\d{1,5}$/.test(value))
    return NextResponse.json({ error: "Институт недоступен" }, { status: 400 });
  try {
    return NextResponse.json(await loadFacultyGroups(Number(value)), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json(
      { error: "Каталог РУЗ временно недоступен" },
      { status: 503 },
    );
  }
}
