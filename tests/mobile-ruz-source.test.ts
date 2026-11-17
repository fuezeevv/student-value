import { describe, expect, it, vi } from "vitest";
import { parseMobileRuzSource } from "../packages/mobile-contracts/src/ruz-source";
import { mobileRuzJson } from "../apps/mobile/src/api/ruz-transport";

const selection = {
  kind: "teacher" as const,
  id: 42,
  label: "[TEST] Преподаватель",
};
const lesson = {
  subject: "[TEST] Дисциплина",
  time_start: "10:00",
  time_end: "11:40",
  typeObj: { name: "Лекция", abbr: "Лек" },
  groups: [{ id: 7, name: "[TEST] Группа" }],
  teachers: [{ id: 42, full_name: selection.label }],
  auditories: [{ id: 1, name: "507", building: { name: "[TEST] Корпус" } }],
};
const source = () => ({
  week: { date_start: "2026.11.16", date_end: "2026.11.22" },
  teacher: { id: 42, full_name: selection.label },
  days: [
    {
      date: "2026-11-16",
      lessons: [
        lesson,
        {
          ...lesson,
          subject: "[TEST] Другой предмет",
          time_start: "12:00",
          time_end: "13:40",
        },
      ],
    },
  ],
});

describe("Native RUZ source boundary", () => {
  it("rejects missing days, wrong identity/week and foreign lessons rather than caching an empty week", () => {
    const data = source();
    expect(() =>
      parseMobileRuzSource(
        { teacher: data.teacher, week: data.week },
        selection,
        "2026-11-16",
      ),
    ).toThrow();
    expect(() =>
      parseMobileRuzSource(
        { ...data, teacher: { ...data.teacher, id: 41 } },
        selection,
        "2026-11-16",
      ),
    ).toThrow();
    expect(() => parseMobileRuzSource(data, selection, "2026-11-23")).toThrow();
    expect(() =>
      parseMobileRuzSource(
        {
          ...data,
          days: [{ ...data.days[0], lessons: [{ ...lesson, teachers: [] }] }],
        },
        selection,
        "2026-11-16",
      ),
    ).toThrow();
  });
  it("preserves occurrence identities when the provider reorders lessons and permits confirmed empty weeks", () => {
    const data = source();
    const a = parseMobileRuzSource(data, selection, "2026-11-16");
    const b = parseMobileRuzSource(
      {
        ...data,
        days: [
          { ...data.days[0], lessons: [...data.days[0].lessons].reverse() },
        ],
      },
      selection,
      "2026-11-16",
    );
    expect(a.data!.days[0].lessons.map((l) => l.id)).toEqual(
      b.data!.days[0].lessons.map((l) => l.id),
    );
    const empty = parseMobileRuzSource(
      { ...data, days: [] },
      selection,
      "2026-11-16",
    );
    expect(empty.data!.days.every((d) => !d.lessons.length)).toBe(true);
  });
  it("checks group labels and each lesson audience", () => {
    const data = {
      ...source(),
      group: { id: 7, name: "[TEST] Группа", faculty: { id: 5 } },
    };
    expect(
      parseMobileRuzSource(
        data,
        { kind: "group", id: 7, label: "[TEST] Группа" },
        "2026-11-16",
      ).sourceUrl,
    ).toContain("faculty/5/groups/7");
    expect(() =>
      parseMobileRuzSource(
        data,
        { kind: "group", id: 7, label: "Wrong" },
        "2026-11-16",
      ),
    ).toThrow();
  });
  it("keeps the deadline active until the complete response and aborts oversized native transfers", async () => {
    vi.useFakeTimers();
    try {
      const xhr = {
        open: vi.fn(),
        setRequestHeader: vi.fn(),
        send: vi.fn(),
        abort: vi.fn(),
      } as unknown as XMLHttpRequest;
      const pending = mobileRuzJson(
        "teachers/42/scheduler?date=2026-11-16",
        () => xhr,
      );
      const assertion = expect(pending).rejects.toMatchObject({
        reason: "TIMEOUT",
      });
      await vi.advanceTimersByTimeAsync(8001);
      await assertion;
      expect(xhr.abort).toHaveBeenCalled();
      const oversized = mobileRuzJson("scheduler/7?date=2026-11-16", () => xhr);
      const sizeAssertion = expect(oversized).rejects.toMatchObject({
        reason: "SCHEMA_ERROR",
      });
      xhr.onprogress!({
        loaded: 600000,
        lengthComputable: false,
      } as ProgressEvent);
      await sizeAssertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
