import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { SessionType, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { ForbiddenError, hasPermission } from "@/lib/permissions/checker";
import { requireCoursePermission, taskVisibilityWhere } from "./access";
import { parseDateOnly } from "./deadline-date";

export const externalUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((value) => {
    try {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
      );
    } catch {
      return false;
    }
  }, "Нужна внешняя HTTPS-ссылка без пароля");
const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
export const LessonInput = z.object({
  courseOfferingId: z.string().min(1),
  topic: z.string().trim().min(2).max(240),
  day: z.string(),
  time: z.string().optional(),
  endTime: z.string().optional(),
  type: z.nativeEnum(SessionType),
  taughtBy: optionalText(160),
  room: optionalText(160),
  summary: optionalText(20000),
  notes: optionalText(10000),
  recordingUrl: externalUrl.nullable().optional(),
  sourceNote: z
    .string()
    .trim()
    .min(8, "Укажите, откуда известны сведения о занятии")
    .max(4000),
  transcriptText: optionalText(200000),
  taskIds: z.array(z.string()).max(50).default([]),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).default("PUBLISHED"),
});
export function lessonDate(day: string, time?: string) {
  parseDateOnly(day);
  const clock = time || "00:00";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))
    throw new ForbiddenError("Проверьте время занятия");
  const date = new Date(`${day}T${clock}:00+03:00`);
  if (
    formatInTimeZone(date, "Europe/Moscow", "yyyy-MM-dd HH:mm") !==
    `${day} ${clock}`
  )
    throw new ForbiddenError("Проверьте дату занятия");
  return date;
}
export function canEditCourse(
  user: SessionUser,
  id: string,
  permission = "manage_sessions",
) {
  return (
    hasPermission(user, permission) ||
    user.permissions.includes(`manage_course:${id}`) ||
    user.permissions.includes(`${permission}:${id}`)
  );
}
export async function saveLesson(
  user: SessionUser,
  raw: unknown,
  id?: string,
  version?: number,
) {
  const input = LessonInput.parse(raw);
  await requireCoursePermission(
    user,
    input.courseOfferingId,
    "manage_sessions",
  );
  const date = lessonDate(input.day, input.time);
  const endsAt = input.endTime ? lessonDate(input.day, input.endTime) : null;
  if (endsAt && (!input.time || endsAt <= date))
    throw new ForbiddenError("Окончание должно быть позже начала занятия");
  const visible = await taskVisibilityWhere(user);
  const taskIds = [...new Set(input.taskIds)];
  if (
    (await prisma.task.count({
      where: {
        AND: [
          visible,
          { id: { in: taskIds }, courseOfferingId: input.courseOfferingId },
        ],
      },
    })) !== taskIds.length
  )
    throw new ForbiddenError("Связанное задание недоступно в этом предмете");
  return prisma.$transaction(
    async (tx) => {
      const previous = id
        ? await tx.classSession.findFirst({
            where: { id, courseOfferingId: input.courseOfferingId },
            include: { tasks: { select: { taskId: true } } },
          })
        : null;
      if (id && (!previous || previous.version !== version))
        throw new ForbiddenError("Занятие уже изменилось. Обновите страницу");
      const data = {
        courseOfferingId: input.courseOfferingId,
        topic: input.topic,
        sessionDate: date,
        endsAt,
        isTimeKnown: Boolean(input.time),
        type: input.type,
        taughtBy: input.taughtBy || null,
        room: input.room || null,
        summary: input.summary || null,
        notes: input.notes || null,
        recordingUrl: input.recordingUrl || null,
        sourceNote: input.sourceNote,
        status: input.status as TaskStatus,
      };
      const previousText =
        previous && input.transcriptText
          ? await tx.transcript.findFirst({
              where: { sessionId: previous.id },
              orderBy: { createdAt: "desc" },
            })
          : null;
      const transcriptChanged = Boolean(
        input.transcriptText && previousText?.rawText !== input.transcriptText,
      );
      const sameFields =
        previous &&
        Object.entries(data).every(([key, value]) => {
          const before = previous[key as keyof typeof data];
          return before instanceof Date && value instanceof Date
            ? before.getTime() === value.getTime()
            : before === value;
        });
      if (
        previous &&
        sameFields &&
        !transcriptChanged &&
        JSON.stringify([...taskIds].sort()) ===
          JSON.stringify(previous.tasks.map((t) => t.taskId).sort())
      )
        return previous.id;
      let session;
      if (previous) {
        const changed = await tx.classSession.updateMany({
          where: { id: previous.id, version: previous.version },
          data: { ...data, version: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new ForbiddenError("Занятие уже изменилось");
        session = await tx.classSession.findUniqueOrThrow({
          where: { id: previous.id },
        });
        await tx.sessionTask.deleteMany({ where: { sessionId: session.id } });
      } else session = await tx.classSession.create({ data });
      if (taskIds.length)
        await tx.sessionTask.createMany({
          data: taskIds.map((taskId) => ({ sessionId: session.id, taskId })),
        });
      if (transcriptChanged) {
        const latest =
          previousText ??
          (await tx.transcript.findFirst({
            where: { sessionId: session.id },
            orderBy: { createdAt: "desc" },
          }));
        await tx.transcript.create({
          data: {
            sessionId: session.id,
            rawText: input.transcriptText!,
            recordingPart: (latest?.recordingPart ?? 0) + 1,
            audioSourceUrl: input.recordingUrl || null,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: previous ? "UPDATE_LESSON" : "CREATE_LESSON",
          entityType: "CLASS_SESSION",
          entityId: session.id,
          details: {
            groupId: user.groupId,
            courseId: input.courseOfferingId,
            before: previous
              ? {
                  topic: previous.topic,
                  summary: previous.summary,
                  sessionDate: previous.sessionDate.toISOString(),
                  isTimeKnown: previous.isTimeKnown,
                  endsAt: previous.endsAt?.toISOString(),
                  recordingUrl: previous.recordingUrl,
                  sourceNote: previous.sourceNote,
                  status: previous.status,
                  room: previous.room,
                  taughtBy: previous.taughtBy,
                  notes: previous.notes,
                  type: previous.type,
                  taskIds: previous.tasks.map((link) => link.taskId),
                }
              : null,
            after: {
              topic: session.topic,
              summary: session.summary,
              sessionDate: session.sessionDate.toISOString(),
              isTimeKnown: session.isTimeKnown,
              endsAt: session.endsAt?.toISOString(),
              recordingUrl: session.recordingUrl,
              sourceNote: session.sourceNote,
              status: session.status,
              room: session.room,
              taughtBy: session.taughtBy,
              notes: session.notes,
              type: session.type,
              taskIds,
            },
            transcriptAdded: transcriptChanged,
          },
        },
      });
      const source = await tx.source.create({
        data: {
          groupId: user.groupId,
          type: "HEADMAN_RECORD",
          title: "Сведения о занятии",
          url: session.recordingUrl,
          classSessionId: session.id,
        },
      });
      await tx.sourceReference.create({
        data: {
          sourceId: source.id,
          entityType: "CLASS_SESSION",
          entityId: session.id,
          quoteText: input.sourceNote,
          confidence: "CONFIRMED",
          createdById: user.id,
        },
      });
      if (
        session.status !== "DRAFT" ||
        (previous && previous.status !== "DRAFT")
      ) {
        const recipients = await tx.enrollment.findMany({
          where: {
            groupId: user.groupId,
            status: { in: ["CLAIMED", "VERIFIED"] },
            userId: { not: null },
          },
          select: { userId: true },
          distinct: ["userId"],
        });
        const audience = recipients.filter((r) => r.userId !== user.id);
        if (audience.length)
          await tx.notification.createMany({
            data: audience.map((r) => ({
              userId: r.userId!,
              groupId: user.groupId,
              type: "COURSE_UPDATE",
              title:
                session.status === "CANCELLED"
                  ? "Занятие отменено"
                  : session.status === "DRAFT"
                    ? "Сведения о занятии уточняются"
                    : previous
                      ? "Обновлено занятие"
                      : "Добавлено занятие",
              message:
                session.status === "DRAFT"
                  ? "Редактор проверяет сведения. Они временно скрыты."
                  : (session.topic ?? "Занятие"),
              link:
                session.status === "DRAFT"
                  ? "/lessons"
                  : `/lessons/${session.id}`,
            })),
          });
      }
      return session.id;
    },
    { isolationLevel: "Serializable" },
  );
}
export async function addMaterial(user: SessionUser, raw: unknown) {
  const input = z
    .object({
      courseOfferingId: z.string(),
      sessionId: z.string().optional(),
      title: z.string().trim().min(2).max(240),
      url: externalUrl,
      description: optionalText(4000),
      sourceNote: z.string().trim().min(8).max(4000),
    })
    .parse(raw);
  await requireCoursePermission(
    user,
    input.courseOfferingId,
    "manage_materials",
  );
  if (
    input.sessionId &&
    !(await prisma.classSession.count({
      where: { id: input.sessionId, courseOfferingId: input.courseOfferingId },
    }))
  )
    throw new ForbiddenError("Занятие недоступно");
  return prisma.$transaction(async (tx) => {
    const material = await tx.courseMaterial.create({
      data: {
        courseOfferingId: input.courseOfferingId,
        title: input.title,
        url: input.url,
        type: "EXTERNAL_LINK",
        description: input.description || null,
        sourceNote: input.sourceNote,
      },
    });
    if (input.sessionId)
      await tx.sessionMaterial.create({
        data: { sessionId: input.sessionId, materialId: material.id },
      });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "ADD_COURSE_MATERIAL",
        entityType: "MATERIAL",
        entityId: material.id,
        details: {
          groupId: user.groupId,
          courseId: input.courseOfferingId,
          sessionId: input.sessionId ?? null,
          title: material.title,
          sourceNote: input.sourceNote,
        },
      },
    });
    return material.id;
  });
}
