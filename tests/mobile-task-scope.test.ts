import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db/prisma";
import { hashToken } from "../src/lib/auth/google";
import { handleGetMobileTasks } from "../src/server/adapters/mobile-tasks";

const token = randomBytes(32).toString("base64url");
const ownTask = randomUUID();
const publicTask = randomUUID();
const publicGroupCode = "5130901/40101";
const request = (group: string, bearer?: string) =>
  new NextRequest(
    `http://localhost:3000/api/v1/tasks?group=${encodeURIComponent(group)}`,
    {
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    },
  );

beforeAll(async () => {
  await prisma.session.create({
    data: {
      userId: "user-dev-student",
      tokenHash: hashToken(token),
      userAgent: "StudentValue-Mobile/1.0",
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  await prisma.task.create({
    data: {
      id: ownTask,
      title: "[TEST] Own group only",
      courseOfferingId: "test-course",
      type: "LABORATORY",
      createdById: "user-dev-owner",
      updatedById: "user-dev-owner",
      audiences: { create: { targetType: "GROUP", groupId: "test-group" } },
    },
  });
  const group = await prisma.studyGroup.upsert({
    where: { code: publicGroupCode },
    update: {},
    create: { code: publicGroupCode, name: "[TEST] public group" },
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
  const material = await prisma.courseMaterial.create({
    data: {
      courseOfferingId: course.id,
      title: "[TEST] Public material title",
      type: "METHODOLOGY",
      url: "https://example.invalid/private-original",
      file: {
        create: {
          filename: "private.pdf",
          mimeType: "application/pdf",
          byteSize: 1,
          sha256: "a".repeat(64),
          content: Buffer.from("x"),
        },
      },
    },
  });
  await prisma.task.create({
    data: {
      id: publicTask,
      title: "[TEST] Public group work",
      courseOfferingId: course.id,
      type: "LABORATORY",
      createdById: "user-dev-owner",
      updatedById: "user-dev-owner",
      audiences: { create: { targetType: "GROUP", groupId: group.id } },
      materials: { create: { materialId: material.id } },
      deadlines: {
        create: {
          courseOfferingId: course.id,
          createdById: "user-dev-owner",
          date: new Date("2026-12-01T20:59:59Z"),
          provenance: "UNKNOWN",
        },
      },
    },
  });
});

describe("Mobile task API respects selected group and public projection", () => {
  it("does not substitute the student's own tasks when another group's timetable is selected", async () => {
    const own = await handleGetMobileTasks(request("TEST-ONLY", token));
    expect(
      (await own.json()).tasks.some(
        (task: { id: string }) => task.id === ownTask,
      ),
    ).toBe(true);
    const other = await handleGetMobileTasks(request(publicGroupCode, token));
    const tasks = (await other.json()).tasks;
    expect(tasks.some((task: { id: string }) => task.id === ownTask)).toBe(
      false,
    );
    expect(tasks.some((task: { id: string }) => task.id === publicTask)).toBe(
      true,
    );
  });
  it("publishes titles but no file descriptor, progress, private URL or unverified deadline to guests", async () => {
    const response = await handleGetMobileTasks(request(publicGroupCode));
    const task = (await response.json()).tasks.find(
      (row: { id: string }) => row.id === publicTask,
    );
    expect(task.material).toBeNull();
    expect(task.progress).toBeNull();
    expect(task.deadline).toBeNull();
    expect(task.materialTitles).toEqual(["[TEST] Public material title"]);
    expect(JSON.stringify(task)).not.toContain("private.pdf");
    expect(JSON.stringify(task)).not.toContain("example.invalid");
  });
  it("does not silently downgrade an invalid bearer to a guest", async () => {
    expect(
      (await handleGetMobileTasks(request(publicGroupCode, "x".repeat(43))))
        .status,
    ).toBe(401);
  });
});
