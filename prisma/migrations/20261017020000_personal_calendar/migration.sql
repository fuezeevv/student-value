-- CreateTable
CREATE TABLE "PersonalCalendarConnection" (
    "userId" TEXT NOT NULL,
    "googleSubject" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "calendarId" TEXT,
    "provisioning" TEXT NOT NULL DEFAULT 'PENDING',
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reminderMinutes" INTEGER[] DEFAULT ARRAY[4320, 1440, 0]::INTEGER[],
    "requestedVersion" INTEGER NOT NULL DEFAULT 1,
    "syncedVersion" INTEGER NOT NULL DEFAULT 0,
    "retryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalCalendarConnection_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PersonalCalendarEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "desiredHash" TEXT,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "PersonalCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalCalendarConnection_state_retryAt_idx" ON "PersonalCalendarConnection"("state", "retryAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalCalendarEvent_userId_taskId_key" ON "PersonalCalendarEvent"("userId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalCalendarEvent_calendarId_eventId_key" ON "PersonalCalendarEvent"("calendarId", "eventId");

-- AddForeignKey
ALTER TABLE "PersonalCalendarConnection" ADD CONSTRAINT "PersonalCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalCalendarEvent" ADD CONSTRAINT "PersonalCalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PersonalCalendarConnection"("userId") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "PersonalCalendarConnection" ADD CONSTRAINT "personal_calendar_state" CHECK ("state" IN ('ACTIVE','REAUTH_REQUIRED','DISCONNECTED'));
ALTER TABLE "PersonalCalendarConnection" ADD CONSTRAINT "personal_calendar_provisioning" CHECK ("provisioning" IN ('PENDING','CREATING','READY','UNCERTAIN'));
ALTER TABLE "PersonalCalendarConnection" ADD CONSTRAINT "personal_calendar_versions" CHECK ("syncedVersion" >= 0 AND "requestedVersion" >= "syncedVersion" AND "attempts" >= 0);
ALTER TABLE "PersonalCalendarConnection" ADD CONSTRAINT "personal_calendar_reminders" CHECK (cardinality("reminderMinutes") <= 5 AND 0 <= ALL("reminderMinutes") AND 40320 >= ALL("reminderMinutes"));
ALTER TABLE "PersonalCalendarConnection" ADD CONSTRAINT "personal_calendar_not_primary" CHECK ("calendarId" IS NULL OR "calendarId" <> 'primary');
ALTER TABLE "PersonalCalendarConnection" ADD CONSTRAINT "personal_calendar_lease" CHECK (("leaseToken" IS NULL) = ("leaseUntil" IS NULL));
