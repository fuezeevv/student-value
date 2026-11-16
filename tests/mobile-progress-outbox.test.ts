import { describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db/prisma";
import { hashToken } from "../src/lib/auth/google";
import {
  handleMobileProgress,
  handleGetMobileProgress,
} from "../src/server/adapters/mobile-progress";

async function createTestStudent(nicknamePrefix: string, groupId = "test-group") {
  const suffix = randomBytes(4).toString("hex");
  const user = await prisma.user.create({
    data: { nickname: `[TEST] ${nicknamePrefix}-${suffix}` },
  });
  await prisma.groupMember.create({
    data: { userId: user.id, groupId, isOwner: false },
  });
  await prisma.enrollment.create({
    data: {
      groupId,
      userId: user.id,
      fullName: `[TEST] Student ${nicknamePrefix} ${suffix}`,
      status: "VERIFIED",
    },
  });

  const sessionToken = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
      userAgent: "StudentValue-Mobile/1.0",
    },
  });

  return { user, sessionToken };
}

async function createTestTask(targetGroupId = "test-group") {
  return prisma.task.create({
    data: {
      title: `[TEST] Task ${randomUUID()}`,
      type: "LABORATORY",
      courseOfferingId: "test-course",
      createdById: "user-dev-owner",
      updatedById: "user-dev-owner",
      audiences: {
        create: { targetType: "GROUP", groupId: targetGroupId },
      },
    },
  });
}

