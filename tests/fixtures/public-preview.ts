import { PrismaClient, type Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { publicGroups } from "../../src/lib/groups/public-groups";
import {
  requestedWeek,
  addDays,
  parseRuzWeek,
} from "../../src/lib/schedule/ruz";
export const previewFixture = {
  groupId: "test-preview-5130901-40102",
  courseId: "test-preview-course",
  taskId: "test-preview-public",
  materialId: "test-preview-material",
  slug: "5130901-40102",
};
export async function seedPublicPreview(p: PrismaClient) {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    process.env.SV_TEST_ISOLATED !== "1" ||
    !/^\/studentvalue_test_[a-z0-9_]+$/.test(url.pathname)
  )
    throw Error("Public preview fixtures require an isolated database");
  const now = new Date(),
    week = requestedWeek(undefined, now);
  for (const g of publicGroups) {
    const id = `test-preview-${g.code.replace("/", "-")}`;
    const stored = await p.studyGroup.upsert({
      where: { code: g.code },
      update: { code: g.code, ruzGroupId: g.ruzId },
      create: {
        id,
        code: g.code,
        name: `[TEST] ${g.track} ${g.label}`,
        ruzGroupId: g.ruzId,
      },
    });
    if (g.code === "5130901/40102") previewFixture.groupId = stored.id;
    const payload = parseRuzWeek(
      {
        week: {
          date_start: week.replaceAll("-", "."),
          date_end: addDays(week, 6).replaceAll("-", "."),
        },
        group: { id: g.ruzId, name: g.code, faculty: { id: 125 } },
        days: [
          {
            date: addDays(week, 3),
            lessons: [
              {
                subject: "[TEST] Открытое расписание",
                time_start: "10:00",
                time_end: "11:40",
                groups: [{ id: g.ruzId, name: g.code }],
              },
            ],
          },
        ],
      },
      g.ruzId,
      g.code,
      week,
    );
    await p.ruzScheduleCache.upsert({
      where: { groupId_weekStart: { groupId: stored.id, weekStart: week } },
      create: {
        groupId: stored.id,
        weekStart: week,
        payload: payload as unknown as Prisma.InputJsonValue,
        fetchedAt: now,
      },
      update: {
        payload: payload as unknown as Prisma.InputJsonValue,
        fetchedAt: now,
        retryAfter: null,
        leaseUntil: null,
      },
    });
  }
  await p.courseOffering.upsert({
    where: { id: previewFixture.courseId },
    update: { status: "ACTIVE", mergedIntoId: null },
    create: {
      id: previewFixture.courseId,
      courseDefinitionId: "test-course-def",
      semesterId: "test-semester",
      groups: { create: { groupId: previewFixture.groupId } },
    },
  });
  for (const kind of [
    "public",
    "draft",
    "archived",
    "subgroup",
    "individual",
    "foreign",
    "missing",
    "mixed",
    "malformed",
    "all-course",
  ]) {
    const id = `test-preview-${kind}`;
    await p.task.upsert({
      where: { id },
      update: {
        status:
          kind === "draft"
            ? "DRAFT"
            : kind === "archived"
              ? "ARCHIVED"
              : "PUBLISHED",
      },
      create: {
        id,
        courseOfferingId: previewFixture.courseId,
        title: `[TEST] ${kind === "public" ? "Открытая лабораторная" : kind}`,
        description:
          kind === "public"
            ? "[TEST] Общее описание задания"
            : "[TEST] Private task description",
        type: "LABORATORY",
        status:
          kind === "draft"
            ? "DRAFT"
            : kind === "archived"
              ? "ARCHIVED"
              : "PUBLISHED",
        createdById: "user-dev-owner",
        updatedById: "user-dev-owner",
      },
    });
    if (kind !== "missing")
      await p.taskAudience.upsert({
        where: { id: `aud-${id}` },
        update: {},
        create: {
          id: `aud-${id}`,
          taskId: id,
          targetType:
            kind === "subgroup"
              ? "SUBGROUP"
              : kind === "individual"
                ? "INDIVIDUAL"
                : kind === "all-course"
                  ? "ALL_COURSE"
                  : "GROUP",
          groupId:
            kind === "all-course"
              ? null
              : kind === "foreign"
                ? "test-other-group"
                : previewFixture.groupId,
          subgroupNumber: ["subgroup", "malformed"].includes(kind) ? 2 : null,
        },
      });
  }
  await p.taskAudience.upsert({
    where: { id: "aud-test-preview-mixed-personal" },
    update: {},
    create: {
      id: "aud-test-preview-mixed-personal",
      taskId: "test-preview-mixed",
      targetType: "INDIVIDUAL",
    },
  });
  const deadlineId = "test-preview-deadline";
  await p.source.upsert({
    where: { id: "test-preview-source" },
    update: {},
    create: {
      id: "test-preview-source",
      groupId: previewFixture.groupId,
      title: "[TEST] Private source content",
      type: "TEACHER_STATEMENT",
    },
  });
  await p.sourceReference.upsert({
    where: { id: "test-preview-deadline-ref" },
    update: {},
    create: {
      id: "test-preview-deadline-ref",
      sourceId: "test-preview-source",
      entityType: "DEADLINE",
      entityId: deadlineId,
      quoteText: "[TEST] PRIVATE ORIGINAL QUOTE",
      confidence: "CONFIRMED",
    },
  });
  await p.deadline.upsert({
    where: { id: deadlineId },
    update: {},
    create: {
      id: deadlineId,
      taskId: previewFixture.taskId,
      courseOfferingId: previewFixture.courseId,
      date: new Date(now.getTime() + 7 * 86400000),
      title: "[TEST] Сдать работу",
      createdById: "user-dev-owner",
      provenance: "TEACHER",
      sourceReferenceId: "test-preview-deadline-ref",
    },
  });
  await p.deadline.upsert({
    where: { id: "test-preview-unknown-date" },
    update: {},
    create: {
      id: "test-preview-unknown-date",
      taskId: previewFixture.taskId,
      courseOfferingId: previewFixture.courseId,
      date: new Date(now.getTime() + 86400000),
      title: "[TEST] PRIVATE UNKNOWN DATE",
      createdById: "user-dev-owner",
    },
  });
  await p.courseMaterial.upsert({
    where: { id: previewFixture.materialId },
    update: {},
    create: {
      id: previewFixture.materialId,
      courseOfferingId: previewFixture.courseId,
      title: "[TEST] Методичка",
      type: "METHODOLOGY",
      url: "/materials/test-preview-material",
      description: "[TEST] PRIVATE MATERIAL DESCRIPTION",
      sourceNote: "[TEST] PRIVATE MATERIAL SOURCE",
    },
  });
  await p.taskMaterial.upsert({
    where: {
      taskId_materialId: {
        taskId: previewFixture.taskId,
        materialId: previewFixture.materialId,
      },
    },
    update: {},
    create: {
      taskId: previewFixture.taskId,
      materialId: previewFixture.materialId,
    },
  });
  const content = Buffer.from("[TEST] PRIVATE ORIGINAL FILE BYTES");
  await p.materialFile.upsert({
    where: { materialId: previewFixture.materialId },
    update: {},
    create: {
      materialId: previewFixture.materialId,
      filename: "private-original.txt",
      mimeType: "text/plain",
      byteSize: content.length,
      content,
      sha256: createHash("sha256").update(content).digest("hex"),
    },
  });
  await p.studentTaskProgress.upsert({
    where: {
      taskId_userId: {
        taskId: previewFixture.taskId,
        userId: "user-dev-student",
      },
    },
    update: {},
    create: {
      taskId: previewFixture.taskId,
      userId: "user-dev-student",
      status: "READY",
      studentNotes: "[TEST] PRIVATE STUDENT NOTE",
    },
  });
  await p.taskVariant.upsert({
    where: {
      taskId_variantNumber: {
        taskId: previewFixture.taskId,
        variantNumber: "private-guest-test",
      },
    },
    update: {},
    create: {
      taskId: previewFixture.taskId,
      variantNumber: "private-guest-test",
      title: "[TEST] PRIVATE VARIANT",
      spec: { text: "[TEST] PRIVATE VARIANT CONTENT" },
    },
  });
}
if (process.argv[1]?.endsWith("tests/fixtures/public-preview.ts")) {
  const p = new PrismaClient();
  seedPublicPreview(p).finally(() => p.$disconnect());
}
