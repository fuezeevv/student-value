"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const unread = notifications.filter((n) => !n.isRead).length;
  const mark = (id?: string) =>
    startTransition(async () => {
      setError("");
      try {
        if (id) await markNotificationReadAction(id);
        else await markAllNotificationsReadAction();
      } catch {
        setError("Не удалось отметить уведомления. Попробуйте ещё раз.");
      }
    });
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-3 items-center mb-5">
        <p className="text-sm text-slate-400">
          Непрочитанных в списке: {unread}
        </p>
        {unread > 0 && (
          <button
            disabled={pending}
            onClick={() => mark()}
            className="text-link"
          >
            Отметить все прочитанными
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-rose-300 text-sm mb-4">
          {error}
        </p>
      )}
      {notifications.length ? (
        notifications.map((n) => (
          <article
            key={n.id}
            className={`announcement-entry ${n.isRead ? "opacity-70" : ""}`}
          >
            <div className="flex gap-3 items-center">
              <time dateTime={n.createdAt}>
                {new Date(n.createdAt).toLocaleString("ru-RU", {
                  timeZone: "Europe/Moscow",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              {!n.isRead && (
                <span className="text-xs text-blue-300">Новое</span>
              )}
            </div>
            <h3>{n.title}</h3>
            <p>{n.message}</p>
            <div className="flex gap-6 flex-wrap mt-3">
              {n.link && (
                <Link href={n.link} className="text-link">
                  Открыть
                  <ArrowUpRight size={15} />
                </Link>
              )}
              {!n.isRead && (
                <button
                  disabled={pending}
                  onClick={() => mark(n.id)}
                  className="text-link !text-slate-400"
                >
                  <Check size={15} />
                  Прочитано
                </button>
              )}
            </div>
          </article>
        ))
      ) : (
        <p className="quiet-empty">
          Пока ничего нового. Здесь появятся изменения сроков, новые работы и
          результаты проверки.
        </p>
      )}
    </div>
  );
}
