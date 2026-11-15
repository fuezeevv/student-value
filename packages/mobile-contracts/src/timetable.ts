import { z } from "zod";

// Platform-neutral wire contract. No Next, Prisma, browser globals or credentials.
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T12:00:00Z");
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar day");
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const text = z.string().trim().min(1).max(1000);
const sourceUrl = z
  .string()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.origin === "https://ruz.spbstu.ru" &&
        !url.username &&
        !url.password &&
        !url.hash &&
        /^\/faculty\/\d+\/groups\/\d+$/.test(url.pathname) &&
        [...url.searchParams.keys()].every((key) => key === "date")
      );
    } catch {
      return false;
    }
  }, "Expected official public RUZ group URL");
export const mobileLessonSchema = z
  .object({
    id: z.string().min(1).max(200), // Opaque occurrence ID; never a Task ID.
    subject: text,
    start: time,
    scheduledEnd: time, // Preserve the provider slot; progress policy is separate.
    type: text,
    teachers: z.array(text).max(20),
    rooms: z.array(text).max(20),
    note: z.string().max(2000).nullable(),
  })
  .strict();
const snapshot = z
  .object({
    days: z
      .array(
        z
          .object({ date: day, lessons: z.array(mobileLessonSchema).max(40) })
          .strict(),
      )
      .length(7),
  })
  .strict();
const base = {
  schemaVersion: z.literal(1),
  group: z
    .object({
      code: z.string().regex(/^\d{7}\/\d{5}$/),
      ruzId: z.number().int().positive().max(1000000),
    })
    .strict(),
  weekStart: day.refine(
    (value) => new Date(value + "T12:00:00Z").getUTCDay() === 1,
    "Expected Monday",
  ),
};
export const mobileTimetableSchema = z
  .discriminatedUnion("state", [
    z
      .object({
        ...base,
        state: z.enum(["FRESH", "STALE"]),
        sourceFetchedAt: z.string().datetime({ offset: true }),
        sourceUrl,
        data: snapshot,
      })
      .strict(),
    z
      .object({
        ...base,
        state: z.enum(["UNAVAILABLE", "UNCONFIGURED"]),
        sourceFetchedAt: z.null(),
        sourceUrl: z.null(),
        data: z.null(),
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (!value.data) return;
    const start = Date.parse(value.weekStart + "T12:00:00Z");
    if (!Number.isFinite(start)) return;
    const expected = Array.from({ length: 7 }, (_, index) =>
      new Date(start + index * 86400000).toISOString().slice(0, 10),
    );
    if (value.data.days.some((item, index) => item.date !== expected[index]))
      ctx.addIssue({
        code: "custom",
        message: "Expected exactly the seven ordered days of this week",
        path: ["data", "days"],
      });
    let url: URL;
    try {
      url = new URL(value.sourceUrl!);
    } catch {
      return;
    }
    if (url.pathname.split("/").at(-1) !== String(value.group.ruzId))
      ctx.addIssue({
        code: "custom",
        message: "Source group ID mismatch",
        path: ["sourceUrl"],
      });
  });
export type MobileTimetable = z.infer<typeof mobileTimetableSchema>;
export type MobileLesson = z.infer<typeof mobileLessonSchema>;

/** Unknown/unloaded and a positively known empty day must remain different UI states. */
export function mobileDayView(
  value: MobileTimetable,
  date: string,
):
  | { kind: "unknown" }
  | { kind: "known"; stale: boolean; lessons: MobileLesson[] } {
  const found = value.data?.days.find((item) => item.date === date);
  return found
    ? { kind: "known", stale: value.state === "STALE", lessons: found.lessons }
    : { kind: "unknown" };
}
