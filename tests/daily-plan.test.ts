import { describe, it, expect } from "vitest";
import {
  planningLabels,
  buildDailyPlan,
  type DailyTask,
} from "../src/lib/study/daily-plan";
const now = Date.parse("2026-11-13T00:00:00+03:00");
const lab: DailyTask = {
  id: "a",
  title: "Лабораторная",
  type: "LABORATORY",
  course: "Синтез ВС",
  deadline: null,
};
describe("personal planning separate from academic acceptance", () => {
  it("distributes an undated laboratory across days without inventing a deadline", () => {
    expect(buildDailyPlan([lab], [], now).map((x) => x.id)).toEqual(["a:0"]);
    expect(
      buildDailyPlan([lab], ["a:0"], now + 86400000).map((x) => x.id),
    ).toEqual(["a:1"]);
    expect(buildDailyPlan([lab], ["a:0", "a:1", "a:2"], now)).toEqual([]);
  });
  it("includes all remaining parts when the real deadline is tomorrow", () => {
    expect(
      buildDailyPlan(
        [{ ...lab, deadline: "2026-11-14T00:00:00+03:00" }],
        [],
        now,
      ),
    ).toHaveLength(3);
  });
  it("allocates work per subject, excludes optional OTU homework and keeps its labs", () => {
    const tasks = [
      lab,
      { ...lab, id: "b", course: "ОТУ" },
      { ...lab, id: "c", course: "ОТУ", type: "HOMEWORK" },
    ];
    expect(buildDailyPlan(tasks, [], now).map((x) => x.id)).toEqual([
      "a:0",
      "b:0",
    ]);
  });
  it("does not call empty academic data a completed plan", () => {
    expect(buildDailyPlan([], [], now)).toEqual([]);
  });
});

it("reduces the remaining recovery horizon instead of restarting it each day", () => {
  const start = now - 13 * 86400000;
  expect(buildDailyPlan([lab], [], now, { a: start })).toHaveLength(3);
  expect(buildDailyPlan([lab], [], now, { a: start })[0].estimated).toBe(true);
});
it("prioritizes a real approaching deadline over old debt without moving old deadlines", () => {
  const old = { ...lab, id: "old", deadline: "2026-10-01T12:00:00+03:00" },
    due = { ...lab, id: "due", deadline: "2026-11-14T00:00:00+03:00" };
  const plan = buildDailyPlan([old, due], [], now);
  expect(plan[0].task.id).toBe("due");
  expect(old.deadline).toBe("2026-10-01T12:00:00+03:00");
});

it("plans both laboratory numbers in a published bundled assignment", () => {
  const bundle = {
    ...lab,
    title: "Задание 9 · SystemVerilog · Lab13–Lab14",
    deadline: "2026-11-14T00:00:00+03:00",
  };
  expect(buildDailyPlan([bundle], [], now)).toHaveLength(6);
  expect(planningLabels(bundle)[0]).toBe("Lab13 · часть 1/3");
  expect(planningLabels(bundle)[3]).toBe("Lab14 · часть 1/3");
});
