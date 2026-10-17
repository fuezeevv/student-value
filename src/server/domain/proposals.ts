import { randomUUID } from "node:crypto";
import { Prisma, ProposalKind } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions/checker";
import {
  requireCoursePermission,
  requireTaskAudience,
  audienceMemberIds,
} from "./access";
import { externalUrl, canEditCourse } from "./lessons";
import { parseDateOnly } from "./deadline-date";
import { rescheduleDeadline } from "./deadlines";
import { confirmedDeadlineWhere } from "./deadline-visibility";

export const ProposalInput = z.object({
  courseOfferingId: z.string().min(1),
  kind: z.nativeEnum(ProposalKind),
  title: z.string().trim().min(3).max(240),
  content: z.string().trim().min(8).max(10000),
  sourceNote: z
    .string()
    .trim()
    .min(8, "Укажите, откуда эта информация")
    .max(4000),
  sourceUrl: externalUrl.nullable().optional(),
  taskId: z.string().optional(),
  sessionId: z.string().optional(),
  proposedDay: z.string().optional(),
  sharedBriefId: z.string().optional(),
  transcriptId: z.string().optional(),
  quoteStart: z.number().int().min(0).optional(),
  quoteEnd: z.number().int().min(1).optional(),
});

async function ownCourse(user: SessionUser, id: string) {
  const course = await prisma.courseOffering.findFirst({
    where: {
      id,
      status: "ACTIVE",
      groups: { some: { groupId: user.groupId } },
    },
  });
  if (!course) throw new ForbiddenError("Предмет недоступен в вашей группе");
  return course;
}
export async function proposeChange(user: SessionUser, raw: unknown) {
  const input = ProposalInput.parse(raw);
  await ownCourse(user, input.courseOfferingId);
  if (input.taskId) {
    const task = await requireTaskAudience(user, input.taskId);
    if (task.courseOfferingId !== input.courseOfferingId)
      throw new ForbiddenError("Работа относится к другому предмету");
  }
  if (["TASK_REQUIREMENT", "DEADLINE"].includes(input.kind) && !input.taskId)
    throw new ForbiddenError("Выберите конкретную работу");
  if (input.kind === "MATERIAL" && !input.sourceUrl)
    throw new ForbiddenError("Добавьте ссылку на материал");
  if (input.proposedDay) parseDateOnly(input.proposedDay);
  if (input.kind === "DEADLINE" && !input.proposedDay)
    throw new ForbiddenError("Укажите предлагаемый день сдачи");
  const lesson = input.sessionId
    ? await prisma.classSession.findFirst({
        where: {
          id: input.sessionId,
          courseOfferingId: input.courseOfferingId,
          ...(!canEditCourse(user, input.courseOfferingId)
            ? { status: "PUBLISHED" as const }
            : {}),
        },
      })
    : null;
  if (input.sessionId && !lesson)
    throw new ForbiddenError("Занятие недоступно");
  if (input.kind === "LESSON_SUMMARY" && !lesson)
    throw new ForbiddenError("Выберите занятие");
  if (input.transcriptId && !lesson)
    throw new ForbiddenError("Выберите занятие для цитаты");
  if (input.transcriptId) {
    const transcript = await prisma.transcript.findFirst({
      where: { id: input.transcriptId, sessionId: input.sessionId },
    });
    if (
      !transcript ||
      input.quoteStart == null ||
      input.quoteEnd == null ||
      input.quoteEnd <= input.quoteStart ||
      transcript.rawText.slice(input.quoteStart, input.quoteEnd) !==
        input.sourceNote
    )
      throw new ForbiddenError("Цитата не совпадает с текстом транскрипции");
  }
  const shared = input.sharedBriefId
    ? await prisma.sharedBrief.findFirst({
        where: {
          id: input.sharedBriefId,
          archivedAt: null,
          groupId: { not: user.groupId },
        },
      })
    : null;
  if (input.sharedBriefId && !shared)
    throw new ForbiddenError("Сведения для переноса недоступны");
  const deadline =
    input.kind === "DEADLINE"
      ? await prisma.deadline.findFirst({
          where: { taskId: input.taskId, ...confirmedDeadlineWhere },
          orderBy: { date: "asc" },
        })
      : null;
  return prisma.changeProposal.create({
    data: {
      ...input,
      groupId: user.groupId,
      authorId: user.id,
      deadlineId: deadline?.id,
      lessonVersion: lesson?.version,
      sourceUrl: input.transcriptId ? lesson?.recordingUrl : input.sourceUrl,
      ...(shared
        ? {
            kind: "NOTE",
            title: shared.title,
            content: shared.content,
            sourceNote: shared.sourceNote,
            sourceUrl: shared.sourceUrl,
          }
        : {}),
    },
  });
}

