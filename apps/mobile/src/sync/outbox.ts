import {
  sessionGeneration,
  sessionSignal,
  isCurrentSession,
} from "../auth/session-lifecycle";
import * as Crypto from "expo-crypto";
import { getTimetableRepository } from "../storage/repository";
import { getSessionToken, getSessionUser } from "../auth/token-storage";
import { getActiveApiOrigin } from "../api/client";
import type {
  PendingOperation,
  UserTaskProgress,
} from "@studentvalue/mobile-contracts";

let isFlushing = false;

export async function enqueueProgressUpdate(
  taskId: string,
  status: "NOT_STARTED" | "IN_PROGRESS" | "READY" | "SUBMITTED",
  notes?: string,
  groupCode?: string,
): Promise<{ operationId: string; optimisticProgress: UserTaskProgress }> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Необходима авторизация для отметки выполнения");
  }

  const repo = getTimetableRepository();
  const operationId = Crypto.randomUUID();
  const now = new Date().toISOString();
  const previous = await repo.getUserProgress(user.id, taskId);
  const queued = (await repo.getPendingOperations(user.id)).filter(
    (op) => op.taskId === taskId && op.status !== "FAILED",
  );
  const predecessor = queued.at(-1);

  const optimisticProgress: UserTaskProgress = {
    userId: user.id,
    taskId,
    status,
    isVerified: false,
    studentNotes: notes ?? previous?.studentNotes ?? null,
    completedAt:
      status === "READY" || status === "SUBMITTED"
        ? (previous?.completedAt ?? now)
        : null,
    updatedAt: now,
    syncState: "PENDING_SYNC",
  };

  const op: PendingOperation = {
    id: operationId,
    userId: user.id,
    taskId,
    action: "SET_STATUS",
    payload: {
      status,
      notes,
      groupCode,
      ...(predecessor
        ? { dependsOnOperationId: predecessor.id }
        : { baseUpdatedAt: previous?.updatedAt ?? null }),
    },
    createdAt: now,
    status: "PENDING",
  };

  await repo.enqueueProgressOperation(optimisticProgress, op);
  // A new explicit choice supersedes failed drafts of the same task. Until this
  // point they remain stored for recovery; transient network retries never drop them.
  for (const failed of await repo.getPendingOperations(user.id)) {
    if (failed.taskId === taskId && failed.status === "FAILED")
      await repo.removePendingOperation(failed.id);
  }

  // Trigger background flush (fire-and-forget)
  flushOutbox().catch(() => {});

  return { operationId, optimisticProgress };
}

export type FlushReport = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
};

export async function flushOutbox(): Promise<FlushReport> {
  if (isFlushing) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: ["ALREADY_FLUSHING"],
    };
  }

  isFlushing = true;
  const report: FlushReport = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  try {
    const generation = sessionGeneration();
    const user = await getSessionUser();
    const token = await getSessionToken();

    if (!user || !token) {
      return report;
    }

    const repo = getTimetableRepository();
    const pendingOps = await repo.getPendingOperations(user.id);
    const baseUrl = await getActiveApiOrigin();

    for (const op of pendingOps) {
      if (!isCurrentSession(generation)) break;
      if (op.status === "FAILED") {
        report.failed++;
        report.errors.push(
          "Есть конфликтующие изменения: обновите данные и повторите свой выбор.",
        );
        continue;
      }
      report.processed++;
      await repo.updatePendingOperationStatus(op.id, "SYNCING");
      const controller = new AbortController();
      const parentSignal = sessionSignal();
      const abort = () => controller.abort();
      parentSignal.addEventListener("abort", abort);
      const timer = setTimeout(abort, 10000);
      try {
        const res = await fetch(`${baseUrl}/api/v1/progress`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            operationId: op.id,
            taskId: op.taskId,
            status: op.payload.status || "READY",
            notes: op.payload.notes,
            groupCode: op.payload.groupCode,
            createdAt: op.createdAt,
            baseUpdatedAt: op.payload.baseUpdatedAt,
            dependsOnOperationId: op.payload.dependsOnOperationId,
          }),
        });

        if (res.status === 200) {
          const data = await res.json();
          if (!isCurrentSession(generation)) break;
          await repo.saveUserProgress({
            userId: data.progress.userId,
            taskId: data.progress.taskId,
            status: data.progress.status,
            isVerified: data.progress.isVerified,
            studentNotes: data.progress.studentNotes,
            completedAt: data.progress.completedAt,
            updatedAt: data.progress.updatedAt,
            syncState: "SYNCED",
          });
          await repo.removePendingOperation(op.id);
          report.succeeded++;
        } else if (res.status === 409) {
          await repo.updatePendingOperationStatus(op.id, "FAILED");
          const local = await repo.getUserProgress(user.id, op.taskId);
          if (local)
            await repo.saveUserProgress({ ...local, syncState: "FAILED" });
          report.failed++;
          report.errors.push(
            "Результат изменён на другом устройстве. Обновите данные и повторите отметку; черновик сохранён.",
          );
          break;
        } else if (res.status === 403) {
          // Audience revoked or forbidden
          await repo.updatePendingOperationStatus(op.id, "FAILED");
          report.failed++;
          report.errors.push(`403 FORBIDDEN: Задание ${op.taskId} недоступно`);
        } else if (res.status === 401) {
          // Unauthorized (session expired)
          await repo.updatePendingOperationStatus(op.id, "PENDING");
          report.errors.push("401 UNAUTHORIZED: Требуется повторный вход");
          break; // Stop draining outbox on invalid session
        } else {
          // Other server or validation error
          await repo.updatePendingOperationStatus(op.id, "PENDING");
          report.failed++;
          report.errors.push(`HTTP ${res.status}`);
          break; // Back off on server error
        }
      } catch (networkErr: any) {
        // Logout already cleared this user's queue; never write it back.
        if (!isCurrentSession(generation)) break;
        // Network connection error - keep operation as PENDING for retry
        await repo.updatePendingOperationStatus(op.id, "PENDING");
        report.errors.push(networkErr.message || "Network offline");
        break; // Stop draining while offline
      } finally {
        clearTimeout(timer);
        parentSignal.removeEventListener("abort", abort);
      }
    }
  } finally {
    isFlushing = false;
  }

  return report;
}
