import type { SqliteDatabase } from "./types";

export interface ExpoSqliteLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  withTransactionAsync<T>(fn: () => Promise<T>): Promise<T>;
}

export class ExpoSqliteAdapter implements SqliteDatabase {
  constructor(private db: ExpoSqliteLike) {}

  async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const res = await this.db.runAsync(sql, ...params);
    return { changes: res.changes };
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const res = await this.db.getFirstAsync<T>(sql, ...params);
    return res ?? undefined;
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return await this.db.getAllAsync<T>(sql, ...params);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return await this.db.withTransactionAsync(fn);
  }
}
