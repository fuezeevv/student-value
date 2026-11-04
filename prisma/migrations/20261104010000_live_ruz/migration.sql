ALTER TABLE "StudyGroup" ADD COLUMN "ruzGroupId" INTEGER;
CREATE UNIQUE INDEX "StudyGroup_ruzGroupId_key" ON "StudyGroup"("ruzGroupId");

CREATE TABLE "RuzScheduleCache" (
  "groupId" TEXT NOT NULL,
  "weekStart" TEXT NOT NULL,
  "payload" JSONB,
  "fetchedAt" TIMESTAMP(3),
  "leaseUntil" TIMESTAMP(3),
  "retryAfter" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  CONSTRAINT "RuzScheduleCache_pkey" PRIMARY KEY ("groupId", "weekStart"),
  CONSTRAINT "RuzScheduleCache_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
