ALTER TABLE "StudyGroup" ADD COLUMN "shareStudyContent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudentTaskProgress" ADD COLUMN "completedAt" TIMESTAMP(3), ADD COLUMN "completionReviewedAt" TIMESTAMP(3), ADD COLUMN "completionReviewedById" TEXT;
ALTER TABLE "StudentTaskProgress" ADD CONSTRAINT "StudentTaskProgress_completionReviewedById_fkey" FOREIGN KEY ("completionReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentTaskProgress" ADD CONSTRAINT "CompletionReviewer_not_self" CHECK ("completionReviewedById" IS NULL OR "completionReviewedById" <> "userId");
