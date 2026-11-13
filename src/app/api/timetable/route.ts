import { loadFacultyGroups } from "@/server/schedule/ruz-catalog";
import { groupParts, comparisonWeek } from "@/lib/schedule/catalog";
import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { loadPublicRuzSchedule } from "@/server/schedule/ruz";
import { publicGroupDefinition } from "@/lib/groups/public-groups";
import { requestedWeek, parseRuzWeek } from "@/lib/schedule/ruz";
import { fetchRuzPayload } from "@/server/schedule/ruz-transport";
const loadAdditional = unstable_cache(
  async (id: number, code: string, week: string, facultyId: number) => {
    const groups = await loadFacultyGroups(facultyId);
    if (!groups.some((g) => g.id === id && g.name === code))
      throw Error("Group missing from official institute catalog");
    const raw = await fetchRuzPayload(
      `https://ruz.spbstu.ru/api/v1/ruz/scheduler/${id}?date=${week}`,
    );
    const data = parseRuzWeek(raw, id, code, week);
    if (data.facultyId !== facultyId) throw Error("Faculty mismatch");
    return {
      state: "FRESH",
      data,
      fetchedAt: new Date().toISOString(),
      weekStart: week,
    };
  },
  ["public-additional-ruz-v2"],
  { revalidate: 600 },
);
export async function GET(request: NextRequest) {
  const rawGroup = request.nextUrl.searchParams.get("group") || "";
  const group = rawGroup.includes("/")
    ? rawGroup
    : rawGroup.replace(/^(\d{7})-/, "$1/");
  let week;
  try {
    week = comparisonWeek(
      request.nextUrl.searchParams.get("week") || undefined,
    );
  } catch {
    return NextResponse.json({ error: "Неделя недоступна" }, { status: 400 });
  }
  const known = publicGroupDefinition(group.replace("/", "-"));
  if (known) {
    let normalWeek = true;
    try {
      requestedWeek(week);
    } catch {
      normalWeek = false;
    }
    if (normalWeek)
      return NextResponse.json(
        await loadPublicRuzSchedule(group.replace("/", "-"), week),
        {
          headers: { "Cache-Control": "no-store" },
        },
      );
  }
  const id = Number(request.nextUrl.searchParams.get("id") || known?.ruzId);
  const faculty = Number(request.nextUrl.searchParams.get("faculty") || "125");
  if (
    !Number.isSafeInteger(faculty) ||
    faculty < 1 ||
    faculty > 99999 ||
    !Number.isSafeInteger(id) ||
    id < 1 ||
    id > 1000000 ||
    !groupParts(group) ||
    process.env.SV_TEST_ISOLATED === "1"
  )
    return NextResponse.json({ error: "Группа недоступна" }, { status: 404 });
  try {
    const code = group;
    return NextResponse.json(await loadAdditional(id, code, week, faculty), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json(
      { state: "UNAVAILABLE", data: null, weekStart: week },
      { status: 503 },
    );
  }
}
