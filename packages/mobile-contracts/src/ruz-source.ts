import { z } from "zod";
import { mobileTimetableSchema, type MobileTimetable } from "./timetable";

const text = z.string().trim().min(1).max(1000);
const identity = z.object({ id: z.number().int().positive(), name: text });
const teacher = z.object({ id: z.number().int().positive(), full_name: text });
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const lesson = z.object({
  subject: text,
  time_start: clock,
  time_end: clock,
  typeObj: z.object({ name: text, abbr: text }).nullable().optional(),
  groups: z.array(identity).max(100),
  teachers: z.array(teacher).max(30),
  auditories: z
    .array(
      z.object({
        id: z.number().int().positive(),
        name: text,
        building: z
          .object({ name: text, abbr: text.optional() })
          .nullable()
          .optional(),
      }),
    )
    .max(30),
  additional_info: z.string().max(2000).nullable().optional(),
});
const payload = z.object({
  week: z.object({ date_start: text, date_end: text }),
  group: identity
    .extend({ faculty: z.object({ id: z.number().int().positive() }) })
    .optional(),
  teacher: teacher.optional(),
  days: z
    .array(z.object({ date: text, lessons: z.array(lesson).max(40) }))
    .max(7),
});
export type RuzSelection = {
  kind: "group" | "teacher";
  id: number;
  label: string;
};

function addDays(date: string, amount: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + amount * 86400000)
    .toISOString()
    .slice(0, 10);
}
// Opaque display identity, never an authorization token. Independent of array order.
function occurrenceId(value: string) {
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b ^ value.charCodeAt(i), 2246822519);
  }
  return `ruz-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

export function parseMobileRuzSource(
  raw: unknown,
  selection: RuzSelection,
  weekStart: string,
  now = new Date(),
): MobileTimetable {
  const data = payload.parse(raw);
  if (
    data.week.date_start.replaceAll(".", "-") !== weekStart ||
    data.week.date_end.replaceAll(".", "-") !== addDays(weekStart, 6)
  )
    throw Error("RUZ_WEEK_MISMATCH");
  const sourceIdentity = selection.kind === "group" ? data.group : data.teacher;
  if (!sourceIdentity || sourceIdentity.id !== selection.id)
    throw Error("RUZ_IDENTITY_MISMATCH");
  const name =
    selection.kind === "group" ? data.group!.name : data.teacher!.full_name;
  if (name !== selection.label) throw Error("RUZ_IDENTITY_MISMATCH");
  const seen = new Set<string>();
  for (const day of data.days) {
    if (
      day.date < weekStart ||
      day.date > addDays(weekStart, 6) ||
      seen.has(day.date) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day.date)
    )
      throw Error("RUZ_DAY_MISMATCH");
    seen.add(day.date);
    for (const item of day.lessons) {
      if (
        item.time_end <= item.time_start ||
        !(selection.kind === "group" ? item.groups : item.teachers).some(
          (x) => x.id === selection.id,
        )
      ) {
        throw Error("RUZ_LESSON_SCOPE_MISMATCH");
      }
    }
  }
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      date,
      lessons: (data.days.find((d) => d.date === date)?.lessons ?? [])
        .map((item) => ({
          id: occurrenceId(
            JSON.stringify([
              selection.kind,
              selection.id,
              date,
              item.subject,
              item.time_start,
              item.time_end,
              item.groups.map((g) => g.id).sort((a, b) => a - b),
              item.teachers.map((t) => t.id).sort((a, b) => a - b),
              item.auditories.map((a) => a.id).sort((a, b) => a - b),
              item.additional_info ?? "",
            ]),
          ),
          subject: item.subject,
          start: item.time_start,
          scheduledEnd: item.time_end,
          type: item.typeObj?.name || "Занятие",
          teachers: item.teachers.map((t) => t.full_name),
          rooms: item.auditories.map((a) =>
            [a.building?.name, `ауд. ${a.name}`].filter(Boolean).join(" · "),
          ),
          note:
            [
              item.additional_info,
              selection.kind === "teacher"
                ? item.groups.map((g) => g.name).join(", ")
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || null,
        }))
        .sort(
          (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
        ),
    };
  });
  const path =
    selection.kind === "teacher"
      ? `teachers/${selection.id}`
      : `faculty/${data.group!.faculty.id}/groups/${selection.id}`;
  return mobileTimetableSchema.parse({
    schemaVersion: 1,
    group: { code: selection.label, ruzId: selection.id },
    weekStart,
    state: "FRESH",
    sourceFetchedAt: now.toISOString(),
    sourceUrl: `https://ruz.spbstu.ru/${path}?date=${weekStart}`,
    data: { days },
  });
}
