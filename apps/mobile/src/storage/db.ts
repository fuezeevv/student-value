import * as SQLite from "expo-sqlite";
import type {
  SqliteDatabase,
  SqlParam,
} from "@studentvalue/mobile-contracts";

class ExpoSqliteSyncAdapter implements SqliteDatabase {
  private db: SQLite.SQLiteDatabase;
  private txLock: Promise<void> = Promise.resolve();

  constructor(db: SQLite.SQLiteDatabase) {
    this.db = db;
  }

  exec(sql: string): void {
    this.db.execSync(sql);
  }

  run(sql: string, params: SqlParam[] = []): { changes: number } {
    const result = this.db.runSync(sql, ...(params as any[]));
    return { changes: result.changes };
  }

  get<T>(sql: string, params: SqlParam[] = []): T | undefined {
    const row = this.db.getFirstSync<T>(sql, ...(params as any[]));
    return row ?? undefined;
  }

  all<T>(sql: string, params: SqlParam[] = []): T[] {
    return this.db.getAllSync<T>(sql, ...(params as any[]));
  }

  async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    const previousLock = this.txLock;
    let release: () => void = () => {};
    this.txLock = new Promise<void>((r) => {
      release = r;
    });

    await previousLock;
    try {
      this.exec("BEGIN;");
      try {
        const res = await fn();
        this.exec("COMMIT;");
        return res;
      } catch (err) {
        try {
          this.exec("ROLLBACK;");
        } catch {
          // Already rolled back
        }
        throw err;
      }
    } finally {
      release();
    }
  }

  close(): void {
    this.db.closeSync();
  }
}

let instance: SqliteDatabase | null = null;

export function getMobileDatabase(): SqliteDatabase {
  if (!instance) {
    const db = SQLite.openDatabaseSync("studentvalue_native.db");
    instance = new ExpoSqliteSyncAdapter(db);
  }
  return instance;
}
