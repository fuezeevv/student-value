import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { calendarEnabled } from "@/server/calendar/crypto";

/** Observation only: rendering this notice never retries, reconnects or mutates Google. */
export async function CalendarNotice({ userId }: { userId: string }) {
  if (!calendarEnabled()) return null;
  const connection = await prisma.personalCalendarConnection.findUnique({
    where: { userId },
    select: {
      state: true,
      provisioning: true,
      lastErrorCode: true,
      lastSyncedAt: true,
      createdAt: true,
      requestedVersion: true,
      syncedVersion: true,
    },
  });
  if (!connection || connection.state === "DISCONNECTED") return null;
  const reauth = connection.state === "REAUTH_REQUIRED";
  const failed =
    !!connection.lastErrorCode || connection.provisioning === "UNCERTAIN";
  const stale = connection.lastSyncedAt
    ? Date.now() - connection.lastSyncedAt.getTime() > 48 * 3600000
    : Date.now() - connection.createdAt.getTime() > 3600000;
  if (!reauth && !failed && !stale) return null;
  return (
    <aside
      aria-label="Состояние Google Calendar"
      className="mb-7 rounded-xl border border-rose-400/30 bg-rose-400/5 p-4 sm:p-5"
    >
      <p className="font-semibold text-slate-100">
        {reauth
          ? "Новые сроки не попадают в ваш Google Calendar"
          : "Проверьте обновление Google Calendar"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        {reauth
          ? "Google больше не разрешает обновлять календарь. Повторно подключите тот же аккаунт — существующий календарь сохранится."
          : "Последнее обновление требует внимания. Актуальные сроки доступны здесь, на сайте."}
      </p>
      <Link
        href="/calendar"
        className="text-link inline-flex min-h-11 items-center mt-1"
      >
        {reauth ? "Восстановить подключение →" : "Посмотреть состояние →"}
      </Link>
    </aside>
  );
}
