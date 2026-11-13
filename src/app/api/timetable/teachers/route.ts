import { NextRequest, NextResponse } from "next/server";
import { publicRuzJson } from "@/server/schedule/ruz-public-json";
import { requestedWeek, addDays, validDay } from "@/lib/schedule/ruz";
import { z } from "zod";
const str = z.string().max(1000),
  time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const schema = z.object({
  week: z.object({ date_start: str, date_end: str }),
  days: z
    .array(
      z.object({
        date: str,
        lessons: z
          .array(
            z.object({
              subject: str,
              time_start: time,
              time_end: time,
              typeObj: z.object({ abbr: str }).nullish(),
              teachers: z
                .array(z.object({ id: z.number().int(), full_name: str }))
                .max(30),
              groups: z.array(z.object({ name: str })).max(100),
              auditories: z
                .array(
                  z.object({
                    name: str,
                    building: z
                      .object({ abbr: str.optional(), name: str })
                      .nullish(),
                  }),
                )
                .max(30),
            }),
          )
          .max(40),
      }),
    )
    .max(7),
});
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      const q = (req.nextUrl.searchParams.get("q") || "").trim();
      if (q.length < 3 || q.length > 80)
        return NextResponse.json(
          { error: "Введите минимум три символа" },
          { status: 400 },
        );
      const raw = await publicRuzJson(
        "search/teachers?q=" + encodeURIComponent(q),
      );
      const rows = z
        .object({
          teachers: z
            .array(
              z.object({ id: z.number().int().positive(), full_name: str }),
            )
            .max(1000),
        })
        .parse(raw);
      return NextResponse.json(rows.teachers.slice(0, 30));
    }
    if (!/^\d{1,7}$/.test(id))
      return NextResponse.json(
        { error: "Преподаватель недоступен" },
        { status: 400 },
      );
    const week = requestedWeek(
        req.nextUrl.searchParams.get("week") || undefined,
      ),
      raw = schema.parse(
        await publicRuzJson(`teachers/${id}/scheduler?date=${week}`),
      );
    if (
      raw.week.date_start.replaceAll(".", "-") !== week ||
      raw.week.date_end.replaceAll(".", "-") !== addDays(week, 6)
    )
      throw Error();
    const days = raw.days.map((d) => {
      if (!validDay(d.date) || d.date < week || d.date > addDays(week, 6))
        throw Error();
      return {
        date: d.date,
        lessons: d.lessons.map((l) => {
          if (
            !l.teachers.some((t) => t.id === Number(id)) ||
            l.time_start >= l.time_end
          )
            throw Error();
          return {
            subject: l.subject,
            start: l.time_start,
            end: l.time_end,
            type: l.typeObj?.abbr || "Занятие",
            teachers: l.teachers.map((t) => t.full_name),
            rooms: l.auditories.map((a) =>
              [a.building?.abbr || a.building?.name, a.name]
                .filter(Boolean)
                .join(" · "),
            ),
            note: l.groups.map((g) => g.name).join(", "),
          };
        }),
      };
    });
    return NextResponse.json(
      { state: "FRESH", fetchedAt: new Date(), data: { days } },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Расписание преподавателя недоступно" },
      { status: 503 },
    );
  }
}
