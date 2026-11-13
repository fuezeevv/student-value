import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { loadPublicRuzSchedule } from "@/server/schedule/ruz";
import { publicGroupDefinition } from "@/lib/groups/public-groups";
import { requestedWeek, parseRuzWeek } from "@/lib/schedule/ruz";
import { fetchRuzPayload } from "@/server/schedule/ruz-transport";
const loadAdditional = unstable_cache(
  async (id: number, code: string, week: string) => {
    const raw = await fetchRuzPayload(
      `https://ruz.spbstu.ru/api/v1/ruz/scheduler/${id}?date=${week}`,
    );
    const data = parseRuzWeek(raw, id, code, week);
    if (data.facultyId !== 125) throw Error("Faculty mismatch");
    return {
      state: "FRESH",
      data,
      fetchedAt: new Date().toISOString(),
      weekStart: week,
    };
  },
  ["public-additional-ruz-v1"],
  { revalidate: 600 },
);
export async function GET(request: NextRequest) {
  const group = request.nextUrl.searchParams.get("group") || "";
  let week;
  try {
    week = requestedWeek(request.nextUrl.searchParams.get("week") || undefined);
  } catch {
    return NextResponse.json({ error: "Неделя недоступна" }, { status: 400 });
  }
  if (publicGroupDefinition(group))
    return NextResponse.json(await loadPublicRuzSchedule(group, week), {
      headers: { "Cache-Control": "no-store" },
    });
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    id > 1000000 ||
    !/^\d{7}[/-]\d{5}(?:_\d{4})?$/.test(group) ||
    process.env.SV_TEST_ISOLATED === "1"
  )
    return NextResponse.json({ error: "Группа недоступна" }, { status: 404 });
  try {
    const code = group.replace(/^(\d{7})-/, "$1/");
    return NextResponse.json(await loadAdditional(id, code, week), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json(
      { state: "UNAVAILABLE", data: null, weekStart: week },
      { status: 503 },
    );
  }
}
