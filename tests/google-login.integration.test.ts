import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import { hashToken } from "../src/lib/auth/google";
import {
  completeGoogleLogin,
  createEnrollmentGrant,
} from "../src/server/domain/google-login";
async function invitation(groupId = "test-group") {
  const identity = {
    sub: randomUUID(),
    email: randomUUID() + "@example.invalid",
    name: "[TEST] Student",
  };
  const enrollment = await prisma.enrollment.create({
    data: { groupId, fullName: "[TEST] OAuth " + randomUUID() },
  });
  const grant = createEnrollmentGrant(enrollment.id, identity.email, null);
  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { claimToken: grant.stored },
  });
  return { identity, enrollment, grant };
}
describe("Google identity and enrollment transaction", () => {
  it("links an explicitly invited existing owner without replacing progress or privileges", async () => {
    const user = await prisma.user.create({
      data: { nickname: "[TEST] migrated-owner-" + randomUUID() },
    });
    const member = await prisma.groupMember.create({
      data: { userId: user.id, groupId: "test-group", isOwner: true },
    });
    const verifiedAt = new Date("2026-10-16T12:00:00Z");
    const enrollment = await prisma.enrollment.create({
      data: {
        groupId: "test-group",
        userId: user.id,
        fullName: "[TEST] Migrated " + randomUUID(),
        status: "VERIFIED",
        verifiedAt,
        verifiedById: "user-dev-owner",
      },
    });
    const progress = await prisma.studentTaskProgress.create({
      data: {
        userId: user.id,
        taskId: "task-otu-lab1",
        status: "IN_PROGRESS",
        studentNotes: "[TEST] Existing private work",
      },
    });
    const identity = {
      sub: randomUUID(),
      email: randomUUID() + "@example.invalid",
      name: "New Google name",
    };
    const grant = createEnrollmentGrant(enrollment.id, identity.email, user.id);
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { claimToken: grant.stored },
    });
    await expect(
      completeGoogleLogin(
        { ...identity, email: "wrong@example.invalid" },
        "test-group",
        grant.code,
      ),
    ).rejects.toThrow();
    const result = await completeGoogleLogin(
      identity,
      "test-group",
      grant.code,
    );
    expect(result.userId).toBe(user.id);
    expect(
      await prisma.studentTaskProgress.findUnique({
        where: { id: progress.id },
      }),
    ).toEqual(progress);
    expect(
      await prisma.groupMember.findUnique({ where: { id: member.id } }),
    ).toEqual(member);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toEqual(
      user,
    );
    expect(
      await prisma.enrollment.findUnique({ where: { id: enrollment.id } }),
    ).toMatchObject({
      userId: user.id,
      status: "VERIFIED",
      verifiedAt,
      verifiedById: "user-dev-owner",
      claimToken: null,
    });
    await expect(
      completeGoogleLogin(
        { ...identity, sub: randomUUID() },
        "test-group",
        grant.code,
      ),
    ).rejects.toThrow();
  });
  it("creates an unprivileged account, consumes the invitation and stores a hashed session", async () => {
    const { identity, enrollment, grant } = await invitation();
    const result = await completeGoogleLogin(
      identity,
      "test-group",
      grant.code,
    );
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: {
        memberships: { include: { userRoles: true } },
        identities: true,
      },
    });
    expect(user.isSystemAdmin).toBe(false);
    expect(user.memberships).toHaveLength(1);
    expect(user.memberships[0].isOwner).toBe(false);
    expect(user.memberships[0].userRoles).toHaveLength(0);
    expect(user.identities[0].provider).toBe("GOOGLE");
    const claimed = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
    });
    expect(claimed.userId).toBe(user.id);
    expect(claimed.claimToken).toBeNull();
    expect(claimed.status).toBe("CLAIMED");
    expect(claimed.verifiedAt).toBeNull();
    const session = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashToken(result.token) },
    });
    expect(session.userId).toBe(user.id);
    expect(session.tokenHash).not.toBe(result.token);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: enrollment.id, action: "GOOGLE_IDENTITY_LINKED" },
    });
    expect(JSON.stringify(audit)).not.toContain(grant.code);
    await expect(
      completeGoogleLogin(identity, "test-group", grant.code),
    ).rejects.toThrow();
    await expect(
      completeGoogleLogin(identity, "test-group"),
    ).resolves.toMatchObject({ userId: user.id });
  });
  it("does not grant access or merge an account by matching email alone", async () => {
    const { identity, grant } = await invitation();
    const first = await completeGoogleLogin(identity, "test-group", grant.code);
    await expect(
      completeGoogleLogin({ ...identity, sub: randomUUID() }, "test-group"),
    ).rejects.toThrow();
    expect(
      await prisma.authIdentity.count({
        where: { userId: first.userId, provider: "GOOGLE" },
      }),
    ).toBe(1);
  });
  it("rejects the wrong recipient without consuming a valid invitation", async () => {
    const { identity, enrollment, grant } = await invitation();
    await expect(
      completeGoogleLogin(
        { ...identity, email: "wrong@example.invalid" },
        "test-group",
        grant.code,
      ),
    ).rejects.toThrow();
    expect(
      (
        await prisma.enrollment.findUniqueOrThrow({
          where: { id: enrollment.id },
        })
      ).claimToken,
    ).toBe(grant.stored);
    await expect(
      completeGoogleLogin(identity, "test-group", grant.code),
    ).resolves.toBeDefined();
  });
  it("rejects foreign-group and archived enrollment invitations", async () => {
    const foreign = await invitation("test-other-group");
    await expect(
      completeGoogleLogin(foreign.identity, "test-group", foreign.grant.code),
    ).rejects.toThrow();
    const archived = await invitation();
    await prisma.enrollment.update({
      where: { id: archived.enrollment.id },
      data: { status: "ARCHIVED" },
    });
    await expect(
      completeGoogleLogin(archived.identity, "test-group", archived.grant.code),
    ).rejects.toThrow();
  });
  it("revokes repeat login when the enrollment is archived", async () => {
    const { identity, enrollment, grant } = await invitation();
    await completeGoogleLogin(identity, "test-group", grant.code);
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "ARCHIVED" },
    });
    await expect(completeGoogleLogin(identity, "test-group")).rejects.toThrow();
  });
  it("does not admit a known Google user without an active membership", async () => {
    const user = await prisma.user.create({
      data: { nickname: "[TEST] detached-" + randomUUID() },
    });
    const identity = {
      sub: randomUUID(),
      email: randomUUID() + "@example.invalid",
      name: "Detached",
    };
    await prisma.authIdentity.create({
      data: {
        provider: "GOOGLE",
        providerUserId: identity.sub,
        userId: user.id,
      },
    });
    await expect(completeGoogleLogin(identity, "test-group")).rejects.toThrow();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
  it("consumes a grant at most once under concurrent callbacks", async () => {
    const { identity, enrollment, grant } = await invitation();
    const results = await Promise.allSettled([
      completeGoogleLogin(identity, "test-group", grant.code),
      completeGoogleLogin(identity, "test-group", grant.code),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const linked = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
    });
    expect(
      await prisma.session.count({ where: { userId: linked.userId! } }),
    ).toBe(1);
    expect(
      await prisma.authIdentity.count({
        where: { provider: "GOOGLE", providerUserId: identity.sub },
      }),
    ).toBe(1);
  });
});
