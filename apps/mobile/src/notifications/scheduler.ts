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

export function buildNotificationIdentifier(taskId: string, deadlineId: string): string {
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

export async function scheduleDeadlineReminder(params: {
  userId: string;
  taskId: string;
  deadlineId: string;
  taskTitle: string;
  subjectName: string;
  deadlineDateStr: string; // e.g. "14.09.2026" or ISO
  secondsFromNow?: number; // Optional override for instant test verification
}): Promise<ScheduledNotificationRecord | null> {
  await setupNotificationChannels();
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.warn("Notification permissions not granted");
    return null;
  }

  const identifier = buildNotificationIdentifier(params.taskId, params.deadlineId);

  // Cancel any existing notification with this identifier to prevent duplicates
  await Notifications.cancelScheduledNotificationAsync(identifier);

  let triggerDate: Date;
  if (params.secondsFromNow !== undefined) {
    triggerDate = new Date(Date.now() + params.secondsFromNow * 1000);
  } else {
    // Normal schedule: 1 day before deadline at 10:00 Moscow time
    // Parse DD.MM.YYYY
    const parts = params.deadlineDateStr.split(".");
    let target = new Date();
    if (parts.length === 3) {
      target = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 10, 0, 0);
      target.setDate(target.getDate() - 1); // 1 day before
    }
    // If target is in the past, schedule for 10 seconds from now for safety
    if (target.getTime() <= Date.now()) {
      triggerDate = new Date(Date.now() + 10 * 1000);
    } else {
      triggerDate = target;
    }
  }

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
    console.warn("Failed to cancel scheduled notification:", err);
  }

  const repo = getTimetableRepository();
  await repo.updateNotificationStatus(identifier, "CANCELLED");
}

export async function cancelAllRemindersForTask(
  userId: string,
  taskId: string,
): Promise<void> {
  const repo = getTimetableRepository();
  const existing = await repo.getScheduledNotificationsForTask(userId, taskId);
  for (const notif of existing) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notif.id);
    } catch (err) {
      console.warn("Failed to cancel scheduled notification:", err);
    }
    await repo.updateNotificationStatus(notif.id, "CANCELLED");
  }
}

export async function getActiveScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}
