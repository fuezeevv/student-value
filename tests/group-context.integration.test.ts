import { editTask } from "../src/server/domain/task-editing";
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import type { SessionUser } from "../src/lib/auth/session";
import { hasPermission } from "../src/lib/permissions/checker";
import {
  createGroupWorkspace,
  reissueHeadmanInvitation,
  inviteGroupMember,
  delegateCourse,
  addGroupCourse,
} from "../src/server/domain/group-workspace";
import {
  completeGoogleLogin,
  createEnrollmentGrant,
  resolveGoogleLoginGroup,
} from "../src/server/domain/google-login";
import {
  saveLesson,
  addMaterial,
  lessonDate,
} from "../src/server/domain/lessons";
import {
  proposeChange,
  reviewProposal,
  shareBrief,
  archiveSharedBrief,
  suggestTranscriptNotes,
} from "../src/server/domain/proposals";
const owner: SessionUser = {
  id: "user-dev-owner",
  nickname: "[TEST] owner",
  avatarUrl: null,
  bio: null,
  isSystemAdmin: false,
  isOwner: true,
  groupId: "test-group",
  permissions: [],
  isPlatformOwner: true,
};
const student: SessionUser = {
  ...owner,
  id: "user-dev-student",
  nickname: "[TEST] student",
  isOwner: false,
  isPlatformOwner: false,
};
const note =
  "[TEST] Exact statement supplied for isolated integration checking";
const lessonInput = (extra = {}) => ({
  courseOfferingId: "test-course",
  topic: "[TEST] Lesson " + randomUUID(),
  day: "2026-10-17",
  type: "LECTURE",
  sourceNote: note,
  status: "PUBLISHED",
  ...extra,
});
async function group() {
  const email = randomUUID() + "@example.invalid";
  const created = await createGroupWorkspace(owner, {
    code: "TEST-" + randomUUID(),
    name: "[TEST] Separate group",
    headmanName: "[TEST] Headman " + randomUUID(),
    headmanEmail: email,
  });
  const identity = { sub: randomUUID(), email, name: "[TEST] Headman" };
  const login = await completeGoogleLogin(
    identity,
    created.groupId,
    created.code,
  );
  return {
    ...created,
    identity,
    user: {
      ...owner,
      id: login.userId,
      groupId: created.groupId,
      isPlatformOwner: false,
    },
  };
}
async function task() {
  return prisma.task.create({
    data: {
      courseOfferingId: "test-course",
      title: "[TEST] Proposal target " + randomUUID(),
      type: "HOMEWORK",
      createdById: owner.id,
      updatedById: owner.id,
      audiences: { create: { targetType: "GROUP", groupId: owner.groupId } },
    },
  });
}
async function proposal(extra = {}) {
  return proposeChange(student, {
    courseOfferingId: "test-course",
    kind: "NOTE",
    title: "[TEST] Clarification " + randomUUID(),
    content: note,
    sourceNote: note,
    ...extra,
  });
}
const approve = {
  decision: "APPROVE",
  reviewNote: "[TEST] Checked against the isolated source statement",
};

