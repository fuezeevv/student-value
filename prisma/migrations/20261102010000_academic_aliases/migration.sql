ALTER TABLE "CourseOffering" ADD COLUMN "mergedIntoId" TEXT;
ALTER TABLE "Task" ADD COLUMN "mergedIntoId" TEXT;
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseOffering" ADD CONSTRAINT "course_alias_not_self" CHECK ("mergedIntoId" IS NULL OR ("mergedIntoId" <> "id" AND "status" = 'ARCHIVED'));
ALTER TABLE "Task" ADD CONSTRAINT "task_alias_not_self" CHECK ("mergedIntoId" IS NULL OR ("mergedIntoId" <> "id" AND "status" = 'ARCHIVED'));
