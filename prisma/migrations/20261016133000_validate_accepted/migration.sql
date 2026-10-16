-- Current legacy results were audited before this validation. Fresh installs
-- have no progress rows; new and existing installations enforce the same CHECK.
ALTER TABLE "StudentTaskProgress" VALIDATE CONSTRAINT "accepted_requires_evidence";
