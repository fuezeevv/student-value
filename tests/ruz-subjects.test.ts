import { describe, it, expect } from "vitest";
import {
  collectRuzSubjects,
  matchSubjectCourse,
} from "../src/lib/schedule/subjects";
import { loadPublicSubjectCatalog } from "../src/server/schedule/public-subjects";
import type { ScheduleResult } from "../src/server/schedule/ruz";
function week(
  start = "2026-11-02",
  subject = "Архитектура процессоров и вычислительных систем",
  type = "Лекция",
  teacher = "[TEST] Лектор",
): ScheduleResult {
  return {
    weekStart: start,
    state: "FRESH",
    fetchedAt: new Date("2026-11-04T08:00:00Z"),
    subgroup: null,
    data: {
      version: 1,
      groupId: 45591,
      groupCode: "5130901/40102",
      facultyId: 125,
      weekStart: start,
      days: [
        {
          date: start,
          lessons: [
            {
              subject,
              type,
              start: "10:00",
              end: "11:40",
              note: "",
              teachers: [teacher],
              rooms: ["[TEST] 101"],
              lmsUrl: null,
            },
          ],
        },
      ],
    },
  };
}
describe("public subjects are a projection of official timetable, never invented coursework", () => {
  it("combines repeated subjects and confirmed aliases while retaining teaching roles and scheduled dates", () => {
    const subjects = collectRuzSubjects([
      week(),
      week(
        "2026-11-09",
        "Архитектура процессоров",
        "Лабораторная",
        "[TEST] Практик",
      ),
    ]);
    expect(subjects).toHaveLength(1);
    expect(subjects[0].types).toEqual(["Лекция", "Лабораторная"]);
    expect(
      subjects[0].meetings.map((m) => [m.date, m.type, m.teachers[0]]),
    ).toEqual([
      ["2026-11-02", "Лекция", "[TEST] Лектор"],
      ["2026-11-09", "Лабораторная", "[TEST] Практик"],
    ]);
    expect(subjects[0].id).toBe(
      collectRuzSubjects([week("2026-11-16", "Архитектура процессоров")])[0].id,
    );
    expect(JSON.stringify(subjects)).not.toMatch(
      /deadline|taskId|progress|enrollment|xpEvent/,
    );
  });
  it("filters excluded subjects and refuses fuzzy or ambiguous internal course matches", () => {
    expect(
      collectRuzSubjects([
        week(undefined, "Военная подготовка"),
        week(undefined, "Образовательный форсайт"),
        week(undefined, "Научно-исследовательская работа"),
      ]),
    ).toEqual([]);
    const s = collectRuzSubjects([week()])[0];
    expect(
      matchSubjectCourse(s, [{ id: "right", title: "Архитектура процессоров" }])
        ?.id,
    ).toBe("right");
    expect(
      matchSubjectCourse(s, [
        { id: "a", title: "Архитектура процессоров" },
        { id: "b", title: s.title },
      ]),
    ).toBeNull();
    expect(
      matchSubjectCourse(s, [
        { id: "wrong", title: "Архитектура программных систем" },
      ]),
    ).toBeNull();
  });
  it("loads exactly three bounded weeks for the selected verified group, retains partial source status and does not query other groups", async () => {
    const calls: string[] = [];
    const catalog = await loadPublicSubjectCatalog("5130902-40204", {
      now: new Date("2026-11-04T08:00:00Z"),
      loadWeek: async (slug, date) => {
        calls.push(`${slug}:${date}`);
        if (date === "2026-11-09") throw Error("offline");
        const result = week(date, "[TEST] Предмет выбранной группы");
        result.data!.groupId = 45597;
        result.data!.groupCode = "5130902/40204";
        return result;
      },
    });
    expect(calls).toEqual([
      "5130902-40204:2026-11-02",
      "5130902-40204:2026-11-09",
      "5130902-40204:2026-11-16",
    ]);
    expect(catalog.end).toBe("2026-11-22");
    expect(catalog.subjects).toHaveLength(1);
    expect(catalog.weeks[1].state).toBe("UNAVAILABLE");
    const wrong = await loadPublicSubjectCatalog("5130902-40204", {
      now: new Date("2026-11-04T08:00:00Z"),
      loadWeek: async (_slug, date) => week(date),
    });
    expect(wrong.subjects).toEqual([]);
    expect(wrong.weeks.every((w) => w.state === "UNAVAILABLE")).toBe(true);
    await expect(
      loadPublicSubjectCatalog("arbitrary", {
        loadWeek: async () => {
          throw Error("Must not query");
        },
      }),
    ).rejects.toThrow("Группа недоступна");
  });
});
