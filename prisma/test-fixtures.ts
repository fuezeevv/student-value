import { PrismaClient } from "@prisma/client";
const url = new URL(process.env.DATABASE_URL!);
if (
  process.env.SV_TEST_ISOLATED !== "1" ||
  !/^\/studentvalue_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Fixtures require isolated test database");
const p = new PrismaClient();
async function main() {
  const group = await p.studyGroup.upsert({
    where: { id: "test-group" },
    update: {},
    create: {
      id: "test-group",
      code: "TEST-ONLY",
      name: "Изолированные данные тестов",
    },
  });
  const other = await p.studyGroup.upsert({
    where: { id: "test-other-group" },
    update: {},
    create: {
      id: "test-other-group",
      code: "TEST-OTHER",
      name: "Другая тестовая группа",
    },
  });
  for (const [id, nickname, owner] of [
    ["user-dev-owner", "test_headman", true],
    ["user-dev-student", "test_student", false],
    ["test-peer", "test_peer", false],
  ] as const) {
    await p.user.upsert({
      where: { id },
      update: { nickname },
      create: { id, nickname },
    });
    await p.authIdentity.upsert({
      where: {
        provider_providerUserId: { provider: "LOCAL_DEV", providerUserId: id },
      },
      update: {},
      create: { userId: id, provider: "LOCAL_DEV", providerUserId: id },
    });
    await p.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: id } },
      update: { isOwner: owner },
      create: { groupId: group.id, userId: id, isOwner: owner },
    });
    await p.enrollment.upsert({
      where: { groupId_userId: { groupId: group.id, userId: id } },
      update: { subgroup: id === "test-peer" ? 2 : 1 },
      create: {
        groupId: group.id,
        userId: id,
        fullName: `PRIVATE ${id}`,
        subgroup: id === "test-peer" ? 2 : 1,
        status: "VERIFIED",
      },
    });
  }
  await p.semester.upsert({
    where: { id: "test-semester" },
    update: {},
    create: {
      id: "test-semester",
      name: "Тестовый семестр",
      number: 1,
      isCurrent: true,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2027-01-01"),
    },
  });
  await p.courseDefinition.upsert({
    where: { code: "TEST" },
    update: {},
    create: {
      id: "test-course-def",
      code: "TEST",
      title: "Тестовая дисциплина",
      shortTitle: "Тест",
    },
  });
  for (const [id, gid] of [
    ["test-course", group.id],
    ["test-other-course", other.id],
  ]) {
    await p.courseOffering.upsert({
      where: { id },
      update: {},
      create: {
        id,
        courseDefinitionId: "test-course-def",
        semesterId: "test-semester",
      },
    });
    await p.courseOfferingGroup.upsert({
      where: {
        courseOfferingId_groupId: { courseOfferingId: id, groupId: gid },
      },
      update: {},
      create: { courseOfferingId: id, groupId: gid },
    });
  }
  for (const [id, courseId] of [
    ["task-otu-lab1", "test-course"],
    ["test-subgroup-task", "test-course"],
    ["test-individual-task", "test-course"],
    ["test-foreign-task", "test-other-course"],
    ["test-draft-task", "test-course"],
    ["test-no-audience", "test-course"],
  ]) {
    await p.task.upsert({
      where: { id },
      update: {},
      create: {
        id,
        courseOfferingId: courseId,
        title: `[TEST] ${id}`,
        type: "LABORATORY",
        status: id === "test-draft-task" ? "DRAFT" : "PUBLISHED",
        createdById: "user-dev-owner",
        updatedById: "user-dev-owner",
      },
    });
    if (id !== "test-no-audience") {
      const peer = await p.enrollment.findUniqueOrThrow({
        where: { groupId_userId: { groupId: group.id, userId: "test-peer" } },
      });
      await p.taskAudience.upsert({
        where: { id: `aud-${id}` },
        update: {},
        create: {
          id: `aud-${id}`,
          taskId: id,
          targetType:
            id === "test-subgroup-task"
              ? "SUBGROUP"
              : id === "test-individual-task"
                ? "INDIVIDUAL"
                : "GROUP",
          groupId: courseId === "test-other-course" ? other.id : group.id,
          subgroupNumber: id === "test-subgroup-task" ? 2 : null,
          enrollmentId: id === "test-individual-task" ? peer.id : null,
        },
      });
    }
  }
  for (const userId of ["user-dev-student", "test-peer"]) {
    await p.studentTaskProgress.upsert({
      where: { taskId_userId: { taskId: "task-otu-lab1", userId } },
      update: {
        status: "NOT_STARTED",
        studentNotes: null,
        isVerified: false,
        verifiedById: null,
        verifiedAt: null,
        verificationSource: null,
        verificationSourceReferenceId: null,
        acceptedAt: null,
        submittedAt: null,
      },
      create: { taskId: "task-otu-lab1", userId, status: "NOT_STARTED" },
    });
  }
  await p.taskVariant.upsert({
    where: {
      taskId_variantNumber: { taskId: "task-otu-lab1", variantNumber: "99" },
    },
    update: {},
    create: {
      taskId: "task-otu-lab1",
      variantNumber: "99",
      title: "Чужой вариант",
    },
  });
  await p.source.upsert({
    where: { id: "test-teacher-source" },
    update: {},
    create: {
      id: "test-teacher-source",
      groupId: group.id,
      type: "TEACHER_STATEMENT",
      title: "[TEST] Преподаватель подтвердил результат",
    },
  });
  await p.sourceReference.upsert({
    where: { id: "test-evidence" },
    update: {},
    create: {
      id: "test-evidence",
      sourceId: "test-teacher-source",
      entityType: "TASK_PROGRESS",
      entityId: "task-otu-lab1:test-peer",
      confidence: "CONFIRMED",
      quoteText: "[TEST] Работа студента test-peer принята преподавателем",
      createdById: "user-dev-owner",
    },
  });
}
main().finally(() => p.$disconnect());
