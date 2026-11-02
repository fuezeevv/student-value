import { expect, it } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import type { SessionUser } from "../src/lib/auth/session";
import {
  publishReconstructedLesson,
  storeTeachingFile,
  type ReconstructionInput,
} from "../src/server/domain/lesson-reconstruction";
import {
  materialFileChunk,
  visibleMaterialFile,
} from "../src/server/domain/material-files";
import { saveLesson } from "../src/server/domain/lessons";
const owner: SessionUser = {
  id: "user-dev-owner",
  groupId: "test-group",
  nickname: "[TEST] owner",
  isOwner: true,
  isSystemAdmin: false,
  permissions: [],
  avatarUrl: null,
  bio: null,
};
const student = { ...owner, id: "user-dev-student", isOwner: false };
async function setup() {
  const c = await prisma.courseOffering.create({
    data: {
      semester: { connect: { id: "test-semester" } },
      courseDefinition: {
        create: {
          code: "TEST-JOURNAL-" + randomUUID(),
          title: "[TEST] course",
          shortTitle: "[TEST]",
        },
      },
      groups: { create: { groupId: owner.groupId } },
    },
  });
  const input: ReconstructionInput = {
    key: "test-" + randomUUID(),
    courseOfferingId: c.id,
    day: "2026-09-11",
    time: "14:00",
    endTime: "15:40",
    type: "PRACTICE",
    topic: "[TEST] practice",
    taughtBy: null,
    room: null,
    summary: null,
    guideText: null,
    assignmentNotes: null,
    audienceNote: "[TEST] subgroup 1",
    scheduleUrl:
      "https://ruz.spbstu.ru/faculty/125/groups/45591?date=2026-09-07",
    coverage: "SCHEDULE_ONLY",
    evidence: [
      {
        label: "[TEST] schedule",
        url: "https://ruz.spbstu.ru/",
        relation: "DIRECT",
      },
    ],
    transcripts: [],
    materials: [],
    relatedTaskIds: [],
  };
  return { c, input };
}
it("publishes a sourced schedule entry once, creates no homework/deadline/progress, and refuses overwriting an edited lesson", async () => {
  const { input, c } = await setup();
  const before = await Promise.all([
    prisma.task.count({ where: { courseOfferingId: c.id } }),
    prisma.deadline.count({ where: { task: { courseOfferingId: c.id } } }),
    prisma.studentTaskProgress.count({
      where: { task: { courseOfferingId: c.id } },
    }),
  ]);
  const r = await publishReconstructedLesson(owner, input);
  expect(r.created).toBe(true);
  expect((await publishReconstructedLesson(owner, input)).created).toBe(false);
  expect(
    await Promise.all([
      prisma.task.count({ where: { courseOfferingId: c.id } }),
      prisma.deadline.count({ where: { task: { courseOfferingId: c.id } } }),
      prisma.studentTaskProgress.count({
        where: { task: { courseOfferingId: c.id } },
      }),
    ]),
  ).toEqual(before);
  const l = await prisma.classSession.findUniqueOrThrow({
    where: { id: r.id },
    include: { context: true, sources: { include: { references: true } } },
  });
  expect(l.context?.coverage).toBe("SCHEDULE_ONLY");
  expect(l.sources[0].references[0].entityId).toBe(l.id);
  await prisma.classSession.update({
    where: { id: r.id },
    data: { version: { increment: 1 }, summary: "[TEST] human correction" },
  });
  await expect(publishReconstructedLesson(owner, input)).rejects.toThrow(
    "изменена",
  );
});
it("does not trust an ownership flag or allow content to be silently labelled schedule-only", async () => {
  const { input } = await setup();
  await expect(
    publishReconstructedLesson({ ...student, isOwner: true }, input),
  ).rejects.toThrow();
  await expect(
    publishReconstructedLesson(owner, {
      ...input,
      summary: "[TEST] generated assumption",
    }),
  ).rejects.toThrow();
  await expect(
    publishReconstructedLesson(owner, { ...input, day: "2027-01-01" }),
  ).rejects.toThrow();
});

it("keeps recording parts together and lets the normal editor complete a timetable gap", async () => {
  const { input } = await setup();
  const combined = await publishReconstructedLesson(owner, {
    ...input,
    coverage: "TRANSCRIPT",
    transcripts: [
      { text: "[TEST] first part", label: "part 1", sha256: "a".repeat(64) },
      { text: "[TEST] second part", label: "part 2", sha256: "b".repeat(64) },
    ],
  });
  const texts = await prisma.transcript.findMany({
    where: { sessionId: combined.id },
  });
  expect(texts).toHaveLength(1);
  expect(texts[0].rawText).toContain("first part");
  expect(texts[0].rawText).toContain("second part");
  const gap = await setup(),
    created = await publishReconstructedLesson(owner, gap.input);
  await saveLesson(
    owner,
    {
      courseOfferingId: gap.c.id,
      topic: "[TEST] Completed lesson",
      day: gap.input.day,
      time: gap.input.time,
      endTime: gap.input.endTime,
      type: gap.input.type,
      summary: "[TEST] Sourced summary",
      sourceNote: "[TEST] Owner reviewed the source",
    },
    created.id,
    0,
  );
  expect(
    (
      await prisma.lessonContext.findUniqueOrThrow({
        where: { sessionId: created.id },
      })
    ).coverage,
  ).toBe("RECONSTRUCTED");
});