const ReviewInput = z.object({
  decision: z.enum(["APPROVE", "REJECT", "CLARIFY"]),
  content: z.string().trim().max(10000).optional(),
  reviewNote: z
    .string()
    .trim()
    .min(8, "Напишите, что проверено или что нужно уточнить")
    .max(4000),
  kind: z.nativeEnum(ProposalKind).optional(),
  deadlineType: z.enum(["HARD", "SOFT"]).optional(),
  taskId: z.string().optional(),
  proposedDay: z.string().optional(),
});
export function permissionForProposalKind(kind: ProposalKind) {
  return kind === "DEADLINE"
    ? "manage_deadlines"
    : kind === "MATERIAL"
      ? "manage_materials"
      : kind === "LESSON_SUMMARY"
        ? "manage_sessions"
        : "review_proposals";
}
export async function reviewProposal(
  user: SessionUser,
  id: string,
  raw: unknown,
) {
  const input = ReviewInput.parse(raw);
  const proposal = await prisma.changeProposal.findFirst({
    where: { id, groupId: user.groupId },
    include: {
      sharedBrief: { include: { group: { select: { name: true } } } },
    },
  });
  if (!proposal || proposal.status !== "PENDING")
    throw new ForbiddenError("Предложение уже рассмотрено или недоступно");
  await requireCoursePermission(
    user,
    proposal.courseOfferingId,
    permissionForProposalKind(proposal.kind),
  );
  if (proposal.taskId) await requireTaskAudience(user, proposal.taskId);
  const kind = input.kind ?? proposal.kind;
  await requireCoursePermission(
    user,
    proposal.courseOfferingId,
    permissionForProposalKind(kind),
  );
  const text = input.content || proposal.content;
  const taskId = input.taskId || proposal.taskId;
  if (
    input.decision === "APPROVE" &&
    ["TASK_REQUIREMENT", "DEADLINE"].includes(kind) &&
    !taskId
  )
    throw new ForbiddenError("Выберите работу, к которой относится уточнение");
  if (taskId) {
    const task = await requireTaskAudience(user, taskId);
    if (task.courseOfferingId !== proposal.courseOfferingId)
      throw new ForbiddenError("Работа другого предмета");
  }
  const finish = async (tx: Prisma.TransactionClient, entityId?: string) => {
    const updated = await tx.changeProposal.updateMany({
      where: { id, status: "PENDING", groupId: user.groupId },
      data: {
        status:
          input.decision === "APPROVE"
            ? "APPROVED"
            : input.decision === "REJECT"
              ? "REJECTED"
              : "NEEDS_CLARIFICATION",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote,
        appliedEntityId: entityId,
        appliedKind: input.decision === "APPROVE" ? kind : null,
        ...(input.decision === "APPROVE" ? { taskId } : {}),
      },
    });
    if (updated.count !== 1)
      throw new ForbiddenError("Предложение уже рассмотрено");
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action:
          input.decision === "APPROVE"
            ? "APPLY_GROUP_PROPOSAL"
            : "REVIEW_GROUP_PROPOSAL",
        entityType: "PROPOSAL",
        entityId: id,
        details: {
          groupId: user.groupId,
          courseId: proposal.courseOfferingId,
          taskId: taskId ?? null,
          originalTaskId: proposal.taskId,
          sessionId: proposal.sessionId,
          decision: input.decision,
          kind,
          sourceNote: proposal.sourceNote,
          reviewNote: input.reviewNote,
          appliedEntityId: entityId ?? null,
        },
      },
    });
    await tx.notification.create({
      data: {
        userId: proposal.authorId,
        groupId: user.groupId,
        type: "COURSE_UPDATE",
        title:
          input.decision === "APPROVE"
            ? "Ваше уточнение опубликовано"
            : input.decision === "CLARIFY"
              ? "Нужно уточнить предложение"
              : "Предложение рассмотрено",
        message: proposal.title,
        link: "/proposals",
      },
    });
  };
  if (input.decision !== "APPROVE") {
    await prisma.$transaction((tx) => finish(tx));
    return;
  }
  if (proposal.sharedBrief?.archivedAt)
    throw new ForbiddenError(
      "Исходная группа отозвала сведения. Сначала получите актуальное подтверждение",
    );
  if (text.length < 8) throw new ForbiddenError("Опишите итоговое изменение");
  const currentDeadline =
    kind === "DEADLINE" && proposal.kind !== "DEADLINE" && taskId
      ? await prisma.deadline.findFirst({
          where: { taskId, ...confirmedDeadlineWhere },
          orderBy: { date: "asc" },
        })
      : null;
  const deadlineToMove = proposal.deadlineId ?? currentDeadline?.id;
  if (kind === "DEADLINE" && deadlineToMove) {
    if (proposal.deadlineId && taskId !== proposal.taskId)
      throw new ForbiddenError(
        "Работа срока изменилась. Создайте отдельное предложение",
      );
    const day = input.proposedDay || proposal.proposedDay;
    if (!day) throw new ForbiddenError("Укажите день сдачи");
    await rescheduleDeadline(
      user,
      deadlineToMove,
      day,
      input.deadlineType,
      `${proposal.sourceNote}\nПроверено: ${input.reviewNote}`,
      async (tx, deadline) => finish(tx, deadline.id),
    );
    return;
  }
  const recipients = taskId
    ? await audienceMemberIds(taskId)
    : (
        await prisma.groupMember.findMany({
          where: { groupId: user.groupId },
          select: { userId: true },
        })
      ).map((m) => m.userId);
  await prisma.$transaction(
    async (tx) => {
      const entityId = randomUUID();
      const source = await tx.source.create({
        data: {
          groupId: user.groupId,
          type: "HEADMAN_RECORD",
          title: `${proposal.sharedBrief ? `Сведения группы «${proposal.sharedBrief.group.name}», проверенные для нашей группы: ` : "Проверенное уточнение: "}${proposal.title}`,
          url: proposal.sourceUrl,
          documentMetadata: {
            proposalId: id,
            submittedBy: proposal.authorId,
            reviewedBy: user.id,
            reviewNote: input.reviewNote,
            sharedBriefId: proposal.sharedBriefId,
          },
          ...(proposal.sessionId ? { classSessionId: proposal.sessionId } : {}),
          ...(proposal.transcriptId
            ? { transcriptId: proposal.transcriptId }
            : {}),
        },
      });
      const ref = await tx.sourceReference.create({
        data: {
          sourceId: source.id,
          entityType:
            kind === "TASK_REQUIREMENT"
              ? "TASK_REQUIREMENT"
              : kind === "DEADLINE"
                ? "DEADLINE"
                : kind === "LESSON_SUMMARY"
                  ? "CLASS_SESSION"
                  : kind === "MATERIAL"
                    ? "MATERIAL"
                    : "ANNOUNCEMENT",
          entityId: kind === "LESSON_SUMMARY" ? proposal.sessionId! : entityId,
          quoteText: proposal.sourceNote,
          confidence: "CONFIRMED",
          createdById: user.id,
          offsetStart: proposal.quoteStart,
          offsetEnd: proposal.quoteEnd,
        },
      });
      if (kind === "TASK_REQUIREMENT")
        await tx.taskRequirement.create({
          data: {
            id: entityId,
            taskId: taskId!,
            content: text,
            sourceReferenceId: ref.id,
          },
        });
      else if (kind === "MATERIAL") {
        if (!proposal.sourceUrl)
          throw new ForbiddenError("У материала нет ссылки");
        externalUrl.parse(proposal.sourceUrl);
        await tx.courseMaterial.create({
          data: {
            id: entityId,
            courseOfferingId: proposal.courseOfferingId,
            title: proposal.title,
            type: "EXTERNAL_LINK",
            url: proposal.sourceUrl,
            description: text,
            sourceNote: `${proposal.sourceNote}\nПроверено: ${input.reviewNote}`,
          },
        });
        if (proposal.sessionId)
          await tx.sessionMaterial.create({
            data: { sessionId: proposal.sessionId, materialId: entityId },
          });
      } else if (kind === "LESSON_SUMMARY") {
        if (!proposal.sessionId || proposal.lessonVersion == null)
          throw new ForbiddenError("Не выбрано занятие");
        const previous = await tx.classSession.findFirst({
          where: {
            id: proposal.sessionId,
            courseOfferingId: proposal.courseOfferingId,
          },
        });
        const updated = await tx.classSession.updateMany({
          where: {
            id: proposal.sessionId,
            version: proposal.lessonVersion,
            status: "PUBLISHED",
            courseOfferingId: proposal.courseOfferingId,
          },
          data: { summary: text, version: { increment: 1 } },
        });
        if (updated.count !== 1)
          throw new ForbiddenError(
            "Занятие изменилось. Сначала сверьте его текущий итог",
          );
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "UPDATE_LESSON",
            entityType: "CLASS_SESSION",
            entityId: proposal.sessionId,
            details: {
              groupId: user.groupId,
              before: { summary: previous?.summary ?? null },
              after: { summary: text },
              sourceReferenceId: ref.id,
              reviewNote: input.reviewNote,
              proposalId: id,
            },
          },
        });
      } else if (kind === "DEADLINE") {
        const day = input.proposedDay || proposal.proposedDay;
        if (!day) throw new ForbiddenError("Укажите день сдачи");
        if (
          await tx.deadline.count({
            where: { taskId: taskId!, ...confirmedDeadlineWhere },
          })
        )
          throw new ForbiddenError(
            "У работы уже появился срок. Сначала сверьте изменение",
          );
        await tx.deadline.create({
          data: {
            id: entityId,
            taskId: taskId!,
            courseOfferingId: proposal.courseOfferingId,
            title: proposal.title,
            date: parseDateOnly(day),
            isTimeStrict: false,
            type: input.deadlineType ?? "SOFT",
            createdById: user.id,
            provenance: "HEADMAN_CONFIRMED",
            sourceReferenceId: ref.id,
          },
        });
      } else
        await tx.announcement.create({
          data: {
            id: entityId,
            groupId: user.groupId,
            courseOfferingId: proposal.courseOfferingId,
            title: proposal.title,
            content: text,
            authorId: user.id,
            sourceReferenceId: ref.id,
          },
        });
      await finish(
        tx,
        kind === "LESSON_SUMMARY" ? proposal.sessionId! : entityId,
      );
      const audience = recipients.filter((id) => id !== proposal.authorId);
      if (audience.length)
        await tx.notification.createMany({
          data: audience.map((userId) => ({
            userId,
            groupId: user.groupId,
            type: kind === "DEADLINE" ? "DEADLINE_CHANGE" : "COURSE_UPDATE",
            title:
              kind === "TASK_REQUIREMENT"
                ? "Уточнено требование к работе"
                : kind === "MATERIAL"
                  ? "Добавлен материал"
                  : "Новое уточнение по предмету",
            message: proposal.title,
            link: taskId
              ? `/tasks/${taskId}`
              : proposal.sessionId
                ? `/lessons/${proposal.sessionId}`
                : `/courses/${proposal.courseOfferingId}`,
          })),
        });
    },
    { isolationLevel: "Serializable" },
  );
}

