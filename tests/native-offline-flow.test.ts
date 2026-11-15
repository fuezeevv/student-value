import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  TimetableSqliteRepository,
  mobileTimetableSchema,
  calculateLessonProgress,
  type MobileTimetable,
} from "../packages/mobile-contracts/src";
import { NodeSqliteAdapter } from "../packages/mobile-contracts/src/sqlite/node-adapter";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlinkSync, existsSync } from "node:fs";

// Mock snapshot representing group 102 official timetable
function createTestSnapshot(
  groupCode = "5130901/40102",
  weekStart = "2026-11-16",
  state: "FRESH" | "STALE" = "FRESH",
): MobileTimetable {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.parse(weekStart + "T12:00:00Z") + i * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      date: d,
      lessons:
        i === 0
          ? [
              {
                id: `occ-102-${d}-1000-0`,
                subject: "Синтез и моделирование аппаратных средств",
                start: "10:00",
                scheduledEnd: "11:40",
                type: "Лекция",
                teachers: ["Антонов Александр Петрович"],
                rooms: ["3-й учебный корпус, 3-215"],
                note: null,
              },
              {
                id: `occ-102-${d}-1200-1`,
                subject: "Основы теории управления",
                start: "12:00",
                scheduledEnd: "13:40",
                type: "Лекция",
                teachers: ["Нестеров Сергей Александрович"],
                rooms: ["3-й учебный корпус, 3-511"],
                note: null,
              },
            ]
          : [],
    };
  });

  return mobileTimetableSchema.parse({
    schemaVersion: 1,
    group: { code: groupCode, ruzId: 45591 },
    weekStart,
    state,
    sourceFetchedAt: "2026-11-16T07:30:00Z",
    sourceUrl: "https://ruz.spbstu.ru/faculty/125/groups/45591?date=" + weekStart,
    data: {
      days: days as [
        { date: string; lessons: any[] },
        { date: string; lessons: any[] },
        { date: string; lessons: any[] },
        { date: string; lessons: any[] },
        { date: string; lessons: any[] },
        { date: string; lessons: any[] },
        { date: string; lessons: any[] },
      ],
    },
  });
}

