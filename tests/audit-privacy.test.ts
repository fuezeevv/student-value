import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { redactGroupAudit } from "../src/server/domain/audit-privacy";
import { prisma } from "../src/lib/db/prisma";
import { verifyProgress } from "../src/server/domain/progress";
import type { SessionUser } from "../src/lib/auth/session";
describe("Private notes remain private during independent verification", () => {
  it("redacts nested legacy private fields while preserving meaningful academic history", () => {
    expect(
      redactGroupAudit({
        before: {
          status: "READY",
          studentNotes: "secret",
          nested: [
            {
              refreshTokenEncrypted: "cipher",
              tokenHash: "secret",
              date: "date",
            },
          ],
        },
        after: { status: "ACCEPTED" },
      }),
    ).toEqual({
      before: { status: "READY", nested: [{ date: "date" }] },
      after: { status: "ACCEPTED" },
    });
  });
  it("never stores another student's personal notes in a group-visible verification audit", async () => {
    const owner: SessionUser = {
      id: "user-dev-owner",
      groupId: "test-group",
      nickname: "[TEST] Owner",
      avatarUrl: null,
      bio: null,
      isOwner: true,
      isSystemAdmin: false,
      permissions: [],
    };
    const task = await prisma.task.create({
      data: {
        courseOfferingId: "test-course",
        title: "[TEST] Private verification " + randomUUID(),
        type: "HOMEWORK",
        createdById: owner.id,
        updatedById: owner.id,
        audiences: { create: { targetType: "GROUP", groupId: owner.groupId } },
      },
    });
    const secret = "[TEST] PRIVATE_NOTE_ONLY_AUTHOR " + randomUUID();
    await prisma.studentTaskProgress.create({
      data: {
        taskId: task.id,
        userId: "test-peer",
        studentNotes: secret,
        status: "READY",
      },
    });
    await verifyProgress(
      owner,
      task.id,
      "test-peer",
      true,
      "HEADMAN_CONFIRMED",
      undefined,
      {
        type: "TEACHER_STATEMENT",
        title: "[TEST] Independent result",
        quoteText:
          "[TEST] Teacher explicitly accepted this other student's result",
      },
    );
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        action: "VERIFY_PROGRESS",
        details: { path: ["groupId"], equals: owner.groupId },
        entityId: (
          await prisma.studentTaskProgress.findUniqueOrThrow({
            where: { taskId_userId: { taskId: task.id, userId: "test-peer" } },
          })
        ).id,
      },
    });
    expect(JSON.stringify(audit.details)).not.toContain(secret);
    expect(
      await prisma.studentTaskProgress.findUnique({
        where: { taskId_userId: { taskId: task.id, userId: "test-peer" } },
      }),
    ).toMatchObject({ studentNotes: secret, status: "ACCEPTED" });
  });
});
