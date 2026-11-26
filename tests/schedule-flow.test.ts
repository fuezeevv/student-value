import { expect, it } from "vitest";
import { scheduleFlow } from "../src/lib/schedule/flow";
const days = [
  {
    date: "2026-11-13",
    lessons: [
      { subject: "Лекция", start: "10:00" },
      { subject: "Практика", start: "12:00" },
    ],
  },
  {
    date: "2026-11-16",
    lessons: [{ subject: "Лабораторная", start: "08:00" }],
  },
];
it("prioritizes the destination after the current class, retaining current progress", () => {
  const flow = scheduleFlow(days, "2026-11-13", "10:45");
  expect(flow.focus?.lesson.subject).toBe("Практика");
  expect(flow.current?.lesson.subject).toBe("Лекция");
  expect(flow.following[0]?.date).toBe("2026-11-16");
});
it("selects the next teaching day after classes end, not the first past class", () => {
  const flow = scheduleFlow(days, "2026-11-13", "14:00");
  expect(flow.focus?.date).toBe("2026-11-16");
  expect(flow.current).toBeNull();
  expect(scheduleFlow(days, "2026-11-17", "12:00").focus).toBeNull();
});
it("shows a current final class until the confirmed 90-minute duration ends", () => {
  const active = scheduleFlow(days.slice(0, 1), "2026-11-13", "13:29");
  expect(active.focus).toBe(active.current);
  expect(
    scheduleFlow(days.slice(0, 1), "2026-11-13", "13:29").focus?.lesson.start,
  ).toBe("12:00");
  expect(
    scheduleFlow(days.slice(0, 1), "2026-11-13", "13:30").focus,
  ).toBeNull();
});
it("uses the next scheduled date when today's known timetable is empty", () => {
  const flow = scheduleFlow(
    [{ date: "2026-11-15", lessons: [] }, ...days],
    "2026-11-15",
    "14:00",
  );
  expect(flow.focus?.date).toBe("2026-11-16");
  expect(flow.current).toBeNull();
});
it("orders concurrent lessons consistently without losing alternatives", () => {
  const flow = scheduleFlow(
    [
      {
        date: "2026-11-13",
        lessons: [
          { start: "14:00", subject: "Вторая" },
          { start: "10:00", subject: "Первая" },
          { start: "10:00", subject: "Подгруппа" },
        ],
      },
    ],
    "2026-11-13",
    "09:00",
  );
  expect(flow.focus?.lesson.subject).toBe("Первая");
  expect(flow.following.map((item) => item.lesson.subject)).toEqual([
    "Подгруппа",
    "Вторая",
  ]);
});
