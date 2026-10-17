import { prisma } from "@/lib/db/prisma";

/** Legacy group-wide calendar only. Personal consent/sync lives in server/calendar. */
export interface CalendarIntegrationStatus {
  isConfigured: boolean;
  groupCalendarId: string | null;
  lastSyncedAt: Date | null;
  totalSyncedEvents: number;
  syncErrorsCount: number;
  missingCredentials: string[];
}

export async function getCalendarIntegrationStatus(
  groupId: string,
): Promise<CalendarIntegrationStatus> {
  const group = await prisma.studyGroup.findUnique({
    where: { id: groupId },
    select: { calendarId: true },
  });

  const totalSyncedEvents = await prisma.externalCalendarEvent.count({
    where: {
      syncStatus: "SYNCED",
      deadline: { courseOffering: { groups: { some: { groupId } } } },
    },
  });

  const lastEvent = await prisma.externalCalendarEvent.findFirst({
    where: { deadline: { courseOffering: { groups: { some: { groupId } } } } },
    orderBy: { lastSyncedAt: "desc" },
    select: { lastSyncedAt: true },
  });

  const syncErrorsCount = await prisma.externalCalendarEvent.count({
    where: {
      syncStatus: "FAILED",
      deadline: { courseOffering: { groups: { some: { groupId } } } },
    },
  });

  const missingCredentials: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID)
    missingCredentials.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET)
    missingCredentials.push("GOOGLE_CLIENT_SECRET");
  // A service account is deliberately not used for personal calendars.

  return {
    isConfigured: false,
    groupCalendarId: group?.calendarId || null,
    lastSyncedAt: lastEvent?.lastSyncedAt || null,
    totalSyncedEvents,
    syncErrorsCount,
    missingCredentials,
  };
}

/**
 * Idempotent sync of a Deadline to ExternalCalendarEvent
 * Ensures 1 Deadline == 1 ExternalCalendarEvent
 */
export async function syncDeadlineToExternalCalendar(
  deadlineId: string,
  calendarId: string,
) {
  // API transport and worker are not implemented. Never report a simulated sync.
  void deadlineId;
  void calendarId;
  return {
    success: false,
    reason: "NOT_IMPLEMENTED",
    message:
      "Общий календарь группы не используется. Личный Google Calendar подключается отдельно на странице календаря.",
  };
}
