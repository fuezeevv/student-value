"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/server/services/notification-service";

export async function markNotificationReadAction(notificationId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  await markNotificationRead(notificationId, user.id, user.groupId);
  revalidatePath("/notifications");
  revalidatePath("/");
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  await markAllNotificationsRead(user.id, user.groupId);
  revalidatePath("/notifications");
  revalidatePath("/");
  return { success: true };
}

export async function toggleLeaderboardOptInAction(optIn: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  await prisma.userGamificationProfile.upsert({
    where: { userId: user.id },
    update: { isLeaderboardOptIn: optIn },
    create: {
      userId: user.id,
      isLeaderboardOptIn: optIn,
    },
  });

  revalidatePath("/leaderboard");
  revalidatePath("/settings");
  return { success: true };
}

export async function updateProfileSettingsAction(
  nickname: string,
  bio?: string,
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  if (!nickname || nickname.trim().length < 2) {
    throw new Error("Никнейм должен содержать не менее 2 символов");
  }

  // Check unique nickname
  const existing = await prisma.user.findFirst({
    where: {
      nickname: nickname.trim(),
      NOT: { id: user.id },
    },
  });

  if (existing) {
    throw new Error("Этот никнейм уже занят");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      nickname: nickname.trim(),
      bio: bio?.trim() || null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}

export async function logoutUserAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get("__Host-session")?.value;
  if (token)
    await prisma.session.deleteMany({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    });
  cookieStore.delete("study_dev_user_id");
  cookieStore.set("__Host-sv-group", "", {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
  cookieStore.set("__Host-session", "", {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
  revalidatePath("/");
  redirect("/login");
}
