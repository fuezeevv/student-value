import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

export interface SessionUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isSystemAdmin: boolean;
  isOwner: boolean;
  groupId: string;
  permissions: string[];
}

const DEV_COOKIE_NAME = "study_dev_user_id";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();

  const isDevAuth =
    process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_AUTH === "true";

  let targetUserId = "user-dev-owner"; // Default fallback in development/demo

  if (isDevAuth) {
    const devCookie = cookieStore.get(DEV_COOKIE_NAME)?.value;
    if (devCookie === "guest") {
      return null;
    }
    if (devCookie) {
      targetUserId = devCookie;
    }
  } else {
    const sessionToken = cookieStore.get("__Host-session")?.value;
    if (!sessionToken) return null;

    const dbSession = await prisma.session.findUnique({
      where: { tokenHash: sessionToken },
      include: { user: true },
    });

    if (!dbSession || dbSession.expiresAt < new Date()) {
      return null;
    }

    targetUserId = dbSession.userId;
  }

  // Load user from database
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      memberships: {
        include: {
          group: true,
          userRoles: {
            include: {
              role: {
                include: {
                  permissions: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  // For this group (5130901/40102)
  const defaultMembership = user.memberships[0];
  const isOwner = defaultMembership?.isOwner ?? false;
  const groupId = defaultMembership?.groupId ?? "";

  const permissionsSet = new Set<string>();
  if (defaultMembership) {
    for (const ur of defaultMembership.userRoles) {
      for (const p of ur.role.permissions) {
        permissionsSet.add(p.permission);
      }
    }
  }

  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isSystemAdmin: user.isSystemAdmin,
    isOwner,
    groupId,
    permissions: Array.from(permissionsSet),
  };
}

export async function setDevUserCookie(userId: string) {
  const isDevAuth =
    process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_AUTH === "true";
  if (!isDevAuth) {
    throw new Error("Dev user switching is strictly forbidden in production!");
  }
  const cookieStore = await cookies();
  cookieStore.set(DEV_COOKIE_NAME, userId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}
