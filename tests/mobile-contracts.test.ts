import { expect, it } from "vitest";
import {
  mobileDayView,
  mobileTimetableSchema,
  type MobileLesson,
} from "../packages/mobile-contracts/src";
const fresh = () => ({
  schemaVersion: 1,
  group: { code: "5130901/40102", ruzId: 45591 },
  weekStart: "2026-11-16",
  state: "FRESH",
  sourceFetchedAt: "2026-11-16T06:00:00Z",
  sourceUrl: "https://ruz.spbstu.ru/faculty/125/groups/45591?date=2026-11-16",
  data: {
    days: Array.from({ length: 7 }, (_, index) => ({
      date: `2026-11-${16 + index}`,
      lessons: [] as MobileLesson[],
    })),
  },
});
it("distinguishes a known empty day from an unloaded day and a provider failure", () => {
  const value = mobileTimetableSchema.parse(fresh());
  expect(mobileDayView(value, "2026-11-16")).toEqual({
    kind: "known",
    stale: false,
    lessons: [],
  });
  expect(mobileDayView(value, "2026-11-23")).toEqual({ kind: "unknown" });
  const unavailable = mobileTimetableSchema.parse({
    ...fresh(),
    state: "UNAVAILABLE",
    data: null,
    sourceUrl: null,
    sourceFetchedAt: null,
  });
  expect(mobileDayView(unavailable, "2026-11-16")).toEqual({ kind: "unknown" });
  expect(
    mobileTimetableSchema.safeParse({ ...fresh(), state: "UNAVAILABLE" })
      .success,
  ).toBe(false);
});
it("rejects unknown versions, malformed/partial weeks and private payload fields", () => {
  for (const patch of [
    { schemaVersion: 2 },
    { weekStart: "2026-02-30" },
    { weekStart: "2026-11-17" },
    { data: { days: fresh().data.days.slice(1) } },
    { refreshToken: "private" },
    { group: { code: "5130901/40102", ruzId: 45591, email: "private" } },
  ])
    expect(
      mobileTimetableSchema.safeParse({ ...fresh(), ...patch }).success,
    ).toBe(false);
  const swapped = fresh();
  swapped.data.days.reverse();
  expect(mobileTimetableSchema.safeParse(swapped).success).toBe(false);
});
it("rejects counterfeit source URLs and mismatched official source IDs", () => {
  for (const sourceUrl of [
    "not a URL",
    "https://ruz.spbstu.ru.attacker.invalid/faculty/125/groups/45591",
    "https://owner:secret@ruz.spbstu.ru/faculty/125/groups/45591",
    "https://ruz.spbstu.ru/faculty/125/groups/45590",
  ])
    expect(
      mobileTimetableSchema.safeParse({ ...fresh(), sourceUrl }).success,
    ).toBe(false);
});
it("preserves source slots and stale metadata without inventing a task or acceptance", () => {
  const input = fresh();
  input.state = "STALE";
  input.data.days[0].lessons.push({
    id: "[TEST] occurrence",
    subject: "[TEST] Lecture",
    start: "10:00",
    scheduledEnd: "11:40",
    type: "Лекция",
    teachers: [],
    rooms: [],
    note: null,
  });
  const value = mobileTimetableSchema.parse(input);
  expect(mobileDayView(value, "2026-11-16")).toMatchObject({
    kind: "known",
    stale: true,
    lessons: [{ scheduledEnd: "11:40" }],
  });
  expect(value.data?.days[0].lessons[0]).not.toHaveProperty("accepted");
});
