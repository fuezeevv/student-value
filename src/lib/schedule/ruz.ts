import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";

export const RUZ_ORIGIN = "https://ruz.spbstu.ru";
export const COMMUNITY_URL = "https://t.me/studentvalue";
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
export function validDay(value: string) {
  return (
    dayPattern.test(value) &&
    Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function addDays(day: string, amount: number) {
  if (!validDay(day)) throw Error("Некорректная дата");
  return new Date(Date.parse(day + "T12:00:00Z") + amount * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function moscowDay(now = new Date()) {
  return formatInTimeZone(now, "Europe/Moscow", "yyyy-MM-dd");
}
export function weekStartFor(day: string) {
  if (!validDay(day)) throw Error("Некорректная дата");
  return addDays(day, -((new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7));
}
export function requestedWeek(raw: string | undefined, now = new Date()) {
  const today = moscowDay(now),
    week = raw ? weekStartFor(raw) : weekStartFor(today);
  if (Math.abs(Date.parse(week) - Date.parse(today)) > 183 * 86400000)
    throw Error("Неделя вне доступного периода");
  return week;
}
const text = z.string().trim().max(1000);
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const list = <T extends z.ZodTypeAny>(item: T, max = 100) =>
  z
    .array(item)
    .max(max)
    .nullable()
    .optional()
    .transform((x) => x ?? []);
const responseSchema = z.object({
  week: z.object({ date_start: z.string(), date_end: z.string() }),
  group: z.object({
    id: z.number().int().positive(),
    name: text,
    faculty: z.object({ id: z.number().int().positive() }),
  }),
  days: z
    .array(
      z.object({
        date: z.string(),
        lessons: z
          .array(
            z.object({
              subject: text.min(1),
              time_start: time,
              time_end: time,
              typeObj: z
                .object({ name: text, abbr: text })
                .nullable()
                .optional(),
              additional_info: text.nullable().optional(),
              groups: list(z.object({ id: z.number().int(), name: text })),
              teachers: list(z.object({ full_name: text }), 20),
              auditories: list(
                z.object({
                  name: text,
                  building: z
                    .object({ name: text, abbr: text.optional() })
                    .nullable()
                    .optional(),
                }),
                20,
              ),
              lms_url: z.string().max(2000).nullable().optional(),
            }),
          )
          .max(40),
      }),
    )
    .max(7),
});
export type RuzLesson = {
  subject: string;
  start: string;
  end: string;
  type: string;
  note: string;
  teachers: string[];
  rooms: string[];
  lmsUrl: string | null;
};
export type RuzWeek = {
  version: 1;
  groupId: number;
  groupCode: string;
  facultyId: number;
  weekStart: string;
  days: { date: string; lessons: RuzLesson[] }[];
};
export function safeDlLink(value: string | null | undefined) {
  try {
    const u = new URL(value ?? "");
    const id = u.searchParams.get("id");
    return u.protocol === "https:" &&
      u.hostname === "dl.spbstu.ru" &&
      !u.username &&
      !u.password &&
      /^\d+$/.test(id ?? "") &&
      u.pathname.replace(/\/+/g, "/") === "/course/view.php"
      ? `https://dl.spbstu.ru/course/view.php?id=${id}`
      : null;
  } catch {
    return null;
  }
}
export function parseRuzWeek(
  raw: unknown,
  groupId: number,
  groupCode: string,
  weekStart: string,
): RuzWeek {
  const data = responseSchema.parse(raw);
  if (
    data.group.id !== groupId ||
    data.group.name !== groupCode ||
    data.week.date_start.replaceAll(".", "-") !== weekStart ||
    data.week.date_end.replaceAll(".", "-") !== addDays(weekStart, 6)
  )
    throw Error("RUZ identity/week mismatch");
  const dates = new Set<string>();
  for (const day of data.days) {
    if (
      !validDay(day.date) ||
      day.date < weekStart ||
      day.date > addDays(weekStart, 6) ||
      dates.has(day.date)
    )
      throw Error("RUZ date mismatch");
    dates.add(day.date);
    for (const lesson of day.lessons)
      if (
        lesson.time_end <= lesson.time_start ||
        !lesson.groups.some((g) => g.id === groupId && g.name === groupCode)
      )
        throw Error("RUZ lesson scope/time mismatch");
  }
  return {
    version: 1,
    groupId,
    groupCode,
    facultyId: data.group.faculty.id,
    weekStart,
    days: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i),
        day = data.days.find((x) => x.date === date);
      return {
        date,
        lessons: (day?.lessons ?? [])
          .map((l) => ({
            subject: l.subject,
            start: l.time_start,
            end: l.time_end,
            type: l.typeObj?.abbr || l.typeObj?.name || "Занятие",
            note: l.additional_info ?? "",
            teachers: l.teachers.map((t) => t.full_name),
            rooms: l.auditories.map((a) =>
              [a.building?.name || a.building?.abbr, a.name]
                .filter(Boolean)
                .join(" · "),
            ),
            lmsUrl: safeDlLink(l.lms_url),
          }))
          .sort((a, b) => a.start.localeCompare(b.start)),
      };
    }),
  };
}
/** Read the official page's JSON snapshot without executing any page scripts. */
export function extractRuzPagePayload(html: string, groupId: number): unknown {
  if (html.length > 512 * 1024) throw Error("RUZ page too large");
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const match =
      /^\s*window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(
        script[1],
      );
    if (!match) continue;
    const state = z
      .object({
        lessons: z.object({
          group: responseSchema.shape.group,
          week: responseSchema.shape.week,
          data: z.record(z.string(), z.unknown()),
        }),
      })
      .parse(JSON.parse(match[1]));
    return {
      group: state.lessons.group,
      week: state.lessons.week,
      days: state.lessons.data[String(groupId)],
    };
  }
  throw Error("Official RUZ snapshot missing");
}
export function sourceUrl(data: RuzWeek) {
  return `${RUZ_ORIGIN}/faculty/${data.facultyId}/groups/${data.groupId}?date=${data.weekStart}`;
}
export function normalizeSubject(value: string) {
  return value
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^а-яa-z0-9]/g, "");
}
// Only explicitly confirmed title aliases; never fuzzy-match unrelated subjects.
export function subjectKey(value: string) {
  const aliases: Record<string, string> = {
    [normalizeSubject("Архитектура процессоров и вычислительных систем")]:
      normalizeSubject("Архитектура процессоров"),
    [normalizeSubject(
      "Инженерная и компьютерная графика. Технологии виртуальной реальности",
    )]: normalizeSubject("Инженерная и компьютерная графика / VR"),
  };
  const key = normalizeSubject(value);
  return aliases[key] ?? key;
}
export function appliesToSubgroup(
  lesson: RuzLesson,
  groupCode: string,
  subgroup: number | null,
) {
  if (subgroup === null) return true;
  const escaped = groupCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}\\s*п/г\\s*(\\d+)$`, "i").exec(
    lesson.note.trim(),
  );
  return !match || Number(match[1]) === subgroup;
}
export function showScheduleSubject(subject: string) {
  const s = normalizeSubject(subject);
  return ![
    "военнаяподготовка",
    "образовательныйфорсайт",
    "научноисследовательскаяработа",
  ].some((x) => s.startsWith(x));
}
