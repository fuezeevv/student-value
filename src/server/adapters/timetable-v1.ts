import { NextRequest, NextResponse } from "next/server";
import { publicGroups } from "@/lib/groups/public-groups";
import { loadPublicRuzSchedule } from "@/server/schedule/ruz";
import {
  requestedWeek,
  weekStartFor,
  validDay,
  addDays,
} from "@/lib/schedule/ruz";
import {
  mobileTimetableSchema,
  type MobileTimetable,
  type MobileLesson,
} from "../../../packages/mobile-contracts/src";

export type GroupResolutionResult =
  | { kind: "OK"; code: string; ruzId: number }
  | { kind: "AMBIGUOUS"; matches: string[] }
  | { kind: "NOT_FOUND" };

export function resolveGroupCode(raw: string): GroupResolutionResult {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "NOT_FOUND" };

  // 1. Exact full code (e.g. "5130901/40102") or slug ("5130901-40102")
  const exact = publicGroups.find(
    (g) => g.code === trimmed || g.code.replace("/", "-") === trimmed,
  );
  if (exact) {
    return { kind: "OK", code: exact.code, ruzId: exact.ruzId };
  }

  // 2. Numeric RUZ ID (e.g. 45591)
  const byRuzId = publicGroups.find((g) => String(g.ruzId) === trimmed);
  if (byRuzId) {
    return { kind: "OK", code: byRuzId.code, ruzId: byRuzId.ruzId };
  }

  // 3. Label shorthand (e.g. "101", "201")
  const matchingLabels = publicGroups.filter((g) => g.label === trimmed);
  if (matchingLabels.length === 1) {
    const single = matchingLabels[0];
    return { kind: "OK", code: single.code, ruzId: single.ruzId };
  }
  if (matchingLabels.length > 1) {
    return {
      kind: "AMBIGUOUS",
      matches: matchingLabels.map((g) => g.code),
    };
  }

  return { kind: "NOT_FOUND" };
}

export function buildDeterministicOccurrenceId(
  groupSlug: string,
  date: string,
  start: string,
  end: string,
  subject: string,
  subgroup?: string | null,
): string {
  const cleanSubject = subject
    .toLowerCase()
    .replace(/[^a-zа-я0-9]/g, "")
    .slice(0, 20);
  const cleanStart = start.replace(":", "");
  const cleanEnd = end.replace(":", "");
  const sub = subgroup ? `-${subgroup.replace(/[^a-zA-Zа-яА-Я0-9]/g, "")}` : "";
  return `occ-${groupSlug}-${date}-${cleanStart}${cleanEnd}-${cleanSubject || "item"}${sub}`;
}

export async function handleTimetableRequest(request: NextRequest) {
  const url = request.nextUrl;
  const rawGroup = url.searchParams.get("group") || "";
  const resolution = resolveGroupCode(rawGroup);

  if (resolution.kind === "NOT_FOUND") {
    return NextResponse.json(
      {
        error: "Группа не найдена в публичном каталоге",
        code: "GROUP_NOT_FOUND",
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (resolution.kind === "AMBIGUOUS") {
    return NextResponse.json(
      {
        error: `Неоднозначный код группы. Укажите полный код: ${resolution.matches.join(", ")}`,
        code: "AMBIGUOUS_GROUP_CODE",
        candidates: resolution.matches,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { code: groupCode, ruzId } = resolution;
  const rawDate = url.searchParams.get("date") || url.searchParams.get("week");
  let weekStart: string;

  try {
    if (rawDate) {
      if (!validDay(rawDate)) {
        return NextResponse.json(
          { error: "Некорректная дата (ожидается YYYY-MM-DD)", code: "INVALID_DATE" },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      weekStart = weekStartFor(rawDate);
    } else {
      weekStart = requestedWeek(undefined);
    }
  } catch {
    return NextResponse.json(
      { error: "Неделя вне допустимого диапазона", code: "OUT_OF_RANGE" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const slug = groupCode.replace("/", "-");

  try {
    const res = await loadPublicRuzSchedule(slug, weekStart);

    if (res.state === "UNAVAILABLE" || res.state === "UNCONFIGURED") {
      const dto: MobileTimetable = {
        schemaVersion: 1,
        group: { code: groupCode, ruzId },
        weekStart,
        state: res.state,
        sourceFetchedAt: null,
        sourceUrl: null,
        data: null,
      };
      const validated = mobileTimetableSchema.parse(dto);
      return NextResponse.json(validated, {
        status: res.state === "UNAVAILABLE" ? 503 : 200,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const days = Array.from({ length: 7 }, (_, i) => {
      const dayDate = addDays(weekStart, i);
      const ruzDay = res.data?.days.find((d) => d.date === dayDate);

      const lessons: MobileLesson[] = (ruzDay?.lessons || []).map((l) => ({
        id: buildDeterministicOccurrenceId(
          slug,
          dayDate,
          l.start,
          l.end,
          l.subject,
          l.note || null,
        ),
        subject: l.subject,
        start: l.start,
        scheduledEnd: l.end,
        type: l.type,
        teachers: l.teachers,
        rooms: l.rooms,
        note: l.note ? l.note.trim() : null,
      }));

      return {
        date: dayDate,
        lessons,
      };
    });

    const dto: MobileTimetable = {
      schemaVersion: 1,
      group: { code: groupCode, ruzId },
      weekStart,
      state: res.state === "STALE" ? "STALE" : "FRESH",
      sourceFetchedAt: res.fetchedAt
        ? new Date(res.fetchedAt).toISOString()
        : new Date().toISOString(),
      sourceUrl: `https://ruz.spbstu.ru/faculty/125/groups/${ruzId}?date=${weekStart}`,
      data: {
        days: days as [
          { date: string; lessons: MobileLesson[] },
          { date: string; lessons: MobileLesson[] },
          { date: string; lessons: MobileLesson[] },
          { date: string; lessons: MobileLesson[] },
          { date: string; lessons: MobileLesson[] },
          { date: string; lessons: MobileLesson[] },
          { date: string; lessons: MobileLesson[] },
        ],
      },
    };

    const validated = mobileTimetableSchema.parse(dto);
    return NextResponse.json(validated, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.name === "ZodError"
        ? "Ошибка валидации схемы расписания на сервере"
        : "Ошибка сервиса расписания";

    return NextResponse.json(
      { error: message, code: "TIMETABLE_ADAPTER_ERROR" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
