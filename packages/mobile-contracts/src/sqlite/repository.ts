import {
  mobileTimetableSchema,
  mobileDayView,
  type MobileTimetable,
} from "../timetable";
import { applySqliteMigrations } from "./schema";
import type {
  SqliteDatabase,
  StoredSnapshotRow,
  DayTimetableResult,
} from "./types";

function weekStartForDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getTime() - day * 86400000);
  return monday.toISOString().slice(0, 10);
}

export class TimetableSqliteRepository {
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(private db: SqliteDatabase) {}

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await applySqliteMigrations(this.db);
        this.initialized = true;
      } catch (err) {
        this.initialized = false;
        this.initPromise = null;
        throw err;
      }
    })();

    return this.initPromise;
  }

  async saveSnapshot(
    snapshot: MobileTimetable,
    savedAtIso = new Date().toISOString(),
  ): Promise<boolean> {
    await this.init();

    // Strictly validate against wire schema
    const validated = mobileTimetableSchema.parse(snapshot);

    // If source state is unavailable or data is null, do not corrupt/overwrite an existing snapshot
    if (
      validated.state === "UNAVAILABLE" ||
      validated.state === "UNCONFIGURED" ||
      !validated.data
    ) {
      return false;
    }

    // Check if an existing row has a strictly newer source_fetched_at.
    // Prevent out-of-order network responses from rolling back recent data.
    const existing = await this.db.get<{ source_fetched_at: string }>(
      `SELECT source_fetched_at FROM public_timetable_snapshots WHERE group_code = ? AND week_start = ?`,
      [validated.group.code, validated.weekStart],
    );

    if (
      existing?.source_fetched_at &&
      validated.sourceFetchedAt &&
      new Date(validated.sourceFetchedAt).getTime() <
        new Date(existing.source_fetched_at).getTime()
    ) {
      return false;
    }

    const payloadJson = JSON.stringify(validated);

    await this.db.run(
      `
      INSERT INTO public_timetable_snapshots (
        group_code,
        ruz_id,
        week_start,
        state,
        source_fetched_at,
        saved_at,
        source_url,
        payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(group_code, week_start) DO UPDATE SET
        state = excluded.state,
        source_fetched_at = excluded.source_fetched_at,
        saved_at = excluded.saved_at,
        source_url = excluded.source_url,
        payload_json = excluded.payload_json
      `,
      [
        validated.group.code,
        validated.group.ruzId,
        validated.weekStart,
        validated.state,
        validated.sourceFetchedAt,
        savedAtIso,
        validated.sourceUrl,
        payloadJson,
      ],
    );

    return true;
  }

  async getSnapshot(
    groupCode: string,
    weekStart: string,
  ): Promise<{
    snapshot: MobileTimetable;
    savedAt: string;
    sourceFetchedAt: string;
  } | null> {
    await this.init();

    const row = await this.db.get<StoredSnapshotRow>(
      `
      SELECT * FROM public_timetable_snapshots
      WHERE group_code = ? AND week_start = ?
      `,
      [groupCode, weekStart],
    );

    if (!row) return null;

    try {
      const parsed = JSON.parse(row.payload_json);
      const validated = mobileTimetableSchema.parse(parsed);
      return {
        snapshot: validated,
        savedAt: row.saved_at,
        sourceFetchedAt: row.source_fetched_at,
      };
    } catch {
      // In case of corrupt record, return null so client knows it needs fresh fetch
      return null;
    }
  }

  async getDayTimetable(
    groupCode: string,
    date: string,
  ): Promise<DayTimetableResult> {
    await this.init();

    const weekStart = weekStartForDate(date);
    const stored = await this.getSnapshot(groupCode, weekStart);

    if (!stored) {
      return {
        status: "unloaded",
        groupCode,
        date,
        weekStart,
        message: "Расписание на эту неделю ещё не загружено на устройство",
      };
    }

    const dayView = mobileDayView(stored.snapshot, date);

    if (dayView.kind === "known") {
      return {
        status: "loaded",
        groupCode,
        date,
        weekStart,
        savedAt: stored.savedAt,
        sourceFetchedAt: stored.sourceFetchedAt,
        isStale: dayView.stale,
        lessons: dayView.lessons,
      };
    }

    return {
      status: "unloaded",
      groupCode,
      date,
      weekStart,
      message: "День не найден в загруженной неделе",
    };
  }

  async getSavedWeeks(
    groupCode: string,
  ): Promise<Array<{ weekStart: string; state: string; savedAt: string }>> {
    await this.init();

    const rows = await this.db.all<StoredSnapshotRow>(
      `
      SELECT week_start, state, saved_at FROM public_timetable_snapshots
      WHERE group_code = ?
      ORDER BY week_start ASC
      `,
      [groupCode],
    );

    return rows.map((r) => ({
      weekStart: r.week_start,
      state: r.state,
      savedAt: r.saved_at,
    }));
  }

  async deleteSnapshot(groupCode: string, weekStart: string): Promise<void> {
    await this.init();
    await this.db.run(
      "DELETE FROM public_timetable_snapshots WHERE group_code = ? AND week_start = ?",
      [groupCode, weekStart],
    );
  }

  async clearAll(): Promise<void> {
    await this.init();
    await this.db.exec("DELETE FROM public_timetable_snapshots;");
  }

  async getPreference(key: string): Promise<string | null> {
    await this.init();
    const row = await this.db.get<{ value: string }>(
      "SELECT value FROM app_preferences WHERE key = ?",
      [key],
    );
    return row ? row.value : null;
  }

  async setPreference(key: string, value: string): Promise<void> {
    await this.init();
    const now = new Date().toISOString();
    await this.db.run(
      `
      INSERT INTO app_preferences (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `,
      [key, value, now],
    );
  }
}
