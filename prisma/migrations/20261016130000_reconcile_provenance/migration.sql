-- Reconcile changes previously applied outside migration history. Safe on both
-- the existing database and an installation using only the saved migrations.
DO $$ BEGIN
  CREATE TYPE "DeadlineProvenance" AS ENUM ('TEACHER','OFFICIAL','HEADMAN_CONFIRMED','PERSONAL','UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "VerificationSource" AS ENUM ('SELF_REPORTED','HEADMAN_CONFIRMED','TEACHER_CONFIRMED','SYSTEM_VERIFIED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "ConfidenceLevel" ADD VALUE IF NOT EXISTS 'UNVERIFIED';
ALTER TABLE "Deadline" ADD COLUMN IF NOT EXISTS "provenance" "DeadlineProvenance" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "StudentTaskProgress" ALTER COLUMN "verificationSource" TYPE "VerificationSource"
  USING CASE WHEN "verificationSource"::text IN ('SELF_REPORTED','HEADMAN_CONFIRMED','TEACHER_CONFIRMED','SYSTEM_VERIFIED')
    THEN "verificationSource"::text::"VerificationSource" ELSE NULL END;
