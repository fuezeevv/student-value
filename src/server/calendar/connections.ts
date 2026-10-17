import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/permissions/checker";
import { sealCalendarValue, openCalendarValue } from "./crypto";
import {
  googleCalendarTransport,
  type CalendarTransport,
} from "./google-transport";
import { calendarMarker } from "./sync";
export async function attachPersonalCalendar(
  userId: string,
  googleSubject: string,
  refreshToken: string | null,
  key = process.env.CALENDAR_TOKEN_KEY ?? "",
) {
  if (
    !(await prisma.authIdentity.count({
      where: { userId, provider: "GOOGLE", providerUserId: googleSubject },
    }))
  )
    throw new ForbiddenError(
      "Подключите тот Google аккаунт, которым входите в Student Value",
    );
  return prisma.$transaction(
    async (tx) => {
      const previous = await tx.personalCalendarConnection.findUnique({
        where: { userId },
      });
      if (previous?.leaseUntil && previous.leaseUntil > new Date())
        throw new ForbiddenError(
          "Сейчас выполняется обновление. Подключите календарь ещё раз через минуту",
        );
      if (previous && previous.googleSubject !== googleSubject)
        throw new ForbiddenError("Google аккаунт подключения изменился");
      const encrypted = refreshToken
        ? sealCalendarValue(
            z.string().min(1).max(20000).parse(refreshToken),
            key,
            userId,
          )
        : previous?.refreshTokenEncrypted;
      if (!encrypted)
        throw new ForbiddenError(
          "Google не предоставил постоянный доступ. Повторите подключение с разрешением доступа",
        );
      // Validate retained ciphertext before accepting a reconnect after a secret rotation.
      openCalendarValue(encrypted, key, userId);
      await tx.personalCalendarConnection.upsert({
        where: { userId },
        create: { userId, googleSubject, refreshTokenEncrypted: encrypted },
        update: {
          refreshTokenEncrypted: encrypted,
          state: "ACTIVE",
          lastErrorCode: null,
          attempts: 0,
          requestedVersion: { increment: 1 },
          retryAt: new Date(),
          ...(previous?.provisioning === "CREATING"
            ? { provisioning: "UNCERTAIN" }
            : {}),
        },
      });
      await tx.personalCalendarEvent.updateMany({
        where: { userId },
        data: { desiredHash: null },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "CONNECT_PERSONAL_CALENDAR",
          entityType: "USER",
          entityId: userId,
          details: {
            scope: "calendar.app.created",
            method: "EXPLICIT_GOOGLE_CONSENT",
            primaryCalendarAccess: false,
          },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}
export async function saveCalendarReminders(userId: string, values: unknown) {
  const reminders = z
    .array(z.number().int().min(0).max(40320))
    .max(5)
    .parse(values);
  const result = await prisma.personalCalendarConnection.updateMany({
    where: { userId, state: "ACTIVE" },
    data: {
      reminderMinutes: [...new Set(reminders)].sort((a, b) => b - a),
      requestedVersion: { increment: 1 },
      retryAt: new Date(),
    },
  });
  if (!result.count)
    throw new ForbiddenError("Сначала подключите Google Calendar");
}
export async function disconnectPersonalCalendar(
  userId: string,
  {
    transport = googleCalendarTransport,
    key = process.env.CALENDAR_TOKEN_KEY ?? "",
  }: { transport?: CalendarTransport; key?: string } = {},
) {
  const leaseToken = "disconnect-" + randomUUID();
  const locked = await prisma.personalCalendarConnection.updateMany({
    where: {
      userId,
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    data: { leaseToken, leaseUntil: new Date(Date.now() + 120000) },
  });
  if (!locked.count)
    throw new ForbiddenError(
      "Обновление уже выполняется. Повторите отключение через минуту",
    );
  let remindersMuted = true,
    revoked = true;
  try {
    const connection =
      await prisma.personalCalendarConnection.findUniqueOrThrow({
        where: { userId },
      });
    if (connection.refreshTokenEncrypted) {
      const start = Date.now();
      let refresh: string | null = null;
      try {
        refresh = openCalendarValue(
          connection.refreshTokenEncrypted,
          key,
          userId,
        );
      } catch {
        remindersMuted = false;
        revoked = false;
      }
      if (refresh)
        try {
          const token = await transport.refresh(refresh);
          const events = await prisma.personalCalendarEvent.findMany({
            where: { userId, removed: false },
          });
          // Bounded request. If cleanup cannot finish, remove credentials anyway and explain the remaining Google-side action.
          for (const event of events) {
            if (Date.now() - start > 9000) {
              remindersMuted = false;
              break;
            }
            await transport.muteEvent(token, event.calendarId, event.eventId);
          }
        } catch {
          remindersMuted = false;
        }
      if (refresh)
        try {
          await transport.revoke(refresh);
        } catch {
          revoked = false;
        }
    }
    await prisma.$transaction(async (tx) => {
      await tx.personalCalendarConnection.updateMany({
        where: { userId, leaseToken },
        data: {
          state: "DISCONNECTED",
          refreshTokenEncrypted: null,
          leaseToken: null,
          leaseUntil: null,
          lastErrorCode:
            remindersMuted && revoked ? null : "DISCONNECTED_CHECK_GOOGLE",
        },
      });
      await tx.personalCalendarEvent.updateMany({
        where: { userId },
        data: { desiredHash: null },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "DISCONNECT_PERSONAL_CALENDAR",
          entityType: "USER",
          entityId: userId,
          details: {
            localCredentialsRemoved: true,
            remindersMuted,
            providerRevocationConfirmed: revoked,
          },
        },
      });
    });
    return { remindersMuted, revoked };
  } finally {
    await prisma.personalCalendarConnection.updateMany({
      where: { userId, leaseToken },
      data: { leaseToken: null, leaseUntil: null },
    });
  }
}
export async function recoverPersonalCalendar(
  userId: string,
  calendarId: string,
  {
    transport = googleCalendarTransport,
    key = process.env.CALENDAR_TOKEN_KEY ?? "",
  }: { transport?: CalendarTransport; key?: string } = {},
) {
  const id = z
    .string()
    .trim()
    .min(8)
    .max(1000)
    .refine((s) => s !== "primary" && !s.includes("/"))
    .parse(calendarId);
  const connection = await prisma.personalCalendarConnection.findUniqueOrThrow({
    where: { userId },
  });
  if (
    connection.provisioning !== "UNCERTAIN" ||
    !connection.refreshTokenEncrypted ||
    connection.calendarId ||
    (connection.leaseUntil && connection.leaseUntil > new Date())
  )
    throw new ForbiddenError("Восстановление сейчас недоступно");
  const token = await transport.refresh(
    openCalendarValue(connection.refreshTokenEncrypted, key, userId),
  );
  if (!(await transport.checkCalendar(token, id, calendarMarker(userId, key))))
    throw new ForbiddenError(
      "Это другой календарь. Нужен календарь, созданный Student Value для вашего аккаунта",
    );
  const recovered = await prisma.personalCalendarConnection.updateMany({
    where: {
      userId,
      calendarId: null,
      provisioning: "UNCERTAIN",
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    data: {
      calendarId: id,
      provisioning: "READY",
      requestedVersion: { increment: 1 },
      retryAt: new Date(),
      lastErrorCode: null,
    },
  });
  if (!recovered.count) throw new ForbiddenError("Подключение уже изменилось");
}

/** Explicit recovery choice after a human checked Google; never an automatic retry of an ambiguous POST. */
export async function retryCalendarCreationAfterReview(
  userId: string,
  checked: boolean,
) {
  if (checked !== true)
    throw new ForbiddenError(
      "Сначала проверьте в Google, что календарь не был создан",
    );
  const result = await prisma.personalCalendarConnection.updateMany({
    where: {
      userId,
      state: "ACTIVE",
      calendarId: null,
      provisioning: "UNCERTAIN",
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    data: {
      provisioning: "PENDING",
      lastErrorCode: null,
      requestedVersion: { increment: 1 },
      retryAt: new Date(),
    },
  });
  if (!result.count) throw new ForbiddenError("Подключение уже изменилось");
  await prisma.auditLog.create({
    data: {
      userId,
      action: "RETRY_CALENDAR_AFTER_HUMAN_CHECK",
      entityType: "USER",
      entityId: userId,
      details: { humanReportedNoCalendar: true },
    },
  });
}
export async function replaceDeletedPersonalCalendar(
  userId: string,
  {
    transport = googleCalendarTransport,
    key = process.env.CALENDAR_TOKEN_KEY ?? "",
  }: { transport?: CalendarTransport; key?: string } = {},
) {
  const leaseToken = "replace-" + randomUUID();
  const lock = await prisma.personalCalendarConnection.updateMany({
    where: {
      userId,
      state: "ACTIVE",
      lastErrorCode: { in: ["NOT_FOUND", "GONE"] },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    data: { leaseToken, leaseUntil: new Date(Date.now() + 120000) },
  });
  if (!lock.count)
    throw new ForbiddenError("Замена календаря сейчас недоступна");
  try {
    const connection =
      await prisma.personalCalendarConnection.findUniqueOrThrow({
        where: { userId },
      });
    if (!connection.calendarId || !connection.refreshTokenEncrypted)
      throw new ForbiddenError("Нет данных календаря");
    const token = await transport.refresh(
      openCalendarValue(connection.refreshTokenEncrypted, key, userId),
    );
    let missing = false;
    try {
      await transport.checkCalendar(
        token,
        connection.calendarId,
        calendarMarker(userId, key),
      );
    } catch (error) {
      const { CalendarProviderError } = await import("./google-transport");
      if (
        error instanceof CalendarProviderError &&
        ["NOT_FOUND", "GONE"].includes(error.code)
      )
        missing = true;
      else throw error;
    }
    if (!missing)
      throw new ForbiddenError(
        "Первоначальный календарь существует. Создание замены отменено",
      );
    await prisma.$transaction(async (tx) => {
      await tx.personalCalendarConnection.updateMany({
        where: { userId, leaseToken },
        data: {
          calendarId: null,
          provisioning: "PENDING",
          lastErrorCode: null,
          requestedVersion: { increment: 1 },
          retryAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "REPLACE_DELETED_PERSONAL_CALENDAR",
          entityType: "USER",
          entityId: userId,
          details: { googleConfirmedMissing: true },
        },
      });
    });
  } finally {
    await prisma.personalCalendarConnection.updateMany({
      where: { userId, leaseToken },
      data: { leaseToken: null, leaseUntil: null },
    });
  }
}
