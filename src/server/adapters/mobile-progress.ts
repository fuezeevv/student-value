import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMobileSessionUser } from "./mobile-auth";
import { updateOwnProgressTx } from "@/server/domain/progress";
import {
  requireTaskAudience,
  taskVisibilityWhere,
} from "@/server/domain/access";
import { ForbiddenError, UnauthorizedError } from "@/lib/permissions/checker";
import { prisma } from "@/lib/db/prisma";

const progressSchema = z.object({
  operationId: z.string().uuid(),
  taskId: z.string().min(1).max(100),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "READY", "SUBMITTED"]),
  notes: z.string().max(10000).optional(),
  createdAt: z.string().datetime().optional(),
  baseUpdatedAt: z.string().datetime().nullable().optional(),
  dependsOnOperationId: z.string().uuid().optional(),
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

  const {
    operationId,
    taskId,
    status,
    notes,
    createdAt,
    baseUpdatedAt,
    dependsOnOperationId,
  } = parsed.data;

  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        taskId,
        status,
        notes: notes ?? null,
        baseUpdatedAt,
        dependsOnOperationId,
      }),
    )
    .digest("hex");

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Same lock as the domain mutation: serialize web and mobile writes per
        // student, including receipt lookup/creation, so a crash rolls back both.
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
        await requireTaskAudience(user, taskId, tx);
        const receipt = await tx.auditLog.findUnique({
          where: { id: operationId },
        });
        const current = await tx.studentTaskProgress.findUnique({
          where: { taskId_userId: { taskId, userId: user.id } },
        });
        if (receipt) {
          if (receipt.userId !== user.id) {
            return { error: "OPERATION_USER_MISMATCH", status: 403 } as const;
          }
          const details = receipt.details as { requestHash?: string } | null;
          if (
            receipt.action !== "MOBILE_PROGRESS_OPERATION" ||
            receipt.entityId !== taskId ||
            details?.requestHash !== requestHash
          ) {
            return {
              error: "OPERATION_PAYLOAD_MISMATCH",
              status: 409,
            } as const;
          }
          // Return CURRENT authorized state, never a historical private snapshot.
          return { progress: current, replayed: true, superseded: false };
        }

        if (dependsOnOperationId) {
          const predecessor = await tx.auditLog.findUnique({
            where: { id: dependsOnOperationId },
          });
          if (
            !predecessor ||
            predecessor.userId !== user.id ||
            predecessor.entityId !== taskId ||
            predecessor.action !== "MOBILE_PROGRESS_OPERATION"
          ) {
            return { error: "DEPENDENCY_NOT_APPLIED", status: 425 } as const;
          }
          const details = predecessor.details as {
            resultUpdatedAt?: string | null;
          };
          if (
            details.resultUpdatedAt !==
            (current?.updatedAt.toISOString() ?? null)
          ) {
            return { error: "PROGRESS_VERSION_CONFLICT", status: 409 } as const;
          }
        } else if (
          baseUpdatedAt !== undefined &&
          baseUpdatedAt !== (current?.updatedAt.toISOString() ?? null)
        ) {
          return { error: "PROGRESS_VERSION_CONFLICT", status: 409 } as const;
        }
        // Current clients use server versions and predecessor receipts. Only
        // legacy clients without either retain the old timestamp policy.
        const superseded = Boolean(
          baseUpdatedAt === undefined &&
          !dependsOnOperationId &&
          createdAt &&
          current &&
          current.updatedAt.getTime() > new Date(createdAt).getTime(),
        );
        const progress = superseded
          ? current
          : await updateOwnProgressTx(tx, user, taskId, status, notes);
        await tx.auditLog.create({
          data: {
            id: operationId,
            userId: user.id,
            action: "MOBILE_PROGRESS_OPERATION",
            entityType: "Task",
            entityId: taskId,
            // Notes stay solely in StudentTaskProgress, not the group audit log.
            details: {
              schemaVersion: 1,
              requestHash,
              taskId,
              status,
              superseded,
              resultUpdatedAt: progress?.updatedAt.toISOString() ?? null,
            },
          },
        });
        return { progress, replayed: false, superseded };
      },
      { timeout: 20000 },
    );

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    const row = result.progress;
    return NextResponse.json({
      success: true,
      operationId,
      replayed: result.replayed,
      superseded: result.superseded,
      progress: row
        ? {
            taskId: row.taskId,
            userId: row.userId,
            status: row.status,
            isVerified: row.isVerified,
            studentNotes: row.studentNotes,
            completedAt: row.completedAt?.toISOString() ?? null,
            updatedAt: row.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: err.message },
        { status: 403 },
      );
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "PROGRESS_UPDATE_FAILED" },
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
