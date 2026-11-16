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
  PendingOperation,
  UserTaskProgress,
  DownloadedMaterial,
  ScheduledNotificationRecord,
  CachedTask,
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

  async addPendingOperation(op: PendingOperation): Promise<void> {
    await this.init();
    await this.db.run(
      `
      INSERT INTO pending_operations (
        id, user_id, task_id, action, payload_json, created_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        payload_json = excluded.payload_json,
        status = excluded.status
      `,
      [
        op.id,
        op.userId,
        op.taskId,
        op.action,
        JSON.stringify(op.payload),
        op.createdAt,
        op.status,
      ],
    );
  }

  async getPendingOperations(userId: string): Promise<PendingOperation[]> {
    await this.init();
    const rows = await this.db.all<{
      id: string;
      user_id: string;
      task_id: string;
      action: "SET_STATUS" | "SAVE_NOTES";
      payload_json: string;
      created_at: string;
      status: "PENDING" | "SYNCING" | "FAILED";
    }>(
      `SELECT * FROM pending_operations WHERE user_id = ? ORDER BY created_at ASC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      taskId: r.task_id,
      action: r.action,
      payload: JSON.parse(r.payload_json),
      createdAt: r.created_at,
      status: r.status,
    }));
  }

  async removePendingOperation(id: string): Promise<void> {
    await this.init();
    await this.db.run(`DELETE FROM pending_operations WHERE id = ?`, [id]);
  }

  async updatePendingOperationStatus(
    id: string,
    status: "PENDING" | "SYNCING" | "FAILED",
  ): Promise<void> {
    await this.init();
    await this.db.run(`UPDATE pending_operations SET status = ? WHERE id = ?`, [
      status,
      id,
    ]);
  }

  async clearUserPendingOperations(userId: string): Promise<void> {
    await this.init();
    await this.db.run(`DELETE FROM pending_operations WHERE user_id = ?`, [userId]);
  }

  async saveUserProgress(progress: UserTaskProgress): Promise<void> {
    await this.init();
    await this.db.run(
      `
      INSERT INTO user_task_progress (
        user_id, task_id, status, is_verified, student_notes, completed_at, updated_at, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, task_id) DO UPDATE SET
        status = excluded.status,
        is_verified = excluded.is_verified,
        student_notes = excluded.student_notes,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at,
        sync_state = excluded.sync_state
      `,
      [
        progress.userId,
        progress.taskId,
        progress.status,
        progress.isVerified ? 1 : 0,
        progress.studentNotes,
        progress.completedAt,
        progress.updatedAt,
        progress.syncState,
      ],
    );
  }

  async getUserProgress(
    userId: string,
    taskId: string,
  ): Promise<UserTaskProgress | null> {
    await this.init();
    const row = await this.db.get<{
      user_id: string;
      task_id: string;
      status: "NOT_STARTED" | "IN_PROGRESS" | "READY" | "SUBMITTED" | "ACCEPTED";
      is_verified: number;
      student_notes: string | null;
      completed_at: string | null;
      updated_at: string;
      sync_state: "SYNCED" | "PENDING_SYNC" | "FAILED";
    }>(
      `SELECT * FROM user_task_progress WHERE user_id = ? AND task_id = ?`,
      [userId, taskId],
    );
    if (!row) return null;
    return {
      userId: row.user_id,
      taskId: row.task_id,
      status: row.status,
      isVerified: Boolean(row.is_verified),
      studentNotes: row.student_notes,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
      syncState: row.sync_state,
    };
  }

  async getAllUserProgress(userId: string): Promise<UserTaskProgress[]> {
    await this.init();
    const rows = await this.db.all<{
      user_id: string;
      task_id: string;
      status: "NOT_STARTED" | "IN_PROGRESS" | "READY" | "SUBMITTED" | "ACCEPTED";
      is_verified: number;
      student_notes: string | null;
      completed_at: string | null;
      updated_at: string;
      sync_state: "SYNCED" | "PENDING_SYNC" | "FAILED";
    }>(
      `SELECT * FROM user_task_progress WHERE user_id = ?`,
      [userId],
    );
    return rows.map((row) => ({
      userId: row.user_id,
      taskId: row.task_id,
      status: row.status,
      isVerified: Boolean(row.is_verified),
      studentNotes: row.student_notes,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
      syncState: row.sync_state,
    }));
  }

  async saveDownloadedMaterial(mat: DownloadedMaterial): Promise<void> {
    await this.init();
    await this.db.run(
      `INSERT OR REPLACE INTO downloaded_materials
        (material_id, user_id, filename, mime_type, byte_size, sha256, local_path, downloaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mat.materialId,
        mat.userId,
        mat.filename,
        mat.mimeType,
        mat.byteSize,
        mat.sha256,
        mat.localPath,
        mat.downloadedAt,
      ],
    );
  }

  async getDownloadedMaterial(
    userId: string,
    materialId: string,
  ): Promise<DownloadedMaterial | null> {
    await this.init();
    const row = await this.db.get<{
      material_id: string;
      user_id: string;
      filename: string;
      mime_type: string;
      byte_size: number;
      sha256: string;
      local_path: string;
      downloaded_at: string;
    }>(
      `SELECT material_id, user_id, filename, mime_type, byte_size, sha256, local_path, downloaded_at
       FROM downloaded_materials
       WHERE user_id = ? AND material_id = ?`,
      [userId, materialId],
    );
    if (!row) return null;
    return {
      materialId: row.material_id,
      userId: row.user_id,
      filename: row.filename,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      sha256: row.sha256,
      localPath: row.local_path,
      downloadedAt: row.downloaded_at,
    };
  }

  async getAllDownloadedMaterials(userId: string): Promise<DownloadedMaterial[]> {
    await this.init();
    const rows = await this.db.all<{
      material_id: string;
      user_id: string;
      filename: string;
      mime_type: string;
      byte_size: number;
      sha256: string;
      local_path: string;
      downloaded_at: string;
    }>(
      `SELECT material_id, user_id, filename, mime_type, byte_size, sha256, local_path, downloaded_at
       FROM downloaded_materials
       WHERE user_id = ?
       ORDER BY downloaded_at DESC`,
      [userId],
    );
    return rows.map((row) => ({
      materialId: row.material_id,
      userId: row.user_id,
      filename: row.filename,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      sha256: row.sha256,
      localPath: row.local_path,
      downloadedAt: row.downloaded_at,
    }));
  }

  async deleteDownloadedMaterial(userId: string, materialId: string): Promise<void> {
    await this.init();
    await this.db.run(
      `DELETE FROM downloaded_materials WHERE user_id = ? AND material_id = ?`,
      [userId, materialId],
    );
  }

  async saveScheduledNotification(notif: ScheduledNotificationRecord): Promise<void> {
    await this.init();
    await this.db.run(
      `INSERT OR REPLACE INTO scheduled_notifications
        (id, user_id, task_id, deadline_id, notification_type, trigger_time, title, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notif.id,
        notif.userId,
        notif.taskId,
        notif.deadlineId,
        notif.notificationType,
        notif.triggerTime,
        notif.title,
        notif.body,
        notif.status,
        notif.createdAt,
      ],
    );
  }

  async getScheduledNotification(id: string): Promise<ScheduledNotificationRecord | null> {
    await this.init();
    const row = await this.db.get<{
      id: string;
      user_id: string;
      task_id: string;
      deadline_id: string;
      notification_type: "DEADLINE_REMINDER";
      trigger_time: string;
      title: string;
      body: string;
      status: "SCHEDULED" | "DELIVERED" | "CANCELLED";
      created_at: string;
    }>(
      `SELECT id, user_id, task_id, deadline_id, notification_type, trigger_time, title, body, status, created_at
       FROM scheduled_notifications WHERE id = ?`,
      [id],
    );
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      taskId: row.task_id,
      deadlineId: row.deadline_id,
      notificationType: row.notification_type,
      triggerTime: row.trigger_time,
      title: row.title,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  async getScheduledNotificationsForTask(
    userId: string,
    taskId: string,
  ): Promise<ScheduledNotificationRecord[]> {
    await this.init();
    const rows = await this.db.all<{
      id: string;
      user_id: string;
      task_id: string;
      deadline_id: string;
      notification_type: "DEADLINE_REMINDER";
      trigger_time: string;
      title: string;
      body: string;
      status: "SCHEDULED" | "DELIVERED" | "CANCELLED";
      created_at: string;
    }>(
      `SELECT id, user_id, task_id, deadline_id, notification_type, trigger_time, title, body, status, created_at
       FROM scheduled_notifications
       WHERE user_id = ? AND task_id = ?
       ORDER BY trigger_time ASC`,
      [userId, taskId],
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      taskId: row.task_id,
      deadlineId: row.deadline_id,
      notificationType: row.notification_type,
      triggerTime: row.trigger_time,
      title: row.title,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  async updateNotificationStatus(
    id: string,
    status: "SCHEDULED" | "DELIVERED" | "CANCELLED",
  ): Promise<void> {
    await this.init();
    await this.db.run(
      `UPDATE scheduled_notifications SET status = ? WHERE id = ?`,
      [status, id],
    );
  }

  async deleteScheduledNotification(id: string): Promise<void> {
    await this.init();
    await this.db.run(`DELETE FROM scheduled_notifications WHERE id = ?`, [id]);
  }

  async clearUserData(userId: string): Promise<void> {
    await this.init();
    await this.db.run(`DELETE FROM pending_operations WHERE user_id = ?`, [userId]);
    await this.db.run(`DELETE FROM user_task_progress WHERE user_id = ?`, [userId]);
    await this.db.run(`DELETE FROM downloaded_materials WHERE user_id = ?`, [userId]);
    await this.db.run(`DELETE FROM scheduled_notifications WHERE user_id = ?`, [userId]);
  }

  async saveCachedTasksForGroup(
    groupCode: string,
    tasks: CachedTask[],
  ): Promise<void> {
    await this.init();
    await this.db.transaction(async () => {
      await this.db.run(`DELETE FROM cached_tasks WHERE group_code = ?`, [groupCode]);
      const now = new Date().toISOString();
      for (const t of tasks) {
        await this.db.run(
          `INSERT INTO cached_tasks (
            id, group_code, title, subject, type,
            deadline_id, deadline_date, deadline_moscow_str, deadline_status,
            material_id, material_title, material_filename, material_byte_size,
            material_mime_type, material_sha256, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            t.id,
            groupCode,
            t.title,
            t.subject,
            t.type,
            t.deadlineId,
            t.deadlineDate,
            t.deadlineMoscowStr,
            t.deadlineStatus,
            t.materialId,
            t.materialTitle,
            t.materialFilename,
            t.materialByteSize,
            t.materialMimeType,
            t.materialSha256,
            now,
          ],
        );
      }
    });
  }

  async getCachedTasksForGroup(groupCode: string): Promise<CachedTask[]> {
    await this.init();
    const rows = await this.db.all<{
      id: string;
      group_code: string;
      title: string;
      subject: string;
      type: string;
      deadline_id: string | null;
      deadline_date: string | null;
      deadline_moscow_str: string | null;
      deadline_status: string | null;
      material_id: string | null;
      material_title: string | null;
      material_filename: string | null;
      material_byte_size: number | null;
      material_mime_type: string | null;
      material_sha256: string | null;
      updated_at: string;
    }>(
      `SELECT * FROM cached_tasks WHERE group_code = ? ORDER BY deadline_date ASC, id ASC`,
      [groupCode],
    );

    return rows.map((r) => ({
      id: r.id,
      groupCode: r.group_code,
      title: r.title,
      subject: r.subject,
      type: r.type,
      deadlineId: r.deadline_id,
      deadlineDate: r.deadline_date,
      deadlineMoscowStr: r.deadline_moscow_str,
      deadlineStatus: r.deadline_status,
      materialId: r.material_id,
      materialTitle: r.material_title,
      materialFilename: r.material_filename,
      materialByteSize: r.material_byte_size,
      materialMimeType: r.material_mime_type,
      materialSha256: r.material_sha256,
      updatedAt: r.updated_at,
    }));
  }
}
