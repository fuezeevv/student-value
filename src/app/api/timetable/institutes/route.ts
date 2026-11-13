import { NextResponse } from "next/server";
import { loadInstitutes } from "@/server/schedule/ruz-catalog";
export async function GET() {
  try {
    return NextResponse.json(await loadInstitutes(), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json(
      { error: "Каталог институтов РУЗ временно недоступен" },
      { status: 503 },
    );
  }
}
