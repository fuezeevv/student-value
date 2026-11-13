import { describe, it, expect } from "vitest";
import {
  parseRuzWeek,
  requestedWeek,
  weekStartFor,
  safeDlLink,
  showScheduleSubject,
  appliesToSubgroup,
} from "../src/lib/schedule/ruz";
const group = { id: 45591, name: "5130901/40102", faculty: { id: 125 } };
export function timetable(groupId = group.id, code = group.name) {
  return {
    week: { date_start: "2026.11.02", date_end: "2026.11.08" },
    group: { ...group, id: groupId, name: code },
    days: [
      {
        date: "2026-11-05",
        lessons: [
          {
            subject: "Основы теории управления",
            time_start: "10:00",
            time_end: "11:40",
            typeObj: { name: "Лабораторные", abbr: "Лаб" },
            additional_info: "Подгруппа 2",
            groups: [{ id: groupId, name: code }],
            teachers: [
              { full_name: "Преподаватель лекции" },
              { full_name: "Преподаватель практики" },
            ],
            auditories: [
              { name: "402", building: { name: "3-й корпус", abbr: "3 к." } },
            ],
            lms_url: "https://dl.spbstu.ru//course/view.php?id=8192",
          },
        ],
      },
    ],
  };
}
describe("official timetable parsing", () => {
  it("filters only an explicit subgroup for this exact group and preserves unknown audience", () => {
    const lesson = parseRuzWeek(timetable(), 45591, group.name, "2026-11-02")
      .days[3].lessons[0];
    expect(
      appliesToSubgroup(
        { ...lesson, note: group.name + " п/г 2" },
        group.name,
        1,
      ),
    ).toBe(false);
    expect(
      appliesToSubgroup(
        { ...lesson, note: group.name + " п/г 2" },
        group.name,
        2,
      ),
    ).toBe(true);
    expect(
      appliesToSubgroup(
        { ...lesson, note: group.name + " п/г 2" },
        group.name,
        null,
      ),
    ).toBe(true);
    expect(
      appliesToSubgroup(
        { ...lesson, note: "5130902/40201 п/г 2" },
        group.name,
        1,
      ),
    ).toBe(true);
    expect(appliesToSubgroup({ ...lesson, note: "Поток" }, group.name, 1)).toBe(
      true,
    );
  });
  it("uses Moscow dates and real Mondays across year boundaries", () => {
    expect(requestedWeek(undefined, new Date("2026-11-01T22:30:00Z"))).toBe(
      "2026-11-02",
    );
    expect(weekStartFor("2027-01-01")).toBe("2026-12-28");
    expect(() => requestedWeek("2026-02-30", new Date("2026-02-01"))).toThrow();
    expect(() => requestedWeek("2028-11-02", new Date("2026-11-04"))).toThrow();
  });
  it("preserves teaching formats, subgroups, multiple teachers and empty days", () => {
    const week = parseRuzWeek(timetable(), 45591, group.name, "2026-11-02");
    expect(week.days).toHaveLength(7);
    expect(week.days[2]).toEqual({ date: "2026-11-04", lessons: [] });
    expect(week.days[3].lessons[0]).toMatchObject({
      type: "Лаб",
      note: "Подгруппа 2",
      teachers: ["Преподаватель лекции", "Преподаватель практики"],
      rooms: ["3-й корпус · 402"],
      lmsUrl: "https://dl.spbstu.ru/course/view.php?id=8192",
    });
  });
  it("rejects another group/week, malformed time and foreign lesson audience", () => {
    for (const change of [
      (x: any) => {
        x.group.id = 999;
      },
      (x: any) => {
        x.week.date_start = "2026.11.09";
      },
      (x: any) => {
        x.days[0].date = "2026-11-16";
      },
      (x: any) => {
        x.days[0].lessons[0].time_end = "09:00";
      },
      (x: any) => {
        x.days[0].lessons[0].groups[0].id = 999;
      },
    ]) {
      const raw = timetable();
      change(raw);
      expect(() =>
        parseRuzWeek(raw, 45591, group.name, "2026-11-02"),
      ).toThrow();
    }
  });
  it("only links to the real DL and respects requested subject exclusions", () => {
    expect(safeDlLink("javascript:alert(1)")).toBeNull();
    expect(
      safeDlLink("https://dl.spbstu.ru.evil.test/course/view.php?id=2"),
    ).toBeNull();
    for (const subject of [
      "Военная подготовка",
      "Образовательный форсайт",
      "Научно-исследовательская работа",
    ])
      expect(showScheduleSubject(subject)).toBe(false);
    expect(showScheduleSubject("Основы теории управления")).toBe(true);
  });
});