it("related work obeys both course scope and explicit task audience", async () => {
  const { c, input } = await setup();
  const task = await prisma.task.create({
    data: {
      courseOfferingId: c.id,
      title: "[TEST] Related task",
      type: "HOMEWORK",
      status: "PUBLISHED",
      createdById: owner.id,
      updatedById: owner.id,
    },
  });
  await expect(
    publishReconstructedLesson(owner, {
      ...input,
      coverage: "MATERIALS",
      relatedTaskIds: [task.id],
    }),
  ).rejects.toThrow("недоступна");
  await prisma.taskAudience.create({
    data: { taskId: task.id, targetType: "GROUP", groupId: owner.groupId },
  });
  const lesson = await publishReconstructedLesson(owner, {
    ...input,
    coverage: "MATERIALS",
    relatedTaskIds: [task.id],
  });
  expect(
    await prisma.sessionTask.count({
      where: { sessionId: lesson.id, taskId: task.id },
    }),
  ).toBe(1);
  const other = await setup();
  await expect(
    publishReconstructedLesson(owner, {
      ...other.input,
      coverage: "MATERIALS",
      relatedTaskIds: [task.id],
    }),
  ).rejects.toThrow("недоступна");
});
it("keeps original bytes private to their course group, serves bounded chunks and rejects an invalid chunk", async () => {
  const { c } = await setup();
  const body = Buffer.alloc(1024 * 1024 + 10, 87);
  const id = await storeTeachingFile(
    owner,
    c.id,
    "test-original.txt",
    "text/plain",
    body,
    "[TEST] original teacher file",
  );
  expect(
    await storeTeachingFile(
      owner,
      c.id,
      "test-original.txt",
      "text/plain",
      body,
      "[TEST] original teacher file",
    ),
  ).toBe(id);
  const f = await visibleMaterialFile(student, id);
  expect(f?.sha256).toBe(createHash("sha256").update(body).digest("hex"));
  expect(f).not.toHaveProperty("content");
  expect((await materialFileChunk(student, id, 0))?.byteLength).toBe(
    1024 * 1024,
  );
  expect(Buffer.from((await materialFileChunk(student, id, 1))!)).toEqual(
    body.subarray(1024 * 1024),
  );
  expect(await materialFileChunk(student, id, 2)).toBe(null);
  expect(await materialFileChunk(student, id, -1)).toBe(null);
  expect(
    await materialFileChunk(
      { ...student, groupId: "test-other-group", isSystemAdmin: true },
      id,
      0,
    ),
  ).toBe(null);
  await expect(
    storeTeachingFile(
      { ...student, isOwner: true },
      c.id,
      "x.txt",
      "text/plain",
      body,
      "[TEST] unknown source",
    ),
  ).rejects.toThrow();
});
it("hides a file linked only to a draft lesson and rejects cross-course links and active aliases", async () => {
  const { c, input } = await setup(),
    other = await setup();
  const id = await storeTeachingFile(
    owner,
    c.id,
    "test.txt",
    "text/plain",
    Buffer.from("[TEST] teaching file"),
    "[TEST] original source",
  );
  const m = await prisma.courseMaterial.findUniqueOrThrow({ where: { id } });
  await expect(
    publishReconstructedLesson(owner, {
      ...other.input,
      coverage: "MATERIALS",
      materials: [m],
    }),
  ).rejects.toThrow();
  const l = await prisma.classSession.create({
    data: {
      courseOfferingId: c.id,
      sessionDate: new Date("2026-10-01"),
      type: "LAB",
      status: "DRAFT",
      materials: { create: { materialId: id } },
    },
  });
  expect(await visibleMaterialFile(student, id)).toBe(null);
  await prisma.classSession.update({
    where: { id: l.id },
    data: { status: "PUBLISHED" },
  });
  expect(await visibleMaterialFile(student, id)).not.toBe(null);
  await prisma.courseOffering.update({
    where: { id: c.id },
    data: { status: "ARCHIVED" },
  });
  expect(await visibleMaterialFile(student, id)).toBe(null);
  await expect(publishReconstructedLesson(owner, input)).rejects.toThrow();
});
