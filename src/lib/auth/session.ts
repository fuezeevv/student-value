import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { isDevAuthEnabled } from "./dev-policy";
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
  isPlatformOwner?: boolean;
  groupName?: string;
  groups?: { id: string; name: string; code: string }[];
}

export function activeGroupCookie() {
  return isDevAuthEnabled() ? "sv_group" : "__Host-sv-group";
}

const DEV_COOKIE_NAME = "study_dev_user_id";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();

  const isDevAuth = isDevAuthEnabled();

  let targetUserId: string;

  if (isDevAuth) {
    const devCookie = cookieStore.get(DEV_COOKIE_NAME)?.value;
    if (!devCookie || devCookie === "guest") {
      return null;
    }
    const identity = await prisma.authIdentity.findFirst({
      where: { userId: devCookie, provider: "LOCAL_DEV" },
    });
    if (!identity) return null;
    targetUserId = devCookie;
  } else {
    const sessionToken = cookieStore.get("__Host-session")?.value;
    if (!sessionToken || !/^[a-zA-Z0-9_-]{43}$/.test(sessionToken)) return null;

    const dbSession = await prisma.session.findUnique({
      where: {
        tokenHash: createHash("sha256").update(sessionToken).digest("hex"),
      },
      include: { user: true },
    });

    if (!dbSession || dbSession.expiresAt <= new Date()) {
      return null;
    }

    targetUserId = dbSession.userId;
  }

  // Load user from database
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      memberships: {
        ...(isDevAuth
          ? {}
          : {
              where: {
                group: {
                  enrollments: {
                    some: {
                      userId: targetUserId,
                      status: { in: ["CLAIMED" as const, "VERIFIED" as const] },
                    },
                  },
                },
              },
            }),
        orderBy: { joinedAt: "asc" },
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

  const selected = cookieStore.get(activeGroupCookie())?.value;
  const defaultMembership =
    user.memberships.find((m) => m.groupId === selected) ?? user.memberships[0];
  if (!isDevAuth && !defaultMembership) return null;
  const isOwner = defaultMembership?.isOwner ?? false;
  const groupId = defaultMembership?.groupId ?? "";

  const permissionsSet = new Set<string>();
  if (defaultMembership) {
    for (const ur of defaultMembership.userRoles) {
      if (ur.role.groupId !== defaultMembership.groupId) continue;
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
    isPlatformOwner: user.isPlatformOwner,
    groupName: defaultMembership?.group.name,
    groups: user.memberships.map((m) => ({
      id: m.groupId,
      name: m.group.name,
      code: m.group.code,
    })),
  };
}

export async function setDevUserCookie(userId: string) {
  const isDevAuth = isDevAuthEnabled();
  if (!isDevAuth) {
    throw new Error("Dev user switching is strictly forbidden in production!");
  }
  const identity = await prisma.authIdentity.findFirst({
    where: { userId, provider: "LOCAL_DEV" },
  });
  if (!identity) throw new Error("Тестовый пользователь не найден");
  const cookieStore = await cookies();
  cookieStore.set(DEV_COOKIE_NAME, userId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function requireCurrentUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !user.groupId) redirect("/login");
  return user;
}
