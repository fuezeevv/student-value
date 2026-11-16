import type { MobileTimetable, MobileLesson } from "../timetable";

export type SqlParam = string | number | bigint | null | boolean | Uint8Array;

export interface SqliteDatabase {
  exec(sql: string): Promise<void> | void;
  run(sql: string, params?: SqlParam[]): Promise<{ changes: number }> | { changes: number };
  get<T>(sql: string, params?: SqlParam[]): Promise<T | undefined> | (T | undefined);
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]> | T[];
  transaction<T>(fn: () => Promise<T> | T): Promise<T>;
}

export type StoredSnapshotRow = {
  group_code: string;
  ruz_id: number;
  week_start: string;
  state: string;
  source_fetched_at: string;
  saved_at: string;
  source_url: string;
  payload_json: string;
};

export type DayTimetableResult =
  | {
      status: "loaded";
      groupCode: string;
      date: string;
      weekStart: string;
      savedAt: string;
      sourceFetchedAt: string;
      isStale: boolean;
      lessons: MobileLesson[];
    }
  | {
      status: "unloaded";
      groupCode: string;
      date: string;
      weekStart: string;
      message: string;
    };

export type PendingOperation = {
  id: string; // UUID
  userId: string;
  taskId: string;
  action: "SET_STATUS" | "SAVE_NOTES";
  payload: {
    status?: "NOT_STARTED" | "IN_PROGRESS" | "READY" | "SUBMITTED";
    notes?: string;
  };
  createdAt: string; // ISO
  status: "PENDING" | "SYNCING" | "FAILED";
};

export type UserTaskProgress = {
  userId: string;
  taskId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "READY" | "SUBMITTED" | "ACCEPTED";
  isVerified: boolean;
  studentNotes: string | null;
  completedAt: string | null;
  updatedAt: string;
  syncState: "SYNCED" | "PENDING_SYNC" | "FAILED";
};
