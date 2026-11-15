import { DatabaseSync } from "node:sqlite";
import type { SqliteDatabase, SqlParam } from "./types";

export class NodeSqliteAdapter implements SqliteDatabase {
  private txLock: Promise<void> = Promise.resolve();

  constructor(private db: DatabaseSync) {}

  static openInMemory(): NodeSqliteAdapter {
    return new NodeSqliteAdapter(new DatabaseSync(":memory:"));
  }

  static openFile(path: string): NodeSqliteAdapter {
    return new NodeSqliteAdapter(new DatabaseSync(path));
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  run(sql: string, params: SqlParam[] = []): { changes: number } {
    const stmt = this.db.prepare(sql);
    const result = (stmt as any).run(...(params as any[]));
    return { changes: Number(result.changes) };
  }

  get<T>(sql: string, params: SqlParam[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    return (stmt as any).get(...(params as any[])) as T | undefined;
  }

  all<T>(sql: string, params: SqlParam[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return (stmt as any).all(...(params as any[])) as T[];
  }

  async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    const previousLock = this.txLock;
    let release: () => void = () => {};
    this.txLock = new Promise<void>((r) => {
      release = r;
    });

    await previousLock;
    try {
      this.exec("BEGIN");
      try {
        const res = await fn();
        this.exec("COMMIT");
        return res;
      } catch (err) {
        try {
          this.exec("ROLLBACK");
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
    this.db.close();
  }
}
