CREATE TABLE "MaterialFile" (
 "materialId" TEXT NOT NULL PRIMARY KEY,
 "filename" TEXT NOT NULL,
 "mimeType" TEXT NOT NULL,
 "byteSize" INTEGER NOT NULL,
 "sha256" TEXT NOT NULL,
 "content" BYTEA NOT NULL,
 CONSTRAINT "MaterialFile_size_check" CHECK ("byteSize" > 0 AND "byteSize" <= 20971520 AND octet_length("content") = "byteSize"),
 CONSTRAINT "MaterialFile_hash_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "MaterialFile_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "LessonContext" (
 "sessionId" TEXT NOT NULL PRIMARY KEY,
 "coverage" TEXT NOT NULL,
 "scheduleUrl" TEXT,
 "audienceNote" TEXT,
 "guideText" TEXT,
 "assignmentNotes" TEXT,
 "evidence" JSONB NOT NULL DEFAULT '[]',
 "importDigest" TEXT NOT NULL,
 CONSTRAINT "LessonContext_coverage_check" CHECK ("coverage" IN ('SCHEDULE_ONLY','MATERIALS','TRANSCRIPT','RECONSTRUCTED')),
 CONSTRAINT "LessonContext_evidence_check" CHECK (jsonb_typeof("evidence") = 'array'),
 CONSTRAINT "LessonContext_importDigest_check" CHECK ("importDigest" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "LessonContext_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
