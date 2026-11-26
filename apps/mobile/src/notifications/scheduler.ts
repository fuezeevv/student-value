import { sessionGeneration, isCurrentSession } from "../auth/session-lifecycle";
import type { CachedTask } from "@studentvalue/mobile-contracts";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { ScheduledNotificationRecord } from "@studentvalue/mobile-contracts";
import { getTimetableRepository } from "../storage/repository";

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let channelConfigured = false;
export async function setupNotificationChannels(): Promise<void> {
  if (channelConfigured || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("deadlines_channel", {
    name: "Дедлайны и задания",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3b82f6",
  });
  channelConfigured = true;
}

export function buildNotificationIdentifier(
  taskId: string,
  deadlineId: string,
  userId?: string,
): string {
  return userId
    ? `deadline:${encodeURIComponent(userId)}:${encodeURIComponent(taskId)}:${encodeURIComponent(deadlineId)}`
    : `deadline-${taskId}-${deadlineId}`;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === "granted";
}

/**
 * Parses a deadline string into a UTC Date object representing Europe/Moscow time.
 * Date-only deadlines end at 23:59:59.999 Moscow time (20:59:59.999 UTC).
 */
export function parseMoscowDeadline(deadlineStr: string): Date | null {
  if (!deadlineStr) return null;

  // ISO string (e.g. 2026-11-20T20:59:59.999Z or with timezone offset)
  if (deadlineStr.includes("T")) {
    const d = new Date(deadlineStr);
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD
  const isoMatch = deadlineStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    // 23:59:59.999 MSK = 20:59:59.999 UTC
    return new Date(
      Date.UTC(Number(y), Number(m) - 1, Number(d), 20, 59, 59, 999),
    );
  }

  // DD.MM.YYYY
  const ruMatch = deadlineStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ruMatch) {
    const [, d, m, y] = ruMatch;
    return new Date(
      Date.UTC(Number(y), Number(m) - 1, Number(d), 20, 59, 59, 999),
    );
  }

  return null;
}

/**
 * Computes trigger time in UTC based on Moscow deadline:
 * 1. Default: the previous day at 10:00 Moscow time (07:00 UTC).
 * 2. If 10:00 MSK 1-day prior has passed, but deadline is still in the future:
 *    trigger 2 hours before the deadline.
 * 3. If deadline is already past, returns null (never schedules reminders for past deadlines).
 */
export { deadlineReminderTime as calculateReminderTriggerTime } from "@studentvalue/mobile-contracts";
import { deadlineReminderTime as calculateReminderTriggerTime } from "@studentvalue/mobile-contracts";

const reminderVersions = new Map<string, number>();

export async function scheduleDeadlineReminder(params: {
  userId: string;
  taskId: string;
  deadlineId: string;
  taskTitle: string;
  subjectName: string;
  deadlineDateStr: string; // ISO or DD.MM.YYYY / YYYY-MM-DD
  requestPermission?: boolean;
}): Promise<ScheduledNotificationRecord | null> {
  const generation = sessionGeneration();
  const versionKey = JSON.stringify([params.userId, params.taskId]);
  const version = (reminderVersions.get(versionKey) ?? 0) + 1;
  reminderVersions.set(versionKey, version);
  const valid = () =>
    isCurrentSession(generation) &&
    reminderVersions.get(versionKey) === version;
  const deadlineUtc = parseMoscowDeadline(params.deadlineDateStr);
  if (!deadlineUtc) return null;
  const triggerDate = calculateReminderTriggerTime(deadlineUtc);
  if (!triggerDate) return null;
  await setupNotificationChannels();
  const hasPermission =
    params.requestPermission === false
      ? (await Notifications.getPermissionsAsync()).status === "granted"
      : await requestNotificationPermissions();
  if (!valid()) return null;
  if (!hasPermission) {
    console.warn("Notification permissions not granted");
    return null;
  }

  const identifier =
    buildNotificationIdentifier(
      params.taskId,
      params.deadlineId,
      params.userId,
    ) + `:session:${generation}:request:${version}`;

  // Cancel any existing notification with this identifier to prevent duplicates
  await Notifications.cancelScheduledNotificationAsync(identifier);

  if (!valid()) return null;
  const title = `Дедлайн: ${params.subjectName}`;
  const body = `Срок сдачи «${params.taskTitle}» наступает скоро!`;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      data: {
        taskId: params.taskId,
        deadlineId: params.deadlineId,
      },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: "deadlines_channel",
    },
  });

  if (!valid()) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    return null;
  }
  const record: ScheduledNotificationRecord = {
    id: identifier,
    userId: params.userId,
    taskId: params.taskId,
    deadlineId: params.deadlineId,
    notificationType: "DEADLINE_REMINDER",
    triggerTime: triggerDate.toISOString(),
    title,
    body,
    status: "SCHEDULED",
    createdAt: new Date().toISOString(),
  };

  const repo = getTimetableRepository();
  await repo.saveScheduledNotification(record);
  if (!valid()) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    await repo.deleteScheduledNotification(identifier);
    return null;
  }
  return record;
}