describe("Mobile Progress & Outbox Idempotency (Stage B)", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationId: randomUUID(),
        taskId: "task-otu-lab1",
        status: "READY",
      }),
    });
    const res = await handleMobileProgress(req);
    expect(res.status).toBe(401);
  });

  it("rejects task progress update when task is outside user audience (403 Forbidden)", async () => {
    const { sessionToken } = await createTestStudent("foreign-aud");
    const foreignGroup = await prisma.studyGroup.create({
      data: {
        id: "foreign-group-" + randomBytes(4).toString("hex"),
        code: "foreign-code-" + randomBytes(4).toString("hex"),
        name: "Foreign Group",
      },
    });
    // Task targeted to a different group
    const task = await createTestTask(foreignGroup.id);

    const req = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        operationId: randomUUID(),
        taskId: task.id,
        status: "READY",
      }),
    });
    const res = await handleMobileProgress(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("FORBIDDEN");
  });

  it("rejects self-acceptance (ACCEPTED status) at API boundary", async () => {
    const { sessionToken } = await createTestStudent("self-accept");
    const task = await createTestTask("test-group");

    const req = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        operationId: randomUUID(),
        taskId: task.id,
        status: "ACCEPTED",
      }),
    });
    const res = await handleMobileProgress(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION_FAILED");
  });

  it("marks task READY, awards XP, and protects against retry/toggle XP farming", async () => {
    const { user, sessionToken } = await createTestStudent("xp-farmer");
    const task = await createTestTask("test-group");
    const operationId1 = randomUUID();

    // 1. First execution: Mark READY
    const req1 = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        operationId: operationId1,
        taskId: task.id,
        status: "READY",
        notes: "Completed offline",
      }),
    });
    const res1 = await handleMobileProgress(req1);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);
    expect(json1.progress.status).toBe("READY");
    expect(json1.progress.isVerified).toBe(false);

    // Verify initial XP is 20
    const xp1 = await prisma.xpEvent.aggregate({
      where: { userId: user.id, taskId: task.id, ruleCode: { startsWith: "COMPLETION:" } },
      _sum: { points: true },
    });
    expect(xp1._sum.points).toBe(20);

    // 2. Retry execution with the same or repeated operation: XP must NOT double
    const reqRetry = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        operationId: operationId1, // Same retry
        taskId: task.id,
        status: "READY",
        notes: "Completed offline",
      }),
    });
    const resRetry = await handleMobileProgress(reqRetry);
    expect(resRetry.status).toBe(200);

    const xpRetry = await prisma.xpEvent.aggregate({
      where: { userId: user.id, taskId: task.id, ruleCode: { startsWith: "COMPLETION:" } },
      _sum: { points: true },
    });
    expect(xpRetry._sum.points).toBe(20); // Strict: Delta is 0, points remain 20!

    // 3. Unmark to IN_PROGRESS (e.g. accidental click undone)
    const reqUnmark = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        operationId: randomUUID(),
        taskId: task.id,
        status: "IN_PROGRESS",
      }),
    });
    const resUnmark = await handleMobileProgress(reqUnmark);
    expect(resUnmark.status).toBe(200);

    const xpUnmarked = await prisma.xpEvent.aggregate({
      where: { userId: user.id, taskId: task.id, ruleCode: { startsWith: "COMPLETION:" } },
      _sum: { points: true },
    });
    expect(xpUnmarked._sum.points).toBe(0); // Net XP is now 0

    // 4. Re-mark to READY
    const reqRemark = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        operationId: randomUUID(),
        taskId: task.id,
        status: "READY",
      }),
    });
    const resRemark = await handleMobileProgress(reqRemark);
    expect(resRemark.status).toBe(200);

    const xpRemarked = await prisma.xpEvent.aggregate({
      where: { userId: user.id, taskId: task.id, ruleCode: { startsWith: "COMPLETION:" } },
      _sum: { points: true },
    });
    expect(xpRemarked._sum.points).toBe(20); // Net XP is back to 20, never multiplied!
  });

  it("isolates data between two users", async () => {
    const studentA = await createTestStudent("user-a");
    const studentB = await createTestStudent("user-b");
    const task = await createTestTask("test-group");

    // Student A marks READY
    const reqA = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentA.sessionToken}`,
      },
      body: JSON.stringify({
        operationId: randomUUID(),
        taskId: task.id,
        status: "READY",
        notes: "Student A private note",
      }),
    });
    await handleMobileProgress(reqA);

    // Student B queries progress: must be null for Student B
    const reqB = new NextRequest(
      `http://localhost:3000/api/v1/progress?taskId=${task.id}`,
      {
        headers: {
          Authorization: `Bearer ${studentB.sessionToken}`,
        },
      },
    );
    const resB = await handleGetMobileProgress(reqB);
    expect(resB.status).toBe(200);
    const jsonB = await resB.json();
    expect(jsonB.progress).toBeNull();
  });

  it("enforces strong operationId idempotency and protects against out-of-order execution", async () => {
    const { user, sessionToken } = await createTestStudent("idempotency-user");
    const task = await createTestTask("test-group");
    const operationId = randomUUID();

    // 1. Initial execution
    const req1 = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        operationId,
        taskId: task.id,
        status: "READY",
        notes: "First run",
        createdAt: new Date().toISOString(),
      }),
    });
    const res1 = await handleMobileProgress(req1);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);
    expect(json1.operationId).toBe(operationId);
    expect(json1.progress.status).toBe("READY");

    // 2. Exact retry of operationId: must return replayed: true without mutating DB
    const reqRetry = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        operationId,
        taskId: task.id,
        status: "READY",
        notes: "First run",
        createdAt: new Date().toISOString(),
      }),
    });
    const resRetry = await handleMobileProgress(reqRetry);
    expect(resRetry.status).toBe(200);
    const jsonRetry = await resRetry.json();
    expect(jsonRetry.success).toBe(true);
    expect(jsonRetry.operationId).toBe(operationId);
    expect(jsonRetry.replayed).toBe(true);
    expect(jsonRetry.progress.status).toBe("READY");

    // 3. User unmarks task with a NEW operationId
    const unmarkOpId = randomUUID();
    const reqUnmark = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        operationId: unmarkOpId,
        taskId: task.id,
        status: "IN_PROGRESS",
        createdAt: new Date(Date.now() + 1000).toISOString(),
      }),
    });
    const resUnmark = await handleMobileProgress(reqUnmark);
    expect(resUnmark.status).toBe(200);
    const jsonUnmark = await resUnmark.json();
    expect(jsonUnmark.progress.status).toBe("IN_PROGRESS");

    // 4. Delayed/out-of-order operation with OLD timestamp (e.g. earlier READY retry from network queue)
    const delayedOpId = randomUUID();
    const reqDelayed = new NextRequest("http://localhost:3000/api/v1/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        operationId: delayedOpId,
        taskId: task.id,
        status: "READY",
        // Created 1 minute in the past, older than the unmark
        createdAt: new Date(Date.now() - 60000).toISOString(),
      }),
    });
    const resDelayed = await handleMobileProgress(reqDelayed);
    expect(resDelayed.status).toBe(200);
    const jsonDelayed = await resDelayed.json();
    expect(jsonDelayed.superseded).toBe(true);
    // Crucial check: status in database remains IN_PROGRESS, not reverted back to READY!
    expect(jsonDelayed.progress.status).toBe("IN_PROGRESS");
    const dbCheck = await prisma.studentTaskProgress.findUnique({
      where: { taskId_userId: { taskId: task.id, userId: user.id } },
    });
    expect(dbCheck?.status).toBe("IN_PROGRESS");
  });
});
