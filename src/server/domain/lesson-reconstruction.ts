import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma, SessionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions/checker";
import { LessonEvidence } from "@/lib/study/lesson-context";
import { externalUrl, lessonDate } from "./lessons";
import { taskVisibilityWhere } from "./access";

const Evidence = LessonEvidence.extend({ url: externalUrl.optional() });
export const Reconstruction = z.object({
  key: z.string().regex(/^[a-zA-Z0-9:_-]{5,180}$/),
  courseOfferingId: z.string().min(1),
  day: z.string(),
  time: z.string(),
  endTime: z.string(),
  type: z.nativeEnum(SessionType),
  topic: z.string().min(2).max(240),
  taughtBy: z.string().max(300).nullable(),
  room: z.string().max(300).nullable(),
  summary: z.string().max(20000).nullable(),
  guideText: z.string().max(40000).nullable(),
  assignmentNotes: z.string().max(20000).nullable(),
  audienceNote: z.string().max(500).nullable(),
  scheduleUrl: externalUrl,
  coverage: z.enum([
    "SCHEDULE_ONLY",
    "MATERIALS",
    "TRANSCRIPT",
    "RECONSTRUCTED",
  ]),
  evidence: z.array(Evidence).min(1).max(80),
  transcripts: z
    .array(
      z.object({
        text: z.string().min(1).max(200000),
        label: z.string().max(300),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .max(12),
  materials: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().max(300),
        url: externalUrl,
        sourceNote: z.string().min(8).max(4000),
      }),
    )
    .max(60),
  relatedTaskIds: z.array(z.string()).max(30).default([]),
});
export type ReconstructionInput = z.infer<typeof Reconstruction>;
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export const reconstructedLessonId = (groupId: string, key: string) =>
  "lesson-" + digest(groupId + ":" + key).slice(0, 32);

