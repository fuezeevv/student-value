import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { equalSecret, hashToken, type GoogleIdentity } from "@/lib/auth/google";

export function createEnrollmentGrant(
  enrollmentId: string,
  email: string,
  userId: string | null,
  now = Date.now(),
  intent?: { groupId: string; owner: boolean },
) {
  const normalized = email.trim().toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ||
    normalized.length > 254 ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(enrollmentId)
  )
    throw Error("Invalid invitation recipient");
  const token = randomBytes(32).toString("base64url");
  return {
    code: enrollmentId + "." + token,
    stored: JSON.stringify({
      v: intent ? 2 : 1,
      ...(intent ?? {}),
      enrollmentId,
      hash: hashToken(token),
      recipient: hashToken(normalized),
      userId,
      expires: now + 72 * 3600 * 1000,
    }),
  };
}
export function checkEnrollmentGrant(
  code: string,
  stored: string | null,
  email: string,
  userId: string | null,
  now = Date.now(),
  intent?: { groupId: string; owner: boolean },
) {
  try {
    if (!/^[a-zA-Z0-9_-]{1,80}\.[a-zA-Z0-9_-]{43}$/.test(code) || !stored)
      return false;
    const grant = JSON.parse(stored);
    return (
      (grant.v === 1 || grant.v === 2) &&
      (grant.v === 1
        ? !intent?.owner
        : grant.groupId === intent?.groupId && grant.owner === intent?.owner) &&
      grant.enrollmentId === code.split(".")[0] &&
      grant.userId === userId &&
      typeof grant.expires === "number" &&
      grant.expires > now &&
      typeof grant.hash === "string" &&
      equalSecret(grant.hash, hashToken(code.split(".")[1])) &&
      typeof grant.recipient === "string" &&
      equalSecret(grant.recipient, hashToken(email.trim().toLowerCase()))
    );
  } catch {
    return false;
  }
}

/** Called only after cryptographic Google verification. groupId is resolved by the server. */
export async function completeGoogleLogin(
  identity: GoogleIdentity,
  groupId: string,
  invite = "",
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  const denied = () => {
    throw Error("Google account is not linked to an active enrollment");
  };
  const userId = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.authIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: "GOOGLE",
            providerUserId: identity.sub,
          },
        },
      });
      let target = existing?.userId;
      if (existing && !invite) {
        const enrollment = await tx.enrollment.findFirst({
          where: {
            groupId,
            userId: target,
            status: { in: ["CLAIMED", "VERIFIED"] },
          },
        });
        const member = await tx.groupMember.findUnique({
          where: { groupId_userId: { groupId, userId: target! } },
        });
        if (!enrollment || !member) denied();
      } else {
        const enrollment = invite
          ? await tx.enrollment.findUnique({
              where: { id: invite.split(".")[0] },
            })
          : null;
        if (
          !enrollment ||
          enrollment.groupId !== groupId ||
          enrollment.status === "ARCHIVED" ||
          !checkEnrollmentGrant(
            invite,
            enrollment.claimToken,
            identity.email,
            enrollment.userId,
            Date.now(),
            { groupId, owner: enrollment.initialOwner },
          )
        )
          return denied();
        if (
          enrollment.userId &&
          enrollment.userId !== existing?.userId &&
          (await tx.authIdentity.findFirst({
            where: { userId: enrollment.userId, provider: "GOOGLE" },
          }))
        )
          denied();
        if (
          existing &&
          enrollment.userId &&
          enrollment.userId !== existing.userId
        )
          denied();
        target =
          existing?.userId ??
          enrollment.userId ??
          (
            await tx.user.create({
              data: {
                nickname:
                  (identity.name.trim() || "Студент").slice(0, 40) +
                  "-" +
                  randomBytes(6).toString("hex"),
              },
            })
          ).id;
        const consumed = await tx.enrollment.updateMany({
          where: {
            id: enrollment.id,
            groupId,
            userId: enrollment.userId,
            claimToken: enrollment.claimToken,
            status: { not: "ARCHIVED" },
          },
          data: {
            userId: target,
            claimToken: null,
            initialOwner: false,
            status:
              enrollment.userId && enrollment.status === "VERIFIED"
                ? "VERIFIED"
                : "CLAIMED",
            ...(enrollment.userId
              ? {}
              : { verifiedById: null, verifiedAt: null }),
          },
        });
        if (consumed.count !== 1) denied();
        if (!existing)
          await tx.authIdentity.create({
            data: {
              userId: target,
              provider: "GOOGLE",
              providerUserId: identity.sub,
              email: identity.email,
            },
          });
        await tx.groupMember.upsert({
          where: { groupId_userId: { groupId, userId: target } },
          update: {},
          create: { groupId, userId: target, isOwner: enrollment.initialOwner },
        });
        await tx.auditLog.create({
          data: {
            userId: target,
            action: "GOOGLE_IDENTITY_LINKED",
            entityType: "ENROLLMENT",
            entityId: enrollment.id,
            details: { groupId, method: "RECIPIENT_BOUND_INVITATION" },
          },
        });
      }
      await tx.session.create({
        data: { userId: target!, tokenHash: hashToken(token), expiresAt },
      });
      return target!;
    },
    { isolationLevel: "Serializable" },
  );
  return { userId, token, expiresAt };
}

/** Callback input is untrusted; resolve the group from a real invitation or active membership. */
export async function resolveGoogleLoginGroup(
  identity: GoogleIdentity,
  invite: string,
) {
  if (invite) {
    if (!/^[a-zA-Z0-9_-]{1,80}\.[a-zA-Z0-9_-]{43}$/.test(invite))
      throw Error("Invalid invitation");
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { id: invite.split(".")[0] },
    });
    return enrollment.groupId;
  }
  const linked = await prisma.authIdentity.findUniqueOrThrow({
    where: {
      provider_providerUserId: {
        provider: "GOOGLE",
        providerUserId: identity.sub,
      },
    },
  });
  const member = await prisma.groupMember.findFirst({
    where: {
      userId: linked.userId,
      group: {
        enrollments: {
          some: {
            userId: linked.userId,
            status: { in: ["CLAIMED", "VERIFIED"] },
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
  if (!member) throw Error("No active enrollment");
  return member.groupId;
}
