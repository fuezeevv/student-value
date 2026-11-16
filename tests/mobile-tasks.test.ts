import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { testEnvironment } from "../scripts/test-db.mjs";
import { NextRequest } from "next/server";

const env = testEnvironment();
for (const [k, v] of Object.entries(env)) {
  process.env[k] = v;
}

describe("Mobile Tasks & Scoped Audience API", () => {
  let prisma: any;
  let handleGetMobileTasks: any;
  let hashToken: any;

  const validToken = randomBytes(32).toString("base64url");
  const testUserId = `test-user-tasks-${randomBytes(4).toString("hex")}`;
  const testGroupId = "test-group";

  beforeAll(async () => {
    const dbModule = await import("../src/lib/db/prisma");
    prisma = dbModule.prisma;
    const authModule = await import("../src/lib/auth/google");
    hashToken = authModule.hashToken;
    const tasksModule = await import("../src/server/adapters/mobile-tasks");
    handleGetMobileTasks = tasksModule.handleGetMobileTasks;

    // Create user with valid mobile bearer session
    await prisma.user.create({
      data: {
        id: testUserId,
        nickname: `TaskTester_${testUserId}`,
      },
    });

    await prisma.session.create({
      data: {
        userId: testUserId,
        tokenHash: hashToken(validToken),
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
        userAgent: "StudentValue-Mobile/1.0",
      },
    });

    await prisma.groupMember.create({
      data: {
        groupId: testGroupId,
        userId: testUserId,
        isOwner: false,
      },
    });

    await prisma.enrollment.create({
      data: {
        groupId: testGroupId,
        userId: testUserId,
        fullName: `Task Student ${testUserId}`,
        status: "VERIFIED",
      },
    });
  });

  it("rejects guest requests without group parameter with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/tasks");
    const res = await handleGetMobileTasks(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("MISSING_GROUP");
  });

  it("rejects guest requests with non-existent group code with 404", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/tasks?group=non-existent-99999");
    const res = await handleGetMobileTasks(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("GROUP_NOT_FOUND");
  });

  it("returns published group tasks for guest with confirmed deadlines and no private progress", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/tasks?group=5130901/40102");
    const res = await handleGetMobileTasks(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.tasks)).toBe(true);

    for (const t of body.tasks) {
      expect(t.id).toBeTruthy();
      expect(t.title).toBeTruthy();
      expect(t.subject).toBeTruthy();
      // Guest projection must NEVER include student progress
      expect(t.progress).toBeNull();
      if (t.deadline) {
        expect(t.deadline.dateMoscowStr).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
      }
    }
  });

  it("returns student-scoped tasks with personal progress for authenticated mobile user", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/tasks", {
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    });
    const res = await handleGetMobileTasks(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.tasks)).toBe(true);
  });
});