export async function shareBrief(user: SessionUser, raw: unknown) {
  const input = z
    .object({
      courseOfferingId: z.string(),
      title: z.string().trim().min(3).max(240),
      content: z.string().trim().min(10).max(5000),
      sourceNote: z.string().trim().min(8).max(4000),
      sourceUrl: externalUrl.nullable().optional(),
    })
    .parse(raw);
  await requireCoursePermission(
    user,
    input.courseOfferingId,
    "review_proposals",
  );
  const course = await prisma.courseOffering.findUniqueOrThrow({
    where: { id: input.courseOfferingId },
    include: { courseDefinition: true },
  });
  return prisma.$transaction(async (tx) => {
    const brief = await tx.sharedBrief.create({
      data: {
        groupId: user.groupId,
        subject: course.courseDefinition.title,
        title: input.title,
        content: input.content,
        sourceNote: input.sourceNote,
        sourceUrl: input.sourceUrl,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "SHARE_GROUP_BRIEF",
        entityType: "SHARED_BRIEF",
        entityId: brief.id,
        details: {
          groupId: user.groupId,
          courseId: input.courseOfferingId,
          visibility: "OTHER_GROUPS_EXPLICIT",
        },
      },
    });
    return brief.id;
  });
}

/** Literal text cues only. No external AI and no automatic publication or guessed dates. */
export async function suggestTranscriptNotes(
  user: SessionUser,
  sessionId: string,
) {
  const session = await prisma.classSession.findFirst({
    where: {
      id: sessionId,
      status: "PUBLISHED",
      courseOffering: { groups: { some: { groupId: user.groupId } } },
    },
    include: { transcripts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!session?.transcripts[0])
    throw new ForbiddenError("Нет доступного текста занятия");
  const transcript = session.transcripts[0];
  const cues = [...transcript.rawText.matchAll(/[^\r\n]+/g)]
    .filter(
      (m) =>
        m[0].length >= 12 &&
        /(сда[тёе]|дедлайн|срок|лабораторн|отч[её]т|обязательн|перен[ео]с|задани)/i.test(
          m[0],
        ),
    )
    .slice(0, 8);
  const result = await prisma.changeProposal.createMany({
    skipDuplicates: true,
    data: cues.map((m) => {
      const quote = m[0].slice(0, 1500);
      return {
        groupId: user.groupId,
        courseOfferingId: session.courseOfferingId,
        authorId: user.id,
        kind: "NOTE" as const,
        title: `Проверить фразу: ${quote.slice(0, 120)}`,
        content: quote,
        sourceNote: quote,
        sourceUrl: session.recordingUrl,
        sessionId: session.id,
        lessonVersion: session.version,
        transcriptId: transcript.id,
        quoteStart: m.index!,
        quoteEnd: m.index! + quote.length,
      };
    }),
  });
  return result.count;
}

export async function archiveSharedBrief(user: SessionUser, id: string) {
  const brief = await prisma.sharedBrief.findFirst({
    where: { id, groupId: user.groupId, archivedAt: null },
  });
  const log = brief
    ? await prisma.auditLog.findFirst({
        where: {
          entityType: "SHARED_BRIEF",
          entityId: id,
          action: "SHARE_GROUP_BRIEF",
        },
        orderBy: { createdAt: "asc" },
      })
    : null;
  const details = log?.details as { courseId?: string } | null;
  if (!brief || !details?.courseId)
    throw new ForbiddenError("Сведения недоступны");
  await requireCoursePermission(user, details.courseId, "review_proposals");
  await prisma.$transaction(async (tx) => {
    const result = await tx.sharedBrief.updateMany({
      where: { id, groupId: user.groupId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (result.count !== 1) throw new ForbiddenError("Сведения уже отозваны");
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "ARCHIVE_SHARED_BRIEF",
        entityType: "SHARED_BRIEF",
        entityId: id,
        details: { groupId: user.groupId, courseId: details.courseId },
      },
    });
  });
}
