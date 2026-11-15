import { TimetableSqliteRepository } from "@studentvalue/mobile-contracts";
import { getMobileDatabase } from "./db";

let repoInstance: TimetableSqliteRepository | null = null;

export function getTimetableRepository(): TimetableSqliteRepository {
  if (!repoInstance) {
    const db = getMobileDatabase();
    repoInstance = new TimetableSqliteRepository(db);
  }
  return repoInstance;
}
