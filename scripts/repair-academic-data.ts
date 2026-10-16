import { PrismaClient, Prisma } from "@prisma/client";
import { bootstrap } from "../prisma/bootstrap";
const p = new PrismaClient();
const repairId = "reliable-core-20261016-v1";
async function repairAdditionalEvidence() {
  const id = "reliable-core-20261016-evidence-v2";
  if (
    await p.auditLog.findFirst({
      where: { action: "ACADEMIC_REPAIR_COMPLETE", entityId: id },
    })
  )
    return;
  await p.$transaction(async (tx) => {
    const record = async (
      type: string,
      entityId: string,
      before: unknown,
      after: unknown,
      reason: string,
    ) =>
      tx.auditLog.create({
        data: {
          userId: "system-bootstrap",
          action: "ACADEMIC_DATA_REPAIR",
          entityType: type,
          entityId,
          details: {
            repairId: id,
            before: JSON.parse(JSON.stringify(before)),
            after: JSON.parse(JSON.stringify(after)),
            reason,
          },
        },
      });
    for (const annId of ["ann-sovd-variants", "ann-otu-lab4-info"]) {
      const a = await tx.announcement.findUnique({ where: { id: annId } });
      if (a && !a.sourceReferenceId) {
        await record(
          "ANNOUNCEMENT",
          annId,
          a,
          { status: "DRAFT" },
          "Утверждение прежнего seed не имеет первичного основания; сохранено как черновик, не выдаётся за факт преподавателя",
        );
        await tx.announcement.update({
          where: { id: annId },
          data: { status: "DRAFT" },
        });
      }
    }
    const ref = await tx.sourceReference.findUnique({
      where: { id: "ref-otu-lab4" },
    });
    if (ref) {
      await record(
        "SOURCE_REFERENCE",
        ref.id,
        ref,
        { confidence: "UNVERIFIED" },
        "Нет буквального первичного подтверждения реплики из старой документации",
      );
      await tx.sourceReference.update({
        where: { id: ref.id },
        data: { confidence: "UNVERIFIED" },
      });
    }
    const cad = await tx.announcement.findUnique({
      where: { id: "ann-cad-schedule-verified" },
    });
    if (cad && !cad.sourceReferenceId) {
      const r = await tx.sourceReference.create({
        data: {
          sourceId: "src-cad-schedule-doc",
          entityType: "ANNOUNCEMENT",
          entityId: cad.id,
          quoteText:
            "САПР, часть 1_упр_осень_2026 понедельник 12.00 – 14.00, 3-402",
          confidence: "CONFIRMED",
          createdById: "system-bootstrap",
        },
      });
      await record(
        "ANNOUNCEMENT",
        cad.id,
        cad,
        { sourceReferenceId: r.id },
        "Приложено основание расписания из шапки официальной ведомости",
      );
      await tx.announcement.update({
        where: { id: cad.id },
        data: { sourceReferenceId: r.id },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: "system-bootstrap",
        action: "ACADEMIC_REPAIR_COMPLETE",
        entityType: "REPAIR",
        entityId: id,
        details: {
          deletedRows: 0,
          notes:
            "Неподтверждённые объявления стали черновиками; САПР связан с документом",
        },
      },
    });
  });
}
async function scopeLegacyAudit() {
  const primary = await p.studyGroup.findUniqueOrThrow({
    where: { code: "5130901/40102" },
  });
  const logs = await p.auditLog.findMany();
  let count = 0;
  const courseGroup = async (courseId: string) => {
    const groups = await p.courseOfferingGroup.findMany({
      where: { courseOfferingId: courseId },
      select: { groupId: true },
    });
    return groups.length === 1 ? groups[0].groupId : undefined;
  };
  for (const log of logs) {
    const details =
      log.details &&
      typeof log.details === "object" &&
      !Array.isArray(log.details)
        ? (log.details as Record<string, Prisma.JsonValue>)
        : {};
    if (details.groupId) continue;
    let groupId: string | undefined;
    if (
      log.entityType === "REPAIR" &&
      log.entityId.startsWith("reliable-core-20261016")
    )
      groupId = primary.id;
    else if (log.entityType === "TASK") {
      const row = await p.task.findUnique({ where: { id: log.entityId } });
      if (row) groupId = await courseGroup(row.courseOfferingId);
    } else if (log.entityType === "DEADLINE") {
      const row = await p.deadline.findUnique({ where: { id: log.entityId } });
      if (row) groupId = await courseGroup(row.courseOfferingId);
    } else if (log.entityType === "ANNOUNCEMENT")
      groupId = (
        await p.announcement.findUnique({ where: { id: log.entityId } })
      )?.groupId;
    else if (log.entityType === "COURSE")
      groupId = await courseGroup(log.entityId);
    else if (log.entityType === "COURSE_TEACHER") {
      const row = await p.courseTeacher.findUnique({
        where: { id: log.entityId },
      });
      if (row) groupId = await courseGroup(row.courseOfferingId);
    } else if (log.entityType === "VARIANT_ASSIGNMENT")
      groupId = (
        await p.variantAssignment.findUnique({
          where: { id: log.entityId },
          include: { enrollment: true },
        })
      )?.enrollment.groupId;
    else if (log.entityType === "SOURCE_REFERENCE")
      groupId = (
        await p.sourceReference.findUnique({
          where: { id: log.entityId },
          include: { source: true },
        })
      )?.source.groupId;
    else if (log.entityType === "AI_SUGGESTION")
      groupId = (
        await p.aiSuggestion.findUnique({
          where: { id: log.entityId },
          include: { source: true },
        })
      )?.source?.groupId;
    if (groupId) {
      await p.auditLog.update({
        where: { id: log.id },
        data: { details: { ...details, groupId } as Prisma.InputJsonObject },
      });
      count++;
    }
  }
  if (count)
    await p.auditLog.create({
      data: {
        userId: "system-bootstrap",
        action: "AUDIT_SCOPE_BACKFILL",
        entityType: "REPAIR",
        entityId: "reliable-core-20261016-audit-scope",
        details: {
          groupId: primary.id,
          count,
          reason:
            "Область старых событий восстановлена по их сущностям; неизвестные события не выводятся через фильтр по автору",
        },
      },
    });
}
async function main() {
  await bootstrap(p);
  await repairAdditionalEvidence();
  await scopeLegacyAudit();
  if (
    await p.auditLog.findFirst({
      where: { action: "ACADEMIC_REPAIR_COMPLETE", entityId: repairId },
    })
  ) {
    console.log("Repair already applied");
    return;
  }
  await bootstrap(p);
  await p.$transaction(
    async (tx) => {
      const actor = "system-bootstrap";
      const record = async (
        type: string,
        id: string,
        before: unknown,
        after: unknown,
        reason: string,
      ) =>
        tx.auditLog.create({
          data: {
            userId: actor,
            action: "ACADEMIC_DATA_REPAIR",
            entityType: type,
            entityId: id,
            details: {
              repairId,
              before: JSON.parse(JSON.stringify(before)),
              after: JSON.parse(JSON.stringify(after)),
              reason,
            },
          },
        });
      for (const id of [
        "dl-otu-lab1",
        "dl-otu-hw2",
        "dl-sovd-calc1",
        "dl-vr-choice",
      ]) {
        const old = await tx.deadline.findUnique({ where: { id } });
        if (!old) continue;
        const after = {
          status: "CANCELLED" as const,
          provenance: "UNKNOWN" as const,
        };
        await record(
          "DEADLINE",
          id,
          old,
          after,
          "Нет буквального первичного подтверждения даты; старые значения сохранены в записи и аудите, возврат к seed-дате не выполнялся",
        );
        await tx.deadline.update({ where: { id }, data: after });
      }
      const lab4 = await tx.task.findUnique({ where: { id: "task-otu-lab4" } });
      if (lab4) {
        await record(
          "TASK",
          lab4.id,
          lab4,
          { status: "DRAFT" },
          "Наличие ЛР4 в методичке не означает выдачу; имеющийся источник прямо указывает, что приступать ещё не требовали",
        );
        await tx.task.update({
          where: { id: lab4.id },
          data: { status: "DRAFT" },
        });
      }
      const sovd = await tx.task.findUnique({
        where: { id: "task-sovd-calc1" },
        include: { sourceReference: true },
      });
      if (sovd) {
        const group = await tx.courseOfferingGroup.findFirstOrThrow({
          where: { courseOfferingId: sovd.courseOfferingId },
        });
        const source = await tx.source.upsert({
          where: { id: "src-sovd-assignment-1" },
          update: {},
          create: {
            id: "src-sovd-assignment-1",
            groupId: group.groupId,
            type: "OFFICIAL_DOCUMENT",
            title: "Задание на расчетную работу 1.pdf",
            documentMetadata: { corpus: "Статистическая обработка", page: 1 },
          },
        });
        const reference = await tx.sourceReference.create({
          data: {
            sourceId: source.id,
            entityType: "TASK",
            entityId: sovd.id,
            quoteText:
              "Идентифицировать закон распределения генеральной совокупности.",
            confidence: "CONFIRMED",
            createdById: actor,
          },
        });
        await record(
          "TASK",
          sovd.id,
          sovd,
          { sourceReferenceId: reference.id },
          "Пособие Нестерова по ОТУ не является источником задания СОВД; заменено соответствующим официальным заданием, без утверждения о дедлайне",
        );
        await tx.task.update({
          where: { id: sovd.id },
          data: { sourceReferenceId: reference.id },
        });
        if (sovd.sourceReferenceId)
          await tx.sourceReference.update({
            where: { id: sovd.sourceReferenceId },
            data: { confidence: "DISPUTED" },
          });
      }
      for (const teacher of await tx.courseTeacher.findMany({
        where: { sourceReferenceId: null, status: "CONFIRMED" },
      })) {
        await record(
          "COURSE_TEACHER",
          teacher.id,
          teacher,
          { status: "CANDIDATE_UNVERIFIED" },
          "Фамилия сохранена; документальное основание назначения преподавателя не приложено",
        );
        await tx.courseTeacher.update({
          where: { id: teacher.id },
          data: { status: "CANDIDATE_UNVERIFIED" },
        });
      }
      for (const assignment of await tx.variantAssignment.findMany({
        where: { sourceReferenceId: null },
      })) {
        await record(
          "VARIANT_ASSIGNMENT",
          assignment.id,
          assignment,
          { confidence: "UNVERIFIED" },
          "Seed-назначение не имеет проверяемого основания; сохранено, но не выдаётся за подтверждённый персональный вариант",
        );
        await tx.variantAssignment.update({
          where: { id: assignment.id },
          data: { confidence: "UNVERIFIED" },
        });
      }
      for (const course of await tx.courseOffering.findMany({
        where: {
          OR: [
            { softwareRequired: { contains: "Optgr.m" } },
            { softwareRequired: { contains: "ModelSim" } },
          ],
        },
      })) {
        await record(
          "COURSE",
          course.id,
          course,
          { softwareRequired: null },
          "Наличие файла или учебных материалов не доказывает обязательность ПО",
        );
        await tx.courseOffering.update({
          where: { id: course.id },
          data: { softwareRequired: null },
        });
      }
      // Exact IDs plus exact generated text. Preserve every row and its original data.
      const tasks = new Map([
        [
          "b9a7e2bf-b7d9-453b-9026-eafc8db6491d",
          "E2E Тестовая лабораторная: Моделирование 8475",
        ],
        [
          "f6d81ba6-12cc-4997-954c-17cf2e247458",
          "E2E Тестовая лабораторная: Моделирование 7666",
        ],
      ]);
      for (const [id, title] of tasks) {
        const t = await tx.task.findUnique({
          where: { id },
          include: { _count: { select: { progress: true } } },
        });
        if (
          t?.title !== title ||
          t.description !==
            "Автоматизированный E2E тест создания учебного задания через реальную форму UI." ||
          t.createdById !== "user-dev-owner" ||
          t._count.progress !== 0
        )
          continue;
        await record(
          "TASK",
          id,
          t,
          { status: "ARCHIVED" },
          "Точный артефакт прежнего E2E-скрипта: совпадают ID, шаблон названия, тело и автор; прогресс отсутствует",
        );
        await tx.task.update({ where: { id }, data: { status: "ARCHIVED" } });
        for (const d of await tx.deadline.findMany({
          where: { taskId: id, status: "ACTIVE" },
        })) {
          await record(
            "DEADLINE",
            d.id,
            d,
            { status: "CANCELLED", provenance: "UNKNOWN" },
            "Срок тестовой задачи",
          );
          await tx.deadline.update({
            where: { id: d.id },
            data: { status: "CANCELLED", provenance: "UNKNOWN" },
          });
        }
      }
      const anns = new Map([
        ["1b320f94-b239-4f1f-9ca2-e9bd6e893a45", "E2E Важное объявление 6750"],
        ["ce18f74b-cf18-437f-b8af-e2feb05e0a06", "E2E Важное объявление 6526"],
        ["702b98cd-07e6-4e53-a9ee-f69bf75a6985", "E2E Важное объявление 7151"],
      ]);
      for (const [id, title] of anns) {
        const a = await tx.announcement.findUnique({ where: { id } });
        const log = await tx.auditLog.findFirst({
          where: { entityId: id, action: "CREATE_ANNOUNCEMENT" },
        });
        if (
          a?.title !== title ||
          a.content !==
            "Контрольное объявление, созданное через форму старосты в браузере. Проверка доставки студентам." ||
          a.authorId !== "user-dev-owner" ||
          !log
        )
          continue;
        await record(
          "ANNOUNCEMENT",
          id,
          a,
          { status: "ARCHIVED" },
          "Точный E2E-артефакт подтверждён шаблоном текста и журналом создания",
        );
        await tx.announcement.update({
          where: { id },
          data: { status: "ARCHIVED" },
        });
      }
      // Quarantine notifications pointing to the exact archived artifacts, keep history.
      const links = [...tasks.keys()].map((id) => `/tasks/${id}`);
      await tx.notification.updateMany({
        where: {
          OR: [
            { link: { in: links } },
            {
              title: { in: [...anns.values()].map((t) => `Объявление: ${t}`) },
            },
          ],
        },
        data: { isRead: true },
      });
      const accepted = await tx.studentTaskProgress.findMany({
        where: { status: "ACCEPTED" },
      });
      for (const row of accepted) {
        // No legacy record had the newly required evidence link at takeover.
        if (
          !row.verificationSourceReferenceId ||
          !row.isVerified ||
          !row.verifiedById ||
          row.verifiedById === row.userId ||
          !row.verifiedAt ||
          !row.acceptedAt ||
          !row.verificationSource ||
          row.verificationSource === "SELF_REPORTED"
        ) {
          const after = {
            status: "SUBMITTED" as const,
            isVerified: false,
            verifiedById: null,
            verifiedAt: null,
            acceptedAt: null,
            verificationSource: null,
            verificationSourceReferenceId: null,
          };
          await record(
            "TASK_PROGRESS",
            row.id,
            row,
            after,
            "Legacy ACCEPTED не соответствует модели подтверждения",
          );
          await tx.studentTaskProgress.update({
            where: { id: row.id },
            data: after,
          });
        }
      }
      await tx.auditLog.create({
        data: {
          userId: actor,
          action: "ACADEMIC_REPAIR_COMPLETE",
          entityType: "REPAIR",
          entityId: repairId,
          details: {
            legacyAcceptedReviewed: accepted.length,
            deletedRows: 0,
            notes:
              "Все спорные и тестовые данные сохранены с деактивацией/архивированием; пользовательский прогресс и XP не сбрасывались",
          },
        },
      });
    },
    { timeout: 30000 },
  );
  await p.$executeRaw(
    Prisma.sql`ALTER TABLE "StudentTaskProgress" VALIDATE CONSTRAINT "accepted_requires_evidence"`,
  );
  console.log(
    "Academic repair complete. No rows deleted; all changes audited.",
  );
}
main().finally(() => p.$disconnect());
