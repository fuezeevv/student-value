/** A status label alone must never count as a verified academic result. */
export function isTrustedAccepted(
  progress:
    | {
        status: string;
        isVerified: boolean;
        taskId?: string;
        userId?: string;
        verifiedById?: string | null;
        verifiedAt?: Date | string | null;
        acceptedAt?: Date | string | null;
        verificationSource?: string | null;
        verificationSourceReferenceId?: string | null;
        verificationEvidence?: {
          confidence: string;
          entityType?: string;
          entityId?: string;
          quoteText?: string | null;
          source: { type: string };
        } | null;
      }
    | null
    | undefined,
): boolean {
  const evidence = progress?.verificationEvidence;
  return Boolean(
    progress?.status === "ACCEPTED" &&
    progress.isVerified &&
    progress.verifiedById &&
    progress.verifiedById !== progress.userId &&
    progress.verifiedAt &&
    progress.acceptedAt &&
    progress.verificationSourceReferenceId &&
    ["HEADMAN_CONFIRMED", "TEACHER_CONFIRMED", "SYSTEM_VERIFIED"].includes(
      progress.verificationSource || "",
    ) &&
    evidence?.confidence === "CONFIRMED" &&
    Boolean(evidence.quoteText?.trim()) &&
    evidence.entityType === "TASK_PROGRESS" &&
    evidence.entityId === `${progress.taskId}:${progress.userId}` &&
    ["OFFICIAL_DOCUMENT", "TEACHER_STATEMENT"].includes(evidence.source.type),
  );
}
export const progressEvidenceInclude = {
  verificationEvidence: { include: { source: true } },
} as const;
