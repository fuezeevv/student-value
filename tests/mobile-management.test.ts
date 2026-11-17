import { describe, it, expect } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db/prisma";
import { hashToken } from "../src/lib/auth/google";
import { handleMobileManagement } from "../src/server/adapters/mobile-management";
async function tokenFor(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "StudentValue-Mobile/1.0",
    },
  });
  return token;
}
function request(token?: string, body?: unknown, group?: string) {
  return new NextRequest(
    `http://localhost/api/v1/manage${group ? `?group=${encodeURIComponent(group)}` : ""}`,
    {
      method: body ? "POST" : "GET",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }
        : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
}
describe("native management uses existing scoped domains", () => {
  it("rejects guests and ordinary students", async () => {
    expect((await handleMobileManagement(request())).status).toBe(401);
    const user = await prisma.user.create({
      data: { nickname: `[TEST] management ${randomUUID()}` },
    });
    await prisma.groupMember.create({
      data: { userId: user.id, groupId: "test-group" },
    });
    await prisma.enrollment.create({
      data: {
        groupId: "test-group",
        userId: user.id,
        fullName: `[TEST] management ${user.id}`,
        status: "VERIFIED",
      },
    });
    const token = await tokenFor(user.id);
    expect((await handleMobileManagement(request(token))).status).toBe(403);
    expect(
      (
        await handleMobileManagement(
          request(token, {
            action: "archive",
            id: "task-otu-lab1",
            value: true,
            reason: "Test forbidden",
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("does not turn an arbitrary timetable selection into management membership", async () => {
    const token = await tokenFor("user-dev-owner");
    expect(
      (
        await handleMobileManagement(
          request(token, undefined, "not-a-membership"),
        )
      ).status,
    ).toBe(403);
  });
  it("archives/restores a scoped task through the audited domain without deleting its row", async () => {
    const token = await tokenFor("user-dev-owner");
    const task = await prisma.task.create({
      data: {
        title: `[TEST] native management ${randomUUID()}`,
        type: "LABORATORY",
        courseOfferingId: "test-course",
        createdById: "user-dev-owner",
        updatedById: "user-dev-owner",
        audiences: { create: { targetType: "GROUP", groupId: "test-group" } },
      },
    });
    expect((await handleMobileManagement(request(token))).status).toBe(200);
    const body = {
      action: "archive",
      id: task.id,
      value: true,
      reason: "Isolated management regression",
    };
    expect((await handleMobileManagement(request(token, body))).status).toBe(
      200,
    );
    expect(
      (await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status,
    ).toBe("ARCHIVED");
    expect((await handleMobileManagement(request(token, body))).status).toBe(
      200,
    );
    expect(
      await prisma.auditLog.count({
        where: { entityId: task.id, action: "ARCHIVE_TASK" },
      }),
    ).toBe(1);
    expect(
      (await handleMobileManagement(request(token, { ...body, value: false })))
        .status,
    ).toBe(200);
    expect(
      (await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status,
    ).toBe("PUBLISHED");
    expect(
      await prisma.auditLog.count({
        where: { entityId: task.id, action: "RESTORE_TASK" },
      }),
    ).toBe(1);
  });
});
