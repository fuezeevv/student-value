import { randomUUID, createHmac } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { openCalendarValue } from "./crypto";
import {
  googleCalendarTransport,
  CalendarProviderError,
  type CalendarTransport,
} from "./google-transport";
import { loadDesiredCalendarEvents } from "./desired-events";
export function calendarMarker(userId: string, key: string) {
  return (
    "sv1984:" +
    createHmac("sha256", Buffer.from(key, "base64"))
      .update(userId)
      .digest("hex")
  );
}
export interface CalendarSyncDependencies {
  transport?: CalendarTransport;
  tokenKey?: string;
  now?: () => Date;
  budgetMs?: number;
}
export async function syncPersonalCalendar(
  userId: string,
  deps: CalendarSyncDependencies = {},
) {
  const transport = deps.transport ?? googleCalendarTransport,
    key = deps.tokenKey ?? process.env.CALENDAR_TOKEN_KEY ?? "";
  const now = deps.now ?? (() => new Date());
  const start = Date.now(),
    budget = deps.budgetMs ?? 18000,
    leaseToken = randomUUID();
  const lock = await prisma.personalCalendarConnection.updateMany({
    where: {
      userId,
      state: "ACTIVE",
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now() } }],
    },
    data: { leaseToken, leaseUntil: new Date(now().getTime() + 120000) },
  });
  if (!lock.count) return { state: "BUSY_OR_DISCONNECTED" };
  const own = { userId, leaseToken };
  let connection = await prisma.personalCalendarConnection.findUniqueOrThrow({
    where: { userId },
  });
  let touched = 0;
  try {
    if (!connection.refreshTokenEncrypted)
      throw new CalendarProviderError("REAUTH_REQUIRED");
    if (
      !(await prisma.authIdentity.count({
        where: {
          userId,
          provider: "GOOGLE",
          providerUserId: connection.googleSubject,
        },
      }))
    )
      throw new CalendarProviderError("REAUTH_REQUIRED");
    const token = await transport.refresh(
      openCalendarValue(connection.refreshTokenEncrypted, key, userId),
    );
    if (!connection.calendarId) {
      if (connection.provisioning !== "PENDING")
        throw new CalendarProviderError("CREATE_UNCERTAIN");
      await prisma.personalCalendarConnection.updateMany({
        where: own,
        data: { provisioning: "CREATING" },
      });
      let calendarId: string;
      try {
        calendarId = await transport.createCalendar(
          token,
          calendarMarker(userId, key),
        );
      } catch (error) {
        if (
          error instanceof CalendarProviderError &&
          ["API_DISABLED", "PERMISSION", "REAUTH_REQUIRED"].includes(error.code)
        )
          await prisma.personalCalendarConnection.updateMany({
            where: own,
            data: { provisioning: "PENDING" },
          });
        else {
          await prisma.personalCalendarConnection.updateMany({
            where: own,
            data: { provisioning: "UNCERTAIN" },
          });
          throw new CalendarProviderError("CREATE_UNCERTAIN");
        }
        throw error;
      }
      await prisma.personalCalendarConnection.updateMany({
        where: own,
        data: { calendarId, provisioning: "READY" },
      });
      connection = { ...connection, calendarId, provisioning: "READY" };
    }
    if (
      !(await transport.checkCalendar(
        token,
        connection.calendarId!,
        calendarMarker(userId, key),
      ))
    )
      throw new CalendarProviderError("CALENDAR_CHANGED");
    const desired = await loadDesiredCalendarEvents(
      userId,
      connection.reminderMinutes,
      now(),
    );
    const existing = await prisma.personalCalendarEvent.findMany({
        where: { userId },
      }),
      desiredIds = new Set(desired.map((e) => e.taskId));
    const pending = desired.filter((e) => {
      const old = existing.find((x) => x.taskId === e.taskId);
      return (
        !old ||
        old.removed ||
        old.calendarId !== connection.calendarId ||
        old.desiredHash !== e.hash ||
        !old.lastSyncedAt ||
        old.lastSyncedAt.getTime() < now().getTime() - 20 * 3600000
      );
    });
    const removed = existing.filter(
      (e) => !e.removed && !desiredIds.has(e.taskId),
    );
    let complete = true;
    for (const entry of pending) {
      if (Date.now() - start > budget) {
        complete = false;
        break;
      }
      await transport.putEvent(
        token,
        connection.calendarId!,
        entry.eventId,
        entry.body,
      );
      await prisma.personalCalendarEvent.upsert({
        where: { userId_taskId: { userId, taskId: entry.taskId } },
        update: {
          calendarId: connection.calendarId!,
          eventId: entry.eventId,
          groupId: entry.groupId,
          desiredHash: entry.hash,
          removed: false,
          lastSyncedAt: now(),
        },
        create: {
          userId,
          taskId: entry.taskId,
          groupId: entry.groupId,
          calendarId: connection.calendarId!,
          eventId: entry.eventId,
          desiredHash: entry.hash,
          lastSyncedAt: now(),
        },
      });
      touched++;
    }
    if (complete)
      for (const old of removed) {
        if (Date.now() - start > budget) {
          complete = false;
          break;
        }
        await transport.removeEvent(token, old.calendarId, old.eventId);
        await prisma.personalCalendarEvent.update({
          where: { id: old.id },
          data: { removed: true, desiredHash: null, lastSyncedAt: now() },
        });
        touched++;
      }
    if (complete) {
      const finished = await prisma.personalCalendarConnection.updateMany({
        where: { ...own, requestedVersion: connection.requestedVersion },
        data: {
          syncedVersion: connection.requestedVersion,
          lastSyncedAt: now(),
          lastErrorCode: null,
          attempts: 0,
          retryAt: new Date(now().getTime() + 20 * 3600000),
        },
      });
      if (!finished.count)
        await prisma.personalCalendarConnection.updateMany({
          where: own,
          data: {
            syncedVersion: connection.requestedVersion,
            lastSyncedAt: now(),
            lastErrorCode: null,
            attempts: 0,
            retryAt: now(),
          },
        });
    } else
      await prisma.personalCalendarConnection.updateMany({
        where: own,
        data: { retryAt: now(), lastErrorCode: null },
      });
    return { state: complete ? "SYNCED" : "PENDING", touched };
  } catch (error) {
    const code =
      error instanceof CalendarProviderError ? error.code : "INTERNAL";
    await prisma.personalCalendarConnection.updateMany({
      where: own,
      data: {
        lastErrorCode: code,
        attempts: { increment: 1 },
        retryAt:
          code === "CREATE_UNCERTAIN"
            ? new Date("2099-01-01T00:00:00Z")
            : new Date(
                now().getTime() +
                  Math.min(
                    6 * 3600000,
                    60000 * 2 ** Math.min(connection.attempts, 8),
                  ),
              ),
        ...(code === "REAUTH_REQUIRED"
          ? { state: "REAUTH_REQUIRED", refreshTokenEncrypted: null }
          : {}),
        ...(code === "CREATE_UNCERTAIN" ? { provisioning: "UNCERTAIN" } : {}),
      },
    });
    return { state: "FAILED", code, touched };
  } finally {
    await prisma.personalCalendarConnection.updateMany({
      where: own,
      data: { leaseToken: null, leaseUntil: null },
    });
  }
}
export async function drainCalendarQueue({
  budgetMs = 18000,
  maxUsers = 12,
}: { budgetMs?: number; maxUsers?: number } = {}) {
  const start = Date.now();
  const due = await prisma.personalCalendarConnection.findMany({
    where: {
      state: "ACTIVE",
      retryAt: { lte: new Date() },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    select: { userId: true },
    orderBy: { retryAt: "asc" },
    take: maxUsers,
  });
  let cursor = 0,
    attempted = 0;
  await Promise.all(
    [0, 1].map(async () => {
      while (cursor < due.length && Date.now() - start < budgetMs) {
        const next = due[cursor++];
        await syncPersonalCalendar(next.userId, {
          budgetMs: Math.max(
            1000,
            Math.min(12000, budgetMs - (Date.now() - start)),
          ),
        });
        attempted++;
      }
    }),
  );
  return attempted;
}
