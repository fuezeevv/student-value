import type { Prisma } from "@prisma/client";
export const confirmedDeadlineWhere = {
  status: "ACTIVE",
  provenance: { not: "UNKNOWN" },
  sourceReference: { confidence: "CONFIRMED" },
} satisfies Prisma.DeadlineWhereInput;
