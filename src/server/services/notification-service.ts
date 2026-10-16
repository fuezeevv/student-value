import { prisma } from "@/lib/db/prisma";

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type:
    | "TASK_NEW"
    | "DEADLINE_CHANGE"
    | "DEADLINE_APPROACHING"
    | "ANNOUNCEMENT"
    | "REQUIREMENT_CHANGE"
    | "PROGRESS_VERIFIED"
    | "COURSE_UPDATE"
    | "ACHIEVEMENT";
  link?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  return await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link || null,
      isRead: false,
    },
  });
}

export async function broadcastGroupNotification(
  groupId: string,
  params: Omit<CreateNotificationParams, "userId">
) {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  const notifications = members.map((m) => ({
    userId: m.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    link: params.link || null,
    isRead: false,
  }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({
      data: notifications,
    });
  }
}

export async function markNotificationRead(notificationId: string, userId: string) {
  return await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
