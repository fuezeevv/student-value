import { prisma } from "@/lib/db/prisma";

export interface CalendarIntegrationStatus {
  isConfigured: boolean;
  groupCalendarId: string | null;
  lastSyncedAt: Date | null;
  totalSyncedEvents: number;
  syncErrorsCount: number;
  missingCredentials: string[];
}

export async function getCalendarIntegrationStatus(
  groupId: string
): Promise<CalendarIntegrationStatus> {
  const group = await prisma.studyGroup.findUnique({
    where: { id: groupId },
    select: { calendarId: true },
  });

  const totalSyncedEvents = await prisma.externalCalendarEvent.count({
    where: { syncStatus: "SYNCED" },
  });

  const lastEvent = await prisma.externalCalendarEvent.findFirst({
    orderBy: { lastSyncedAt: "desc" },
    select: { lastSyncedAt: true },
  });

  const syncErrorsCount = await prisma.externalCalendarEvent.count({
    where: { syncStatus: "FAILED" },
  });

  const missingCredentials: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID) missingCredentials.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET) missingCredentials.push("GOOGLE_CLIENT_SECRET");
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) missingCredentials.push("GOOGLE_SERVICE_ACCOUNT_KEY (или OAuth Refresh Token)");

  return {
    isConfigured: missingCredentials.length === 0,
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
  calendarId: string
) {
  const deadline = await prisma.deadline.findUnique({
    where: { id: deadlineId },
    include: {
      task: true,
      courseOffering: { include: { courseDefinition: true } },
    },
  });

  if (!deadline) {
    throw new Error("Deadline not found");
  }

  // Check if credentials exist
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    // Record as pending sync or note missing configuration
    return {
      success: false,
      reason: "MISSING_GOOGLE_CREDENTIALS",
      message: "Google API credentials are not yet configured in environment variables.",
    };
  }

  // Idempotent upsert in database
  const existing = await prisma.externalCalendarEvent.findFirst({
    where: { deadlineId, calendarId },
  });

  if (existing) {
    // In actual Google API call, we would do calendar.events.patch(...)
    const updated = await prisma.externalCalendarEvent.update({
      where: { id: existing.id },
      data: {
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
        lastError: null,
      },
    });
    return { success: true, event: updated, action: "UPDATED" };
  } else {
    // In actual Google API call, we would do calendar.events.insert(...)
    const created = await prisma.externalCalendarEvent.create({
      data: {
        deadlineId,
        calendarId,
        externalEventId: `sv1984_event_${deadline.id.slice(0, 12)}`,
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
      },
    });
    return { success: true, event: created, action: "CREATED" };
  }
}
