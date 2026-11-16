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
): Promise<{ operationId: string; optimisticProgress: UserTaskProgress }> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Необходима авторизация для отметки выполнения");
  }

  const repo = getTimetableRepository();
  const operationId = Crypto.randomUUID();
  const now = new Date().toISOString();

  const optimisticProgress: UserTaskProgress = {
    userId: user.id,
    taskId,
    status,
    isVerified: false,
    studentNotes: notes ?? null,
    completedAt: status === "READY" ? now : null,
    updatedAt: now,
    syncState: "PENDING_SYNC",
  };

  await repo.saveUserProgress(optimisticProgress);

  const op: PendingOperation = {
    id: operationId,
    userId: user.id,
    taskId,
    action: "SET_STATUS",
    payload: { status, notes },
    createdAt: now,
    status: "PENDING",
  };

  await repo.addPendingOperation(op);

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
    return { processed: 0, succeeded: 0, failed: 0, errors: ["ALREADY_FLUSHING"] };
  }

  isFlushing = true;
  const report: FlushReport = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  try {
    const user = await getSessionUser();
    const token = await getSessionToken();

    if (!user || !token) {
      return report;
    }

    const repo = getTimetableRepository();
    const pendingOps = await repo.getPendingOperations(user.id);
    const baseUrl = await getActiveApiOrigin();

    for (const op of pendingOps) {
      report.processed++;
      await repo.updatePendingOperationStatus(op.id, "SYNCING");

      try {
        const res = await fetch(`${baseUrl}/api/v1/progress`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            operationId: op.id,
            taskId: op.taskId,
            status: op.payload.status || "READY",
            notes: op.payload.notes,
            createdAt: op.createdAt,
          }),
        });

        if (res.status === 200) {
          const data = await res.json();
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
        // Network connection error - keep operation as PENDING for retry
        await repo.updatePendingOperationStatus(op.id, "PENDING");
        report.errors.push(networkErr.message || "Network offline");
        break; // Stop draining while offline
      }
    }
  } finally {
    isFlushing = false;
  }

  return report;
}
