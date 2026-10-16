ALTER TABLE "VariantAssignment" ADD COLUMN "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "VariantAssignment" ADD COLUMN "sourceReferenceId" TEXT;
ALTER TABLE "VariantAssignment" ADD CONSTRAINT "VariantAssignment_sourceReferenceId_fkey" FOREIGN KEY ("sourceReferenceId") REFERENCES "SourceReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