export async function cancelDeadlineReminder(
  userId: string,
  taskId: string,
  deadlineId: string,
): Promise<void> {
  const versionKey = JSON.stringify([userId, taskId]);
  reminderVersions.set(versionKey, (reminderVersions.get(versionKey) ?? 0) + 1);
  const repo = getTimetableRepository();
  const records = await repo.getScheduledNotificationsForTask(userId, taskId);
  const identifiers = new Set([
    buildNotificationIdentifier(taskId, deadlineId, userId),
    buildNotificationIdentifier(taskId, deadlineId),
    ...records
      .filter((record) => record.deadlineId === deadlineId)
      .map((record) => record.id),
  ]);
  for (const identifier of identifiers) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    await repo.deleteScheduledNotification(identifier);
  }
}

/**
 * Handles deadline reschedule: cancels old notification and registers new one.
 */
export async function rescheduleDeadlineReminder(params: {
  userId: string;
  taskId: string;
  oldDeadlineId: string;
  newDeadlineId: string;
  taskTitle: string;
  subjectName: string;
  newDeadlineDateStr: string;
}): Promise<ScheduledNotificationRecord | null> {
  await cancelDeadlineReminder(
    params.userId,
    params.taskId,
    params.oldDeadlineId,
  );
  return scheduleDeadlineReminder({
    userId: params.userId,
    taskId: params.taskId,
    deadlineId: params.newDeadlineId,
    taskTitle: params.taskTitle,
    subjectName: params.subjectName,
    deadlineDateStr: params.newDeadlineDateStr,
  });
}

export async function activeReminderFlags(
  userId: string,
  tasks: CachedTask[],
): Promise<Record<string, boolean>> {
  if ((await Notifications.getPermissionsAsync()).status !== "granted")
    return {};
  const nativeIds = new Set(
    (await Notifications.getAllScheduledNotificationsAsync()).map(
      (item) => item.identifier,
    ),
  );
  const flags: Record<string, boolean> = {};
  const repo = getTimetableRepository();
  for (const task of tasks) {
    const records = await repo.getScheduledNotificationsForTask(
      userId,
      task.id,
    );
    flags[task.id] = records.some(
      (record) =>
        record.deadlineId === task.deadlineId &&
        record.status === "SCHEDULED" &&
        Date.parse(record.triggerTime) > Date.now() &&
        nativeIds.has(record.id),
    );
  }
  return flags;
}

/** Reconcile only the selected group's previously cached/now-authorized tasks.
 * Other groups' alarms remain untouched. Existing opt-ins follow changed IDs. */
export async function reconcileTaskReminders(
  userId: string,
  previous: CachedTask[],
  current: CachedTask[],
  completed: Set<string>,
): Promise<void> {
  const generation = sessionGeneration();
  const repo = getTimetableRepository();
  const targets = new Map(current.map((task) => [task.id, task]));
  for (const taskId of new Set(
    [...previous, ...current].map((task) => task.id),
  )) {
    if (!isCurrentSession(generation)) return;
    const records = await repo.getScheduledNotificationsForTask(userId, taskId);
    const target = targets.get(taskId);
    if (!target || completed.has(taskId)) {
      const versionKey = JSON.stringify([userId, taskId]);
      reminderVersions.set(
        versionKey,
        (reminderVersions.get(versionKey) ?? 0) + 1,
      );
    }
    if (!records.length) continue;
    const expired = records.filter(
      (record) =>
        !target?.deadlineId ||
        !target.deadlineDate ||
        completed.has(taskId) ||
        record.deadlineId !== target.deadlineId,
    );
    if (!expired.length) continue;
    for (const record of expired) {
      if (!isCurrentSession(generation)) return;
      await Notifications.cancelScheduledNotificationAsync(record.id);
      await repo.deleteScheduledNotification(record.id);
    }
    if (
      target?.deadlineId &&
      target.deadlineDate &&
      !completed.has(taskId) &&
      !records.some((record) => record.deadlineId === target.deadlineId)
    ) {
      if (!isCurrentSession(generation)) return;
      await scheduleDeadlineReminder({
        userId,
        taskId: target.id,
        deadlineId: target.deadlineId,
        taskTitle: target.title,
        subjectName: target.subject,
        deadlineDateStr: target.deadlineDate,
        requestPermission: false,
      });
    }
  }
}
