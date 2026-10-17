-- CreateEnum
CREATE TYPE "ProposalKind" AS ENUM ('NOTE', 'MATERIAL', 'TASK_REQUIREMENT', 'DEADLINE', 'LESSON_SUMMARY');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CLARIFICATION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPlatformOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "initialOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Semester" ALTER COLUMN "number" DROP NOT NULL,
ALTER COLUMN "startDate" DROP NOT NULL,
ALTER COLUMN "endDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CourseMaterial" ADD COLUMN     "sourceNote" TEXT;

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "isTimeKnown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recordingUrl" TEXT,
ADD COLUMN     "sourceNote" TEXT,
ADD COLUMN     "status" "TaskStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "taughtBy" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "SessionTask" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,

    CONSTRAINT "SessionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionMaterial" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,

    CONSTRAINT "SessionMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskRequirement" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceReferenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeProposal" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "ProposalKind" NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "taskId" TEXT,
    "sessionId" TEXT,
    "deadlineId" TEXT,
    "proposedDay" TEXT,
    "sharedBriefId" TEXT,
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "appliedEntityId" TEXT,
    "appliedKind" "ProposalKind",
    "transcriptId" TEXT,
    "quoteStart" INTEGER,
    "quoteEnd" INTEGER,
    "lessonVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedBrief" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "SharedBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionTask_sessionId_taskId_key" ON "SessionTask"("sessionId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMaterial_sessionId_materialId_key" ON "SessionMaterial"("sessionId", "materialId");

-- CreateIndex
CREATE INDEX "TaskRequirement_taskId_idx" ON "TaskRequirement"("taskId");

-- CreateIndex
CREATE INDEX "ChangeProposal_groupId_status_createdAt_idx" ON "ChangeProposal"("groupId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeProposal_authorId_transcriptId_quoteStart_quoteEnd_key" ON "ChangeProposal"("authorId", "transcriptId", "quoteStart", "quoteEnd");

-- CreateIndex
CREATE INDEX "SharedBrief_createdAt_idx" ON "SharedBrief"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOfferingGroup_courseOfferingId_key" ON "CourseOfferingGroup"("courseOfferingId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTask" ADD CONSTRAINT "SessionTask_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTask" ADD CONSTRAINT "SessionTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMaterial" ADD CONSTRAINT "SessionMaterial_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMaterial" ADD CONSTRAINT "SessionMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRequirement" ADD CONSTRAINT "TaskRequirement_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRequirement" ADD CONSTRAINT "TaskRequirement_sourceReferenceId_fkey" FOREIGN KEY ("sourceReferenceId") REFERENCES "SourceReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_sharedBriefId_fkey" FOREIGN KEY ("sharedBriefId") REFERENCES "SharedBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedBrief" ADD CONSTRAINT "SharedBrief_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve visibility of existing lessons; new lessons start as drafts.
UPDATE "ClassSession" SET "status" = 'PUBLISHED';
-- Unambiguous attribution of legacy notifications, without guessing group membership.
UPDATE "Notification" n SET "groupId" = membership."groupId" FROM (SELECT "userId", min("groupId") AS "groupId" FROM "GroupMember" GROUP BY "userId" HAVING count(*) = 1) membership WHERE n."userId" = membership."userId";
