ALTER TABLE "SourceReference" ALTER COLUMN "confidence" SET DEFAULT 'UNVERIFIED';
ALTER TABLE "CourseTeacher" ALTER COLUMN "status" SET DEFAULT 'CANDIDATE_UNVERIFIED';
ALTER TABLE "Deadline" ALTER COLUMN "provenance" SET DEFAULT 'UNKNOWN';
ALTER TABLE "ExternalCalendarEvent" ALTER COLUMN "syncStatus" SET DEFAULT 'PENDING';
ALTER TABLE "StudentTaskProgress" ADD COLUMN "verificationSourceReferenceId" TEXT;
ALTER TABLE "StudentTaskProgress" ADD CONSTRAINT "StudentTaskProgress_verificationSourceReferenceId_fkey"
  FOREIGN KEY ("verificationSourceReferenceId") REFERENCES "SourceReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD COLUMN "status" "TaskStatus" NOT NULL DEFAULT 'PUBLISHED';
-- Legacy records are audited and reconciled by the explicit data-repair script.
-- NOT VALID still enforces the invariant for all new/updated rows.
ALTER TABLE "StudentTaskProgress" ADD CONSTRAINT "accepted_requires_evidence" CHECK (
  "status" <> 'ACCEPTED' OR (
    "isVerified" = true AND "verifiedById" IS NOT NULL AND "verifiedById" <> "userId"
    AND "verifiedAt" IS NOT NULL AND "acceptedAt" IS NOT NULL
    AND "verificationSourceReferenceId" IS NOT NULL
    AND "verificationSource" IS NOT NULL AND "verificationSource" <> 'SELF_REPORTED'
  )
) NOT VALID;