describe("Node SQLite Cold-Start & Timetable Flow Logic (Headless Verification)", () => {
  const dbPath = join(tmpdir(), `sv-offline-proof-${Date.now()}.db`);

  beforeEach(() => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
  });

  afterEach(() => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
  });

  it("Step 1: Populates local SQLite with group 102 snapshot and verifies persistence", async () => {
    const adapter = NodeSqliteAdapter.openFile(dbPath);
    const repo = new TimetableSqliteRepository(adapter);
    await repo.init();

    const snapshot = createTestSnapshot("5130901/40102", "2026-11-16", "FRESH");
    const saved = await repo.saveSnapshot(snapshot, "2026-11-16T07:35:00Z");
    expect(saved).toBe(true);

    const savedWeeks = await repo.getSavedWeeks("5130901/40102");
    expect(savedWeeks).toHaveLength(1);
    expect(savedWeeks[0].weekStart).toBe("2026-11-16");
    expect(savedWeeks[0].savedAt).toBe("2026-11-16T07:35:00Z");

    adapter.close();
  });

  it("Step 2: Proves cold start after connection closure with network unreachable", async () => {
    // 1. Initial process populates and closes database connection cleanly
    const adapter1 = NodeSqliteAdapter.openFile(dbPath);
    const repo1 = new TimetableSqliteRepository(adapter1);
    const snapshot = createTestSnapshot("5130901/40102", "2026-11-16", "FRESH");
    await repo1.saveSnapshot(snapshot, "2026-11-16T07:35:00Z");
    adapter1.close();

    // 2. Simulated airplane mode (outbound fetch rejects unconditionally)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error("AIRPLANE_MODE: Network is completely unreachable");
    };

    try {
      // 3. Cold connection opened anew from disk
      const coldAdapter = NodeSqliteAdapter.openFile(dbPath);
      const coldRepo = new TimetableSqliteRepository(coldAdapter);

      // Read day schedule directly from SQLite with zero network traffic
      const dayResult = await coldRepo.getDayTimetable("5130901/40102", "2026-11-16");

      expect(dayResult.status).toBe("loaded");
      if (dayResult.status === "loaded") {
        expect(dayResult.lessons).toHaveLength(2);
        expect(dayResult.lessons[0].subject).toBe("Синтез и моделирование аппаратных средств");
        expect(dayResult.lessons[0].start).toBe("10:00");
        expect(dayResult.lessons[0].scheduledEnd).toBe("11:40");
        expect(dayResult.lessons[0].rooms).toEqual(["3-й учебный корпус, 3-215"]);
        expect(dayResult.lessons[0].teachers).toEqual(["Антонов Александр Петрович"]);

        expect(dayResult.lessons[1].subject).toBe("Основы теории управления");
        expect(dayResult.lessons[1].start).toBe("12:00");

        expect(dayResult.savedAt).toBe("2026-11-16T07:35:00Z");
        expect(dayResult.sourceFetchedAt).toBe("2026-11-16T07:30:00Z");
        expect(dayResult.isStale).toBe(false);
      }
      coldAdapter.close();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Step 3: Honors honest empty state when week is not in SQLite (does NOT report 'пар нет')", async () => {
    const adapter = NodeSqliteAdapter.openFile(dbPath);
    const repo = new TimetableSqliteRepository(adapter);
    await repo.init();

    // Query un-cached week (e.g. next semester)
    const uncachedResult = await repo.getDayTimetable("5130901/40102", "2027-02-15");
    expect(uncachedResult.status).toBe("unloaded");
    if (uncachedResult.status === "unloaded") {
      expect(uncachedResult.message).toContain("ещё не загружено");
    }
    adapter.close();
  });

  it("Step 4: Distinguishes a confirmed free day (0 lessons in cached week) from unloaded data", async () => {
    const adapter = NodeSqliteAdapter.openFile(dbPath);
    const repo = new TimetableSqliteRepository(adapter);
    const snapshot = createTestSnapshot("5130901/40102", "2026-11-16", "FRESH");
    await repo.saveSnapshot(snapshot);

    // Tuesday in loaded week: positively confirmed free day
    const tuesday = await repo.getDayTimetable("5130901/40102", "2026-11-17");
    expect(tuesday.status).toBe("loaded");
    if (tuesday.status === "loaded") {
      expect(tuesday.lessons).toHaveLength(0); // Positively confirmed free day
    }
    adapter.close();
  });

  it("Step 5: Verifies calculateLessonProgress (shared academic 90-min progress policy)", () => {
    const lessonStart = "10:00"; // 600 min

    // Case A: 09:30 (before class)
    const resBefore = calculateLessonProgress(lessonStart, 570);
    expect(resBefore.isOngoing).toBe(false);
    expect(resBefore.isCompleted).toBe(false);
    expect(resBefore.progressPercent).toBe(0);

    // Case B: 10:15 (15 mins into 90-min class)
    const res15 = calculateLessonProgress(lessonStart, 615);
    expect(res15.isOngoing).toBe(true);
    expect(res15.isCompleted).toBe(false);
    expect(Math.round(res15.progressPercent)).toBe(17); // 15/90 = 16.67%

    // Case C: 10:45 (halfway through class)
    const resHalf = calculateLessonProgress(lessonStart, 645);
    expect(resHalf.isOngoing).toBe(true);
    expect(Math.round(resHalf.progressPercent)).toBe(50); // 45/90 = 50%

    // Case D: 11:30 (90 mins elapsed - academic duration reached)
    const resEnd = calculateLessonProgress(lessonStart, 690);
    expect(resEnd.isOngoing).toBe(false);
    expect(resEnd.isCompleted).toBe(true);
    expect(resEnd.progressPercent).toBe(100);

    // Case E: 11:35 (during RUZ 10-minute administrative margin up to 11:40)
    const resMargin = calculateLessonProgress(lessonStart, 695);
    expect(resMargin.isOngoing).toBe(false);
    expect(resMargin.isCompleted).toBe(true);
    expect(resMargin.progressPercent).toBe(100);
  });
});
