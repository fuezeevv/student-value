import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
/** Missing, unverified or conflicting assignments all resolve to no personal variant. */
export async function assignedVariants(user: SessionUser, taskIds: string[]) {
  const assignments = await prisma.variantAssignment.findMany({
    where: {
      enrollment: { userId: user.id, groupId: user.groupId },
      taskVariant: { taskId: { in: taskIds } },
      confidence: "CONFIRMED",
      sourceReference: {
        confidence: "CONFIRMED",
        entityType: "VARIANT_ASSIGNMENT",
        source: { groupId: user.groupId },
      },
    },
    include: { taskVariant: true, sourceReference: true },
  });
  const grouped = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    if (assignment.sourceReference?.entityId !== assignment.id) continue;
    const id = assignment.taskVariant.taskId;
    grouped.set(id, [...(grouped.get(id) ?? []), assignment]);
  }
  return new Map(
    [...grouped]
      .filter(([, rows]) => rows.length === 1)
      .map(([taskId, rows]) => [taskId, rows[0].taskVariant]),
  );
}
