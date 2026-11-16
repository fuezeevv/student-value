import type { SqliteDatabase } from "./types";

export const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public_timetable_snapshots (
        group_code TEXT NOT NULL,
        ruz_id INTEGER NOT NULL,
        week_start TEXT NOT NULL,
        state TEXT NOT NULL,
        source_fetched_at TEXT NOT NULL,
        saved_at TEXT NOT NULL,
        source_url TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (group_code, week_start)
      );

      CREATE INDEX IF NOT EXISTS idx_timetable_lookup
        ON public_timetable_snapshots (group_code, week_start);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS app_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS pending_operations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING'
      );

      CREATE TABLE IF NOT EXISTS user_task_progress (
        user_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL,
        is_verified INTEGER NOT NULL DEFAULT 0,
        student_notes TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL,
        sync_state TEXT NOT NULL DEFAULT 'SYNCED',
        PRIMARY KEY (user_id, task_id)
      );

      CREATE INDEX IF NOT EXISTS idx_pending_ops_user
        ON pending_operations (user_id, status);
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS downloaded_materials (
        material_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        local_path TEXT NOT NULL,
        downloaded_at TEXT NOT NULL,
        PRIMARY KEY (material_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS scheduled_notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        deadline_id TEXT NOT NULL,
        notification_type TEXT NOT NULL,
        trigger_time TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'SCHEDULED',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_materials_user
        ON downloaded_materials (user_id);

      CREATE INDEX IF NOT EXISTS idx_notifs_user_task
        ON scheduled_notifications (user_id, task_id);
    `,
  },
  {
    version: 5,
    description: "Cached academic tasks per group",
    sql: `
      CREATE TABLE IF NOT EXISTS cached_tasks (
        id TEXT PRIMARY KEY,
        group_code TEXT NOT NULL,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        type TEXT NOT NULL,
        deadline_id TEXT,
        deadline_date TEXT,
        deadline_moscow_str TEXT,
        deadline_status TEXT,
        material_id TEXT,
        material_title TEXT,
        material_filename TEXT,
        material_byte_size INTEGER,
        material_mime_type TEXT,
        material_sha256 TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cached_tasks_group
        ON cached_tasks (group_code);
    `,
  },
];

export async function applySqliteMigrations(db: SqliteDatabase): Promise<number> {
  // Ensure migrations table exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = await db.all<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version ASC",
  );
  const appliedSet = new Set(appliedRows.map((r) => r.version));
  let count = 0;

  for (const m of MIGRATIONS) {
    if (!appliedSet.has(m.version)) {
      await db.transaction(async () => {
        await db.exec(m.sql);
        await db.run(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
          [m.version, new Date().toISOString()],
        );
      });
      count++;
    }
  }

  return count;
}
