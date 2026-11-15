import { describe, it, expect, beforeEach } from "vitest";
import {
  TimetableSqliteRepository,
  mobileTimetableSchema,
  type MobileTimetable,
} from "../packages/mobile-contracts/src";
import { NodeSqliteAdapter } from "../packages/mobile-contracts/src/sqlite/node-adapter";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const mockSnapshot = (
  groupCode = "5130901/40102",
  weekStart = "2026-11-16",
  state: "FRESH" | "STALE" = "FRESH",
  fetchedAt = "2026-11-16T08:00:00Z",
): MobileTimetable => {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.parse(weekStart + "T12:00:00Z") + i * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      date: d,
      lessons:
        i === 0 // Monday
          ? [
              {
                id: `occ-${groupCode.replace("/", "-")}-${d}-1000-0-test`,
                subject: "Основы теории управления",
                start: "10:00",
                scheduledEnd: "11:40",
                type: "Лекция",
                teachers: ["Нестеров Сергей Александрович"],
                rooms: ["3-й корпус, 511"],
                note: null,
              },
            ]
          : [], // other days empty
    };
  });

  return mobileTimetableSchema.parse({
    schemaVersion: 1,
    group: { code: groupCode, ruzId: 45591 },
    weekStart,
    state,
    sourceFetchedAt: fetchedAt,
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
};

describe("Timetable SQLite Repository (Local-First Offline Persistence)", () => {
  let adapter: NodeSqliteAdapter;
  let repo: TimetableSqliteRepository;

  beforeEach(() => {
    adapter = NodeSqliteAdapter.openInMemory();
    repo = new TimetableSqliteRepository(adapter);
  });

  it("handles concurrent init() calls safely without transaction collision", async () => {
    // Exact scenario from review: Promise.allSettled([repo.init(), repo.init()]) on fresh DB
    const results = await Promise.allSettled([
      repo.init(),
      repo.init(),
      repo.init(),
    ]);

    for (const r of results) {
      expect(r.status).toBe("fulfilled");
    }

    const rows = adapter.all<{ version: number }>(
      "SELECT version FROM schema_migrations ORDER BY version ASC",
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].version).toBe(1);
  });

  it("returns status: 'unloaded' on cold start when no data was ever cached (honest empty state)", async () => {
    await repo.init();
    const result = await repo.getDayTimetable("5130901/40102", "2026-11-16");

    expect(result.status).toBe("unloaded");
    if (result.status === "unloaded") {
      expect(result.message).toContain("ещё не загружено");
    }
  });

  it("saves a valid timetable snapshot and retrieves day lessons offline", async () => {
    const snapshot = mockSnapshot("5130901/40102", "2026-11-16", "FRESH");
    const saved = await repo.saveSnapshot(snapshot, "2026-11-16T08:05:00Z");
    expect(saved).toBe(true);

    // Monday (with lesson)
    const monResult = await repo.getDayTimetable("5130901/40102", "2026-11-16");
    expect(monResult.status).toBe("loaded");
    if (monResult.status === "loaded") {
      expect(monResult.isStale).toBe(false);
      expect(monResult.savedAt).toBe("2026-11-16T08:05:00Z");
      expect(monResult.sourceFetchedAt).toBe("2026-11-16T08:00:00Z");
      expect(monResult.lessons).toHaveLength(1);
      expect(monResult.lessons[0].subject).toBe("Основы теории управления");
      expect(monResult.lessons[0].start).toBe("10:00");
    }

    // Tuesday (known empty day)
    const tueResult = await repo.getDayTimetable("5130901/40102", "2026-11-17");
    expect(tueResult.status).toBe("loaded");
    if (tueResult.status === "loaded") {
      expect(tueResult.lessons).toHaveLength(0); // Positively confirmed free day
    }

    // Next week (unloaded)
    const nextWeekResult = await repo.getDayTimetable(
      "5130901/40102",
      "2026-11-23",
    );
    expect(nextWeekResult.status).toBe("unloaded");
  });

  it("rejects delayed/out-of-order network responses from overwriting newer local data", async () => {
    // 1. Newer snapshot already arrived at 10:00 UTC
    const newerSnapshot = mockSnapshot(
      "5130901/40102",
      "2026-11-16",
      "FRESH",
      "2026-11-16T10:00:00Z",
    );
    const saved1 = await repo.saveSnapshot(newerSnapshot, "2026-11-16T10:01:00Z");
    expect(saved1).toBe(true);

    // 2. Delayed older network response arrives with fetchedAt 08:00 UTC
    const olderSnapshot = mockSnapshot(
      "5130901/40102",
      "2026-11-16",
      "FRESH",
      "2026-11-16T08:00:00Z",
    );
    const saved2 = await repo.saveSnapshot(olderSnapshot, "2026-11-16T10:02:00Z");
    expect(saved2).toBe(false); // Must be rejected!

    // Verify stored snapshot retains newer timestamp
    const stored = await repo.getSnapshot("5130901/40102", "2026-11-16");
    expect(stored?.sourceFetchedAt).toBe("2026-11-16T10:00:00Z");
  });

  it("persists app preferences like selected group across calls", async () => {
    await repo.setPreference("selected_group_code", "5130901/40102");
    const val = await repo.getPreference("selected_group_code");
    expect(val).toBe("5130901/40102");

    // Overwrite
    await repo.setPreference("selected_group_code", "5130902/40201");
    const updated = await repo.getPreference("selected_group_code");
    expect(updated).toBe("5130902/40201");
  });

  it("survives process restarts and cold-boots from persistent file-based SQLite without network", async () => {
    const testDbPath = join(tmpdir(), `test-sv-offline-${Date.now()}.db`);

    try {
      // 1. Initial process: Open DB, save snapshot, and close
      {
        const fileAdapter = NodeSqliteAdapter.openFile(testDbPath);
        const fileRepo = new TimetableSqliteRepository(fileAdapter);
        const snapshot = mockSnapshot("5130901/40102", "2026-11-16", "FRESH");
        await fileRepo.saveSnapshot(snapshot, "2026-11-16T09:00:00Z");
        fileAdapter.close();
      }

      // 2. Cold-boot process:
      // Open new connection from file with zero network access
      {
        const freshAdapter = NodeSqliteAdapter.openFile(testDbPath);
        const coldBootRepo = new TimetableSqliteRepository(freshAdapter);

        const result = await coldBootRepo.getDayTimetable(
          "5130901/40102",
          "2026-11-16",
        );
        expect(result.status).toBe("loaded");
        if (result.status === "loaded") {
          expect(result.lessons[0].subject).toBe("Основы теории управления");
          expect(result.savedAt).toBe("2026-11-16T09:00:00Z");
        }
        freshAdapter.close();
      }
    } finally {
      if (existsSync(testDbPath)) {
        try {
          unlinkSync(testDbPath);
        } catch {}
      }
    }
  });

  it("refuses to overwrite an existing valid snapshot when source is UNAVAILABLE", async () => {
    // Save fresh snapshot first
    const fresh = mockSnapshot("5130901/40102", "2026-11-16", "FRESH");
    await repo.saveSnapshot(fresh);

    // Simulate transient provider failure DTO
    const unavailableDto = {
      schemaVersion: 1 as const,
      group: { code: "5130901/40102", ruzId: 45591 },
      weekStart: "2026-11-16",
      state: "UNAVAILABLE" as const,
      sourceFetchedAt: null,
      sourceUrl: null,
      data: null,
    };

    const saved = await repo.saveSnapshot(unavailableDto);
    expect(saved).toBe(false);

    // Existing cached snapshot is protected and intact
    const cached = await repo.getDayTimetable("5130901/40102", "2026-11-16");
    expect(cached.status).toBe("loaded");
    if (cached.status === "loaded") {
      expect(cached.lessons).toHaveLength(1);
    }
  });
});
