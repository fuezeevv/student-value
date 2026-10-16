"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Clock,
  Sparkles,
  Megaphone,
  BookOpen,
  ArrowRight,
  CheckCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/server/actions/user-actions";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsClient({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const [isPending, startTransition] = useTransition();

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "PROGRESS_VERIFIED":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "ACHIEVEMENT":
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case "ANNOUNCEMENT":
        return <Megaphone className="w-4 h-4 text-amber-400" />;
      case "TASK_NEW":
        return <Clock className="w-4 h-4 text-blue-400" />;
      default:
        return <BookOpen className="w-4 h-4 text-slate-400" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Непрочитанных: <strong className="text-cyan-400">{unreadCount}</strong>
        </span>

        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="text-xs gap-1.5 h-8"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Отметить все как прочитанные</span>
          </Button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-2.5">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                notif.isRead
                  ? "bg-slate-900/40 border-slate-800 text-slate-400"
                  : "bg-slate-900/80 border-cyan-500/30 text-slate-200 shadow-xs"
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">{getTypeIcon(notif.type)}</div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">
                      {notif.title}
                    </span>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {notif.message}
                  </p>
                  <div className="text-[11px] text-slate-500 font-mono pt-1">
                    {new Date(notif.createdAt).toLocaleString("ru-RU")}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {notif.link && (
                  <Link href={notif.link}>
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2 gap-1">
                      <span>Перейти</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                )}
                {!notif.isRead && (
                  <button
                    onClick={() => handleMarkRead(notif.id)}
                    disabled={isPending}
                    className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                    title="Отметить прочитанным"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-slate-400 border border-slate-800/80 rounded-xl bg-slate-900/30">
          Уведомлений пока нет.
        </div>
      )}
    </div>
  );
}
