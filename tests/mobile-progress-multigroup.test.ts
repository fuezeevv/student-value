import { describe, it, expect } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db/prisma";
import { hashToken } from "../src/lib/auth/google";
import {
  handleMobileProgress,
  handleGetMobileProgress,
} from "../src/server/adapters/mobile-progress";
describe("mobile own progress across actual memberships", () => {
  it("uses an explicitly enrolled second group and refuses a fabricated group selection", async () => {
    const user = await prisma.user.create({
      data: { nickname: `[TEST] multi ${randomUUID()}` },
    });
    await prisma.groupMember.create({
      data: {
        userId: user.id,
        groupId: "test-group",
        joinedAt: new Date("2025-01-01"),
      },
    });
    await prisma.enrollment.create({
      data: {
        userId: user.id,
        groupId: "test-group",
        fullName: `[TEST] primary ${user.id}`,
        status: "VERIFIED",
      },
    });
    const group = await prisma.studyGroup.create({
      data: { code: `test-${randomUUID()}`, name: "[TEST] secondary" },
    });
    await prisma.groupMember.create({
      data: { userId: user.id, groupId: group.id },
    });
    await prisma.enrollment.create({
      data: {
        userId: user.id,
        groupId: group.id,
        fullName: `[TEST] secondary ${user.id}`,
        status: "VERIFIED",
      },
    });
    const base = await prisma.courseOffering.findUniqueOrThrow({
      where: { id: "test-course" },
    });
    const course = await prisma.courseOffering.create({
      data: {
        courseDefinitionId: base.courseDefinitionId,
        semesterId: base.semesterId,
        groups: { create: { groupId: group.id } },
      },
    });
    const task = await prisma.task.create({
      data: {
        title: "[TEST] secondary work",
        type: "LABORATORY",
        courseOfferingId: course.id,
        createdById: "user-dev-owner",
        updatedById: "user-dev-owner",
        audiences: { create: { targetType: "GROUP", groupId: group.id } },
      },
    });
    const token = randomBytes(32).toString("base64url");
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60_000),
        userAgent: "StudentValue-Mobile/1.0",
      },
    });
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const write = (groupCode?: string) =>
      handleMobileProgress(
        new NextRequest("http://localhost/api/v1/progress", {
          method: "POST",
          headers,
          body: JSON.stringify({
            operationId: randomUUID(),
            taskId: task.id,
            status: "READY",
            groupCode,
          }),
        }),
      );
    expect((await write()).status).toBe(403);
    expect((await write("not-an-enrollment")).status).toBe(403);
    expect((await write(group.code)).status).toBe(200);
    const read = await handleGetMobileProgress(
      new NextRequest(
        `http://localhost/api/v1/progress?group=${encodeURIComponent(group.code)}&taskId=${task.id}`,
        { headers },
      ),
    );
    expect(read.status).toBe(200);
    expect((await read.json()).progress.status).toBe("READY");
    const denied = await handleGetMobileProgress(
      new NextRequest(
        "http://localhost/api/v1/progress?group=not-an-enrollment",
        { headers },
      ),
    );
    expect(denied.status).toBe(403);
  });
});
