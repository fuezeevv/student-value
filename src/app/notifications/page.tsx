import React from "react";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { NotificationsClient, NotificationItem } from "./NotificationsClient";

export default async function NotificationsPage() {
  const user = await requireCurrentUser();

  const dbNotifs = user
    ? await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      })
    : [];

  const notifications: NotificationItem[] = dbNotifs.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    link: n.link,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Что изменилось</p>
          <h1 className="page-title">Уведомления</h1>
          <p className="page-intro">
            Новые работы, переносы сроков и результаты проверки.
          </p>
        </div>
      </div>

      <NotificationsClient notifications={notifications} />
    </div>
  );
}