describe("Independent group workspaces and identity", () => {
  it("platform ownership does not grant academic or private roster permissions", async () => {
    const operator = { ...student, isSystemAdmin: true, isPlatformOwner: true };
    expect(hasPermission(operator, "view_private_member_identity")).toBe(false);
    expect(hasPermission(operator, "manage_tasks")).toBe(false);
    expect(hasPermission(owner, "manage_tasks", "test-other-group")).toBe(
      false,
    );
    await expect(
      createGroupWorkspace(student, {
        code: "X",
        name: "X",
        headmanName: "X",
        headmanEmail: "x@example.invalid",
      }),
    ).rejects.toThrow();
  });
  it("creates an empty group and grants its headman ownership only after the bound Google login", async () => {
    const g = await group();
    expect(
      await prisma.courseOfferingGroup.count({ where: { groupId: g.groupId } }),
    ).toBe(0);
    const member = await prisma.groupMember.findUniqueOrThrow({
      where: { groupId_userId: { groupId: g.groupId, userId: g.user.id } },
    });
    expect(member.isOwner).toBe(true);
    expect(
      await prisma.user.findUnique({ where: { id: g.user.id } }),
    ).toMatchObject({ isSystemAdmin: false, isPlatformOwner: false });
    await expect(
      completeGoogleLogin(g.identity, g.groupId, g.code),
    ).rejects.toThrow();
  });
  it("joins a second group with an existing Google identity without duplicating users or transferring ownership", async () => {
    const g = await group();
    const count = await prisma.user.count();
    const grant = await inviteGroupMember(owner, {
      fullName: "[TEST] Second membership " + randomUUID(),
      email: g.identity.email,
    });
    const login = await completeGoogleLogin(
      g.identity,
      owner.groupId,
      grant.code,
    );
    expect(login.userId).toBe(g.user.id);
    expect(await prisma.user.count()).toBe(count);
    expect(
      await prisma.authIdentity.count({
        where: { userId: g.user.id, provider: "GOOGLE" },
      }),
    ).toBe(1);
    expect(
      await prisma.groupMember.findUnique({
        where: {
          groupId_userId: { groupId: owner.groupId, userId: g.user.id },
        },
      }),
    ).toMatchObject({ isOwner: false });
    expect(
      await prisma.groupMember.count({ where: { userId: g.user.id } }),
    ).toBe(2);
    expect(await resolveGoogleLoginGroup(g.identity, "")).toBe(g.groupId);
  });
  it("binds privileged invitation intent and never upgrades an ordinary invitation", async () => {
    const e = await prisma.enrollment.create({
      data: {
        groupId: owner.groupId,
        fullName: "[TEST] Role tamper " + randomUUID(),
        initialOwner: true,
      },
    });
    const identity = {
      sub: randomUUID(),
      email: randomUUID() + "@example.invalid",
      name: "[TEST]",
    };
    const ordinary = createEnrollmentGrant(
      e.id,
      identity.email,
      null,
      Date.now(),
      { groupId: owner.groupId, owner: false },
    );
    await prisma.enrollment.update({
      where: { id: e.id },
      data: { claimToken: ordinary.stored },
    });
    await expect(
      completeGoogleLogin(identity, owner.groupId, ordinary.code),
    ).rejects.toThrow();
    const legacy = createEnrollmentGrant(e.id, identity.email, null);
    await prisma.enrollment.update({
      where: { id: e.id },
      data: { claimToken: legacy.stored },
    });
    await expect(
      completeGoogleLogin(identity, owner.groupId, legacy.code),
    ).rejects.toThrow();
    expect(
      await prisma.authIdentity.count({
        where: { providerUserId: identity.sub },
      }),
    ).toBe(0);
  });
  it("reissues an unclaimed headman invite only to its original recipient", async () => {
    const recipient = randomUUID() + "@example.invalid";
    const pending = await createGroupWorkspace(owner, {
      code: "TEST-" + randomUUID(),
      name: "[TEST] Pending",
      headmanName: "[TEST] Headman",
      headmanEmail: recipient,
    });
    await expect(
      reissueHeadmanInvitation(student, pending.groupId, recipient),
    ).rejects.toThrow();
    await expect(
      reissueHeadmanInvitation(
        owner,
        pending.groupId,
        "different@example.invalid",
      ),
    ).rejects.toThrow();
    const replacement = await reissueHeadmanInvitation(
      owner,
      pending.groupId,
      recipient,
    );
    const identity = {
      sub: randomUUID(),
      email: recipient,
      name: "[TEST] Headman",
    };
    await expect(
      completeGoogleLogin(identity, pending.groupId, pending.code),
    ).rejects.toThrow();
    await completeGoogleLogin(identity, pending.groupId, replacement.code);
    await expect(
      reissueHeadmanInvitation(owner, pending.groupId, recipient),
    ).rejects.toThrow();
  });
  it("cannot overwrite a linked roster profile or invite from another group", async () => {
    const e = await prisma.enrollment.findUniqueOrThrow({
      where: { groupId_userId: { groupId: owner.groupId, userId: student.id } },
    });
    await expect(
      inviteGroupMember(owner, {
        enrollmentId: e.id,
        fullName: e.fullName,
        email: "a@example.invalid",
      }),
    ).rejects.toThrow();
    await expect(
      inviteGroupMember(
        { ...owner, groupId: "test-other-group" },
        {
          enrollmentId: e.id,
          fullName: e.fullName,
          email: "a@example.invalid",
        },
      ),
    ).rejects.toThrow();
  });
  it("delegates one subject without verification or roster privileges and revokes it", async () => {
    const member = await prisma.groupMember.findUniqueOrThrow({
      where: {
        groupId_userId: { groupId: owner.groupId, userId: "test-peer" },
      },
    });
    await delegateCourse(owner, member.id, "test-course", true);
    const delegated = {
      ...student,
      id: "test-peer",
      permissions: ["manage_course:test-course"],
    };
    const id = await saveLesson(delegated, lessonInput());
    expect(id).toBeTruthy();
    expect(hasPermission(delegated, "verify_progress")).toBe(false);
    expect(hasPermission(delegated, "view_private_member_identity")).toBe(
      false,
    );
    await expect(
      saveLesson(
        delegated,
        lessonInput({ courseOfferingId: "test-other-course" }),
      ),
    ).rejects.toThrow();
    await expect(
      delegateCourse(delegated, member.id, "test-course", true),
    ).rejects.toThrow();
    await delegateCourse(owner, member.id, "test-course", false);
    expect(
      await prisma.userGroupRole.count({
        where: {
          groupMemberId: member.id,
          role: {
            permissions: { some: { permission: "manage_course:test-course" } },
          },
        },
      }),
    ).toBe(0);
  });
});
describe("Lesson context and structured review", () => {
  it("preserves dates, earlier transcript versions, links and optimistic history", async () => {
    expect(lessonDate("2026-10-17", "09:30").toISOString()).toBe(
      "2026-10-17T06:30:00.000Z",
    );
    expect(() => lessonDate("2026-02-30")).toThrow();
    const id = await saveLesson(
      owner,
      lessonInput({
        recordingUrl: "https://drive.google.com/file/d/test/view",
        transcriptText:
          "[TEST] Лабораторную нужно сдать после проверки отчёта.",
        taskIds: ["task-otu-lab1"],
      }),
    );
    const first = await prisma.classSession.findUniqueOrThrow({
      where: { id },
    });
    expect(first.isTimeKnown).toBe(false);
    await saveLesson(
      owner,
      lessonInput({
        summary: "[TEST] Updated lesson summary",
        transcriptText: "[TEST] New literal transcript version",
      }),
      id,
      first.version,
    );
    expect(await prisma.transcript.count({ where: { sessionId: id } })).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: { entityId: id, action: "UPDATE_LESSON" },
      }),
    ).toBe(1);
    await expect(
      saveLesson(owner, lessonInput(), id, first.version),
    ).rejects.toThrow();
  });
  it("does not duplicate lesson notifications on a no-op save and preserves public notes", async () => {
    const input = lessonInput({
      notes: "[TEST] Public notes preserved",
      summary: note,
    });
    const id = await saveLesson(owner, input);
    const before = await prisma.notification.count({
      where: { link: `/lessons/${id}` },
    });
    expect(before).toBeGreaterThan(0);
    await saveLesson(owner, input, id, 0);
    expect(
      await prisma.notification.count({ where: { link: `/lessons/${id}` } }),
    ).toBe(before);
    expect(
      await prisma.classSession.findUnique({ where: { id } }),
    ).toMatchObject({ notes: "[TEST] Public notes preserved", version: 0 });
    await saveLesson(owner, { ...input, day: "2026-10-18" }, id, 0);
    expect(
      await prisma.notification.count({ where: { link: `/lessons/${id}` } }),
    ).toBe(before * 2);
  });
  it("denies student/foreign lesson mutations, private task links and unsafe external URLs", async () => {
    await expect(saveLesson(student, lessonInput())).rejects.toThrow();
    await expect(
      saveLesson(owner, lessonInput({ courseOfferingId: "test-other-course" })),
    ).rejects.toThrow();
    await expect(
      saveLesson(owner, lessonInput({ taskIds: ["test-individual-task"] })),
    ).rejects.toThrow();
    await expect(
      saveLesson(owner, lessonInput({ recordingUrl: "javascript:alert(1)" })),
    ).rejects.toThrow();
    await expect(
      addMaterial(owner, {
        courseOfferingId: "test-course",
        title: "[TEST] File",
        url: "http://localhost/secret",
        sourceNote: note,
      }),
    ).rejects.toThrow();
  });
  it("keeps proposals unpublished until approval and applies requirements once without changing progress", async () => {
    const t = await task();
    const before = await prisma.studentTaskProgress.findMany({
      orderBy: { id: "asc" },
    });
    const p = await proposal({ kind: "TASK_REQUIREMENT", taskId: t.id });
    expect(
      await prisma.taskRequirement.count({ where: { taskId: t.id } }),
    ).toBe(0);
    await expect(reviewProposal(student, p.id, approve)).rejects.toThrow();
    await reviewProposal(owner, p.id, approve);
    expect(
      await prisma.taskRequirement.count({ where: { taskId: t.id } }),
    ).toBe(1);
    await expect(reviewProposal(owner, p.id, approve)).rejects.toThrow();
    expect(
      await prisma.studentTaskProgress.findMany({ orderBy: { id: "asc" } }),
    ).toEqual(before);
    const requirement = await prisma.taskRequirement.findFirstOrThrow({
      where: { taskId: t.id },
      include: { sourceReference: { include: { source: true } } },
    });
    expect(requirement.sourceReference.source.groupId).toBe(owner.groupId);
    expect(requirement.sourceReference.source.type).toBe("HEADMAN_RECORD");
  });
  it("edits task content with optimistic history and never alters private progress", async () => {
    const t = await task();
    const before = await prisma.studentTaskProgress.findMany({
      orderBy: { id: "asc" },
    });
    const input = {
      title: "[TEST] Corrected assignment",
      description: "[TEST] Literal corrected instructions",
      sourceNote: note,
      updatedAt: t.updatedAt.toISOString(),
    };
    await expect(editTask(student, t.id, input)).rejects.toThrow();
    await editTask(owner, t.id, input);
    expect(await prisma.task.findUnique({ where: { id: t.id } })).toMatchObject(
      { title: input.title, description: input.description },
    );
    expect(
      await prisma.auditLog.findFirst({
        where: { entityId: t.id, action: "EDIT_TASK_CONTENT" },
      }),
    ).toMatchObject({
      details: { before: { title: t.title }, after: { title: input.title } },
    });
    expect(
      await prisma.studentTaskProgress.findMany({ orderBy: { id: "asc" } }),
    ).toEqual(before);
    await expect(editTask(owner, t.id, input)).rejects.toThrow();
    await expect(
      editTask(owner, "test-individual-task", input),
    ).rejects.toThrow();
  });
  it("notifies eligible local reviewers without broadcasting an unconfirmed proposal to other students", async () => {
    const p = await proposal();
    const notices = await prisma.notification.findMany({
      where: {
        link: "/proposals",
        message: p.title,
        title: "Нужно проверить уточнение",
      },
    });
    expect(
      notices.some((n) => n.userId === owner.id && n.groupId === owner.groupId),
    ).toBe(true);
    expect(notices.some((n) => n.userId === student.id)).toBe(false);
    expect(notices.every((n) => n.groupId === owner.groupId)).toBe(true);
  });
  it("commits at most one publication for concurrent approvals", async () => {
    const t = await task();
    const p = await proposal({ kind: "TASK_REQUIREMENT", taskId: t.id });
    const result = await Promise.allSettled([
      reviewProposal(owner, p.id, approve),
      reviewProposal(owner, p.id, approve),
    ]);
    expect(result.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(
      await prisma.taskRequirement.count({ where: { taskId: t.id } }),
    ).toBe(1);
    expect(
      await prisma.source.count({
        where: { documentMetadata: { path: ["proposalId"], equals: p.id } },
      }),
    ).toBe(1);
  });
  it("rejects foreign proposals, task audiences and forged transcript references", async () => {
    const p = await proposal();
    await expect(
      reviewProposal({ ...owner, groupId: "test-other-group" }, p.id, approve),
    ).rejects.toThrow();
    await expect(
      proposal({ taskId: "test-individual-task" }),
    ).rejects.toThrow();
    const id = await saveLesson(owner, lessonInput({ transcriptText: note }));
    const transcript = await prisma.transcript.findFirstOrThrow({
      where: { sessionId: id },
    });
    await expect(
      proposal({
        transcriptId: transcript.id,
        quoteStart: 0,
        quoteEnd: note.length,
      }),
    ).rejects.toThrow();
    await expect(
      proposal({
        sessionId: id,
        transcriptId: transcript.id,
        quoteStart: 0,
        quoteEnd: note.length,
        sourceNote: "[TEST] A fabricated different quote",
      }),
    ).rejects.toThrow();
  });
  it("stores exact transcript cues as unconfirmed proposals, deduplicates and never guesses a date", async () => {
    const text =
      "[TEST] В отчёте обязательно привести расчёт.\nЛабораторную сдать двадцать какого-то числа.\n<img src=x onerror=alert(1)>";
    const id = await saveLesson(owner, lessonInput({ transcriptText: text }));
    const count = await suggestTranscriptNotes(student, id);
    expect(count).toBe(2);
    expect(await suggestTranscriptNotes(student, id)).toBe(0);
    const cues = await prisma.changeProposal.findMany({
      where: { sessionId: id, authorId: student.id },
    });
    for (const cue of cues) {
      expect(cue.status).toBe("PENDING");
      expect(cue.proposedDay).toBeNull();
      expect(text.slice(cue.quoteStart!, cue.quoteEnd!)).toBe(cue.sourceNote);
    }
    expect(
      await prisma.announcement.count({
        where: { title: { startsWith: "Проверить фразу:" } },
      }),
    ).toBe(0);
  });
  it("publishes deadline proposals with preserved history and a single active date", async () => {
    const t = await task();
    const p = await proposal({
      kind: "DEADLINE",
      taskId: t.id,
      proposedDay: "2026-10-21",
    });
    expect(await prisma.deadline.count({ where: { taskId: t.id } })).toBe(0);
    await reviewProposal(owner, p.id, approve);
    const original = await prisma.deadline.findFirstOrThrow({
      where: { taskId: t.id },
    });
    expect(original.date.toISOString()).toBe("2026-10-21T20:59:59.999Z");
    const next = await proposal({
      kind: "DEADLINE",
      taskId: t.id,
      proposedDay: "2026-10-24",
    });
    await reviewProposal(owner, next.id, approve);
    expect(
      await prisma.deadline.count({
        where: { taskId: t.id, status: "ACTIVE" },
      }),
    ).toBe(1);
    expect(
      await prisma.deadline.findUnique({ where: { id: original.id } }),
    ).toMatchObject({ status: "SUPERSEDED" });
    expect(
      await prisma.deadline.findFirst({
        where: { taskId: t.id, status: "ACTIVE" },
      }),
    ).toMatchObject({ originalDeadlineId: original.id });
    expect(
      await prisma.changeProposal.findUnique({ where: { id: next.id } }),
    ).toMatchObject({ status: "APPROVED" });
  });
  it("withdraws a shared brief without silently applying a previously copied proposal", async () => {
    const g = await group();
    const course = await addGroupCourse(g.user, {
      title: "[TEST] Foreign subject",
    });
    const id = await shareBrief(owner, {
      courseOfferingId: "test-course",
      title: "[TEST] Withdraw",
      content: note,
      sourceNote: note,
    });
    const p = await proposeChange(g.user, {
      courseOfferingId: course,
      kind: "NOTE",
      title: "[TEST] Snapshot",
      content: note,
      sourceNote: note,
      sharedBriefId: id,
    });
    await expect(archiveSharedBrief(g.user, id)).rejects.toThrow();
    await archiveSharedBrief(owner, id);
    await expect(reviewProposal(g.user, p.id, approve)).rejects.toThrow();
    expect(
      await prisma.changeProposal.findUnique({ where: { id: p.id } }),
    ).toMatchObject({ status: "PENDING" });
  });
  it("shares only an explicit brief and requires a separate local decision", async () => {
    const g = await group();
    const courseId = await addGroupCourse(g.user, {
      title: "[TEST] Same subject",
      shortTitle: "[TEST] Subject",
    });
    const briefId = await shareBrief(owner, {
      courseOfferingId: "test-course",
      title: "[TEST] Shared clarification",
      content: note,
      sourceNote: note,
    });
    const count = await prisma.announcement.count({
      where: { groupId: g.groupId },
    });
    const p = await proposeChange(g.user, {
      courseOfferingId: courseId,
      kind: "NOTE",
      title: "[TEST] Local review",
      content: note,
      sourceNote: note,
      sharedBriefId: briefId,
    });
    expect(p.status).toBe("PENDING");
    expect(
      await prisma.announcement.count({ where: { groupId: g.groupId } }),
    ).toBe(count);
    await reviewProposal(g.user, p.id, approve);
    expect(
      await prisma.announcement.count({ where: { groupId: g.groupId } }),
    ).toBe(count + 1);
    expect(
      await prisma.studentTaskProgress.count({ where: { userId: g.user.id } }),
    ).toBe(0);
  });
});
