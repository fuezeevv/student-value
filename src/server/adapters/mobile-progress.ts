import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMobileSessionUser } from "./mobile-auth";
import { updateOwnProgress } from "@/server/domain/progress";
import { taskVisibilityWhere } from "@/server/domain/access";
import { ForbiddenError, UnauthorizedError } from "@/lib/permissions/checker";
import { prisma } from "@/lib/db/prisma";

const progressSchema = z.object({
  operationId: z.string().uuid(),
  taskId: z.string().min(1).max(100),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "READY", "SUBMITTED"]),
  notes: z.string().max(10000).optional(),
  createdAt: z.string().datetime().optional(),
});

export async function handleMobileProgress(
  request: NextRequest,
): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Authorization header required" },
      { status: 401 },
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const user = await getMobileSessionUser(token);
  if (!user) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid or expired session" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { operationId, taskId, status, notes, createdAt } = parsed.data;

  // 1. Check Idempotency Journal: if this operationId was already executed
  const existingLog = await prisma.auditLog.findUnique({
    where: { id: operationId },
  });

  if (existingLog) {
    if (existingLog.userId !== user.id) {
      return NextResponse.json(
        {
          error: "OPERATION_USER_MISMATCH",
          message: "Operation ID does not belong to user",
        },
        { status: 403 },
      );
    }
    const details = existingLog.details as any;
    return NextResponse.json({
      success: true,
      operationId,
      replayed: true,
      progress: details?.progressSnapshot ?? null,
    });
  }

  // 2. Out-of-order check: do not overwrite a newer progress state with a delayed older operation
  const currentProgress = await prisma.studentTaskProgress.findUnique({
    where: { taskId_userId: { taskId, userId: user.id } },
  });

  if (
    createdAt &&
    currentProgress &&
    currentProgress.updatedAt.getTime() > new Date(createdAt).getTime()
  ) {
    const currentSnapshot = {
      taskId: currentProgress.taskId,
      userId: currentProgress.userId,
      status: currentProgress.status,
      isVerified: currentProgress.isVerified,
      studentNotes: currentProgress.studentNotes,
      completedAt: currentProgress.completedAt?.toISOString() ?? null,
      updatedAt: currentProgress.updatedAt.toISOString(),
    };

    // Save audit entry so repeat retries of this old op are also recognized as superseded
    await prisma.auditLog
      .create({
        data: {
          id: operationId,
          userId: user.id,
          action: "MOBILE_PROGRESS_OPERATION",
          entityType: "Task",
          entityId: taskId,
          details: {
            taskId,
            status,
            superseded: true,
            progressSnapshot: currentSnapshot,
          },
        },
      })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      operationId,
      superseded: true,
      progress: currentSnapshot,
    });
  }

  try {
    const updated = await updateOwnProgress(user, taskId, status, notes);
    const progressSnapshot = {
      taskId: updated.taskId,
      userId: updated.userId,
      status: updated.status,
      isVerified: updated.isVerified,
      studentNotes: updated.studentNotes,
      completedAt: updated.completedAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    };

    // Record the executed operation in the Idempotency Journal
    await prisma.auditLog
      .create({
        data: {
          id: operationId,
          userId: user.id,
          action: "MOBILE_PROGRESS_OPERATION",
          entityType: "Task",
          entityId: taskId,
          details: {
            taskId,
            status,
            progressSnapshot,
          },
        },
      })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      operationId,
      progress: progressSnapshot,
    });
  } catch (err: any) {
    if (err instanceof ForbiddenError || err.statusCode === 403) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: err.message },
        { status: 403 },
      );
    }
    if (err instanceof UnauthorizedError || err.statusCode === 401) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: err.message },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        error: "PROGRESS_UPDATE_FAILED",
        message: err.message || "Failed to update progress",
      },
      { status: 500 },
    );
  }
}

export async function handleGetMobileProgress(
  request: NextRequest,
): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const user = await getMobileSessionUser(token);
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const visibleTasksWhere = await taskVisibilityWhere(user);

  const taskId = request.nextUrl.searchParams.get("taskId");
  if (taskId) {
    const row = await prisma.studentTaskProgress.findFirst({
      where: {
        taskId,
        userId: user.id,
        task: visibleTasksWhere,
      },
    });
    if (!row) {
      return NextResponse.json({ progress: null });
    }
    return NextResponse.json({
      progress: {
        taskId: row.taskId,
        userId: row.userId,
        status: row.status,
        isVerified: row.isVerified,
        studentNotes: row.studentNotes,
        completedAt: row.completedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  }

  const rows = await prisma.studentTaskProgress.findMany({
    where: {
      userId: user.id,
      task: visibleTasksWhere,
    },
  });

  return NextResponse.json({
    progressList: rows.map((r) => ({
      taskId: r.taskId,
      userId: r.userId,
      status: r.status,
      isVerified: r.isVerified,
      studentNotes: r.studentNotes,
      completedAt: r.completedAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}
