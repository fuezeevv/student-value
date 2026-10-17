import type { Prisma } from "@prisma/client";
export async function enqueuePersonalCalendar(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.personalCalendarConnection.updateMany({
    where: { userId, state: "ACTIVE" },
    data: { requestedVersion: { increment: 1 }, retryAt: new Date() },
  });
}
export async function enqueueGroupCalendars(
  tx: Prisma.TransactionClient,
  groupId: string,
) {
  await tx.personalCalendarConnection.updateMany({
    where: { state: "ACTIVE", user: { memberships: { some: { groupId } } } },
    data: { requestedVersion: { increment: 1 }, retryAt: new Date() },
  });
}