// Explicit operational publication, not an ingestion endpoint or an automatically running AI process.
export async function publishReconstructedLesson(
  user: SessionUser,
  raw: unknown,
) {
  const input = Reconstruction.parse(raw),
    importDigest = digest(JSON.stringify(input));
  const sessionDate = lessonDate(input.day, input.time),
    endsAt = lessonDate(input.day, input.endTime);
  if (
    endsAt <= sessionDate ||
    input.day > "2026-11-02" ||
    input.day < "2026-09-01"
  )
    throw new ForbiddenError("Проверьте период восстановления");
  if (
    input.coverage === "SCHEDULE_ONLY" &&
    (input.summary ||
      input.guideText ||
      input.transcripts.length ||
      input.materials.length ||
      input.relatedTaskIds.length)
  )
    throw new ForbiddenError(
      "Содержание не может считаться только расписанием",
    );
  if (input.guideText && input.coverage !== "RECONSTRUCTED")
    throw new ForbiddenError("Памятка требует явной маркировки восстановления");
  const id = reconstructedLessonId(user.groupId, input.key);
  const visible = await taskVisibilityWhere(user);
  return prisma.$transaction(
    async (tx) => {
      const member = await tx.groupMember.findFirst({
        where: {
          userId: user.id,
          groupId: user.groupId,
          isOwner: true,
          group: {
            enrollments: {
              some: {
                userId: user.id,
                status: { in: ["CLAIMED", "VERIFIED"] },
              },
            },
          },
        },
      });
      if (!member)
        throw new ForbiddenError("Нужен действительный владелец группы");
      const course = await tx.courseOffering.findFirst({
        where: {
          id: input.courseOfferingId,
          status: "ACTIVE",
          mergedIntoId: null,
          groups: { some: { groupId: user.groupId } },
        },
      });
      if (!course) throw new ForbiddenError("Предмет недоступен");
      const relatedTaskIds = [...new Set(input.relatedTaskIds)];
      if (
        (await tx.task.count({
          where: {
            AND: [
              visible,
              { id: { in: relatedTaskIds }, courseOfferingId: course.id },
            ],
          },
        })) !== relatedTaskIds.length
      )
        throw new ForbiddenError("Связанная работа недоступна в этом предмете");
      const previous = await tx.classSession.findUnique({
        where: { id },
        include: { context: true },
      });
      if (previous) {
        if (
          previous.context?.importDigest !== importDigest ||
          previous.version !== 0 ||
          previous.courseOfferingId !== course.id
        )
          throw new ForbiddenError(
            "Запись уже изменена: требуется сверка вместо перезаписи",
          );
        return { id, created: false };
      }
      if (
        await tx.classSession.count({
          where: { courseOfferingId: course.id, sessionDate, type: input.type },
        })
      )
        throw new ForbiddenError("На это время уже есть запись занятия");
      for (const m of input.materials) {
        const material = await tx.courseMaterial.findFirst({
          where: { id: m.id, courseOfferingId: course.id },
        });
        if (!material)
          throw new ForbiddenError(
            "Материал должен принадлежать этому предмету",
          );
        if (material.url !== m.url || material.title !== m.title)
          throw new ForbiddenError("Материал уже изменился");
      }
      await tx.classSession.create({
        data: {
          id,
          courseOfferingId: course.id,
          sessionDate,
          endsAt,
          isTimeKnown: true,
          type: input.type,
          topic: input.topic,
          taughtBy: input.taughtBy,
          room: input.room,
          summary: input.summary,
          status: "PUBLISHED",
          sourceNote:
            "Восстановление по расписанию СПбПУ и указанным исходным материалам. Наличие в расписании не подтверждает проведение. Памятки и тематические связи составлены для Student Value; сведения о сроках не создаются из предположений.",
          context: {
            create: {
              coverage: input.coverage,
              scheduleUrl: input.scheduleUrl,
              audienceNote: input.audienceNote,
              guideText: input.guideText,
              assignmentNotes: input.assignmentNotes,
              evidence: input.evidence as Prisma.InputJsonValue,
              importDigest,
            },
          },
          transcripts: {
            create: input.transcripts.length
              ? [
                  {
                    rawText: input.transcripts
                      .map((t) => `Источник: ${t.label}\n\n${t.text}`)
                      .join("\n\n────────\n\n"),
                    recordingPart: 1,
                  },
                ]
              : [],
          },
          materials: {
            create: input.materials.map((m) => ({ materialId: m.id })),
          },
          tasks: { create: relatedTaskIds.map((taskId) => ({ taskId })) },
        },
      });
      for (const e of input.evidence) {
        const source = await tx.source.create({
          data: {
            groupId: user.groupId,
            type:
              e.kind ??
              (e.url?.startsWith("https://ruz.spbstu.ru/")
                ? "OFFICIAL_DOCUMENT"
                : "CLASS_SESSION"),
            title: e.label,
            url: e.url,
            classSessionId: id,
            documentMetadata: {
              sha256: e.sha256 ?? null,
              location: e.location ?? null,
              relation: e.relation,
              reconstruction: true,
            },
          },
        });
        await tx.sourceReference.create({
          data: {
            sourceId: source.id,
            entityType: "CLASS_SESSION",
            entityId: id,
            quoteText: e.quote,
            confidence: e.relation === "INFERRED" ? "INFERRED" : "CONFIRMED",
            createdById: user.id,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "RECONSTRUCT_LESSON",
          entityType: "CLASS_SESSION",
          entityId: id,
          details: {
            groupId: user.groupId,
            importDigest,
            coverage: input.coverage,
            sourceCount: input.evidence.length,
            taskOrDeadlineCreated: false,
          },
        },
      });
      return { id, created: true };
    },
    { isolationLevel: "Serializable", timeout: 20000 },
  );
}

export async function storeTeachingFile(
  user: SessionUser,
  courseId: string,
  filename: string,
  mimeType: string,
  content: Uint8Array,
  sourceNote: string,
) {
  if (
    content.byteLength < 1 ||
    content.byteLength > 20 * 1024 * 1024 ||
    !filename ||
    filename.length > 300 ||
    /[\r\n/\\]/.test(filename) ||
    sourceNote.trim().length < 8
  )
    throw new ForbiddenError("Проверьте исходный файл");
  const hash = digest(Buffer.from(content).toString("base64"));
  // The integrity checksum is over original bytes, while the id also binds the course.
  const sha256 = createHash("sha256").update(content).digest("hex");
  const id =
    "material-" +
    digest(user.groupId + ":" + courseId + ":" + hash).slice(0, 32);
  return prisma.$transaction(
    async (tx) => {
      if (
        !(await tx.groupMember.count({
          where: {
            userId: user.id,
            groupId: user.groupId,
            isOwner: true,
            group: {
              enrollments: {
                some: {
                  userId: user.id,
                  status: { in: ["CLAIMED", "VERIFIED"] },
                },
              },
            },
          },
        }))
      )
        throw new ForbiddenError("Нужен владелец группы");
      if (
        !(await tx.courseOffering.count({
          where: {
            id: courseId,
            status: "ACTIVE",
            mergedIntoId: null,
            groups: { some: { groupId: user.groupId } },
          },
        }))
      )
        throw new ForbiddenError("Предмет недоступен");
      const previous = await tx.materialFile.findUnique({
        where: { materialId: id },
        select: { sha256: true, byteSize: true },
      });
      if (previous) {
        if (
          previous.sha256 !== sha256 ||
          previous.byteSize !== content.byteLength
        )
          throw new ForbiddenError("Исходный файл изменился");
        return id;
      }
      await tx.courseMaterial.create({
        data: {
          id,
          courseOfferingId: courseId,
          title: filename,
          type: "OTHER",
          url: `https://studentvalue1984.eu.cc/materials/${id}`,
          sourceNote,
          fileSize: BigInt(content.byteLength),
          file: {
            create: {
              filename,
              mimeType,
              byteSize: content.byteLength,
              sha256,
              content: Buffer.from(content),
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "IMPORT_TEACHING_FILE",
          entityType: "COURSE_MATERIAL",
          entityId: id,
          details: {
            groupId: user.groupId,
            sha256,
            byteSize: content.byteLength,
          },
        },
      });
      return id;
    },
    { timeout: 20000 },
  );
}
