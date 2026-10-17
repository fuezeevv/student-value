import { createHash } from "node:crypto";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { taskVisibilityWhere } from "@/server/domain/access";
import { confirmedDeadlineWhere } from "@/server/domain/deadline-visibility";
import { effectiveDeadline } from "@/server/domain/deadline-date";
import { isTrustedAccepted } from "@/server/domain/trust";
import type { CalendarEventBody } from "./google-transport";
export const stableCalendarEventId = (userId: string, taskId: string) =>
  "sv" + createHash("sha256").update(`${userId}:${taskId}`).digest("hex");
export type DesiredCalendarEvent = {
  taskId: string;
  groupId: string;
  eventId: string;
  hash: string;
  body: CalendarEventBody;
};
const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export async function loadDesiredCalendarEvents(
  userId: string,
  reminderMinutes: number[],
  now = new Date(),
): Promise<DesiredCalendarEvent[]> {
  const memberships = await prisma.groupMember.findMany({
    where: {
      userId,
      group: {
        enrollments: {
          some: { userId, status: { in: ["CLAIMED", "VERIFIED"] } },
        },
      },
    },
    include: { group: { select: { name: true } } },
  });
  const result: DesiredCalendarEvent[] = [];
  for (const membership of memberships) {
    const user: SessionUser = {
      id: userId,
      groupId: membership.groupId,
      nickname: "",
      avatarUrl: null,
      bio: null,
      isSystemAdmin: false,
      isOwner: false,
      permissions: [],
    };
    const tasks = await prisma.task.findMany({
      where: {
        AND: [
          await taskVisibilityWhere(user),
          { courseOffering: { semester: { isCurrent: true } } },
        ],
      },
      select: {
        id: true,
        title: true,
        courseOffering: {
          select: {
            courseDefinition: { select: { title: true, shortTitle: true } },
          },
        },
        deadlines: {
          where: {
            ...confirmedDeadlineWhere,
            date: {
              gte: new Date(now.getTime() - 30 * 86400000),
              lte: new Date(now.getTime() + 365 * 86400000),
            },
          },
          orderBy: { date: "asc" },
          take: 1,
        },
        progress: {
          where: { userId },
          select: {
            status: true,
            isVerified: true,
            taskId: true,
            userId: true,
            verifiedById: true,
            verifiedAt: true,
            acceptedAt: true,
            verificationSource: true,
            verificationSourceReferenceId: true,
            verificationEvidence: {
              select: {
                confidence: true,
                entityType: true,
                entityId: true,
                quoteText: true,
                source: { select: { type: true } },
              },
            },
          },
        },
      },
      take: 501,
    });
    if (tasks.length > 500) throw Error("Calendar task limit exceeded");
    for (const task of tasks) {
      const deadline = task.deadlines[0];
      if (!deadline) continue;
      const progress = task.progress[0],
        accepted = isTrustedAccepted(progress);
      const done =
        accepted || ["READY", "SUBMITTED"].includes(progress?.status ?? "");
      const label = accepted
        ? "Зачтено"
        : progress?.status === "READY"
          ? "Готово к сдаче"
          : progress?.status === "SUBMITTED"
            ? "На проверке"
            : "Сдать";
      const day = formatInTimeZone(
        deadline.date,
        "Europe/Moscow",
        "yyyy-MM-dd",
      );
      const date = effectiveDeadline(deadline.date, deadline.isTimeStrict);
      const nextDay = formatInTimeZone(
        new Date(date.getTime() + 86400000),
        "Europe/Moscow",
        "yyyy-MM-dd",
      );
      const href = `https://studentvalue1984.eu.cc/tasks/${encodeURIComponent(task.id)}`;
      const body: CalendarEventBody = {
        summary: `${label} · ${task.courseOffering.courseDefinition.shortTitle} · ${task.title}`,
        description: `${escape(membership.group.name)} · ${escape(task.courseOffering.courseDefinition.title)}\n${deadline.isTimeStrict ? "Точное время срока — по Москве." : "Сдать до конца указанного дня по Москве; точное время не задано."}\n${done ? "Личные напоминания отключены. Отметка «готово/сдано» не подтверждает зачёт преподавателем." : "Личные напоминания включены только для невыполненной работы."}\nУчебные сведения и личный этап меняйте в Student Value: ${href}\nЛичные заметки сюда не передаются.`,
        start: deadline.isTimeStrict
          ? { dateTime: date.toISOString(), timeZone: "Europe/Moscow" }
          : { date: day },
        end: deadline.isTimeStrict
          ? {
              dateTime: new Date(date.getTime() + 60000).toISOString(),
              timeZone: "Europe/Moscow",
            }
          : { date: nextDay },
        reminders: {
          useDefault: false,
          overrides: done
            ? []
            : [...new Set(reminderMinutes)]
                .sort((a, b) => b - a)
                .map((minutes) => ({ method: "popup", minutes })),
        },
        status: "confirmed",
        transparency: "transparent",
        visibility: "private",
        source: { url: href, title: "Student Value 1.984" },
        extendedProperties: {
          private: {
            studentValueTask: task.id,
            studentValueGroup: membership.groupId,
          },
        },
      };
      const hash = createHash("sha256")
        .update(JSON.stringify(body))
        .digest("hex");
      result.push({
        taskId: task.id,
        groupId: membership.groupId,
        eventId: stableCalendarEventId(userId, task.id),
        hash,
        body,
      });
    }
  }
  return result;
}
