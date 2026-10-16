import React from "react";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { NotificationsClient, NotificationItem } from "./NotificationsClient";
import { Bell } from "lucide-react";

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
      <div className="pb-3 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <Bell className="w-6 h-6 text-cyan-400" />
          Центр уведомлений
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Оперативные оповещения о новых заданиях, изменениях дедлайнов и подтверждении сдачи
        </p>
      </div>

      <NotificationsClient notifications={notifications} />
    </div>
  );
}
