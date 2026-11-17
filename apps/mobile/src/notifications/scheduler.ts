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
): string {
  return `deadline-${taskId}-${deadlineId}`;
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

export async function scheduleDeadlineReminder(params: {
  userId: string;
  taskId: string;
  deadlineId: string;
  taskTitle: string;
  subjectName: string;
  deadlineDateStr: string; // ISO or DD.MM.YYYY / YYYY-MM-DD
}): Promise<ScheduledNotificationRecord | null> {
  await setupNotificationChannels();
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.warn("Notification permissions not granted");
    return null;
  }

  const identifier = buildNotificationIdentifier(
    params.taskId,
    params.deadlineId,
  );

  // Cancel any existing notification with this identifier to prevent duplicates
  await Notifications.cancelScheduledNotificationAsync(identifier);

  const deadlineUtc = parseMoscowDeadline(params.deadlineDateStr);
  if (!deadlineUtc) return null;
  const triggerDate = calculateReminderTriggerTime(deadlineUtc);
  if (!triggerDate) return null;

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
  return record;
}

export async function cancelDeadlineReminder(
  userId: string,
  taskId: string,
  deadlineId: string,
): Promise<void> {
  const identifier = buildNotificationIdentifier(taskId, deadlineId);
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (err) {
    console.warn("Could not cancel native notification:", err);
  }
  const repo = getTimetableRepository();
  await repo.deleteScheduledNotification(identifier);
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
