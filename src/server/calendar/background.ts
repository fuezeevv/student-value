import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { calendarEnabled } from "./crypto";
import { drainCalendarQueue, syncPersonalCalendar } from "./sync";
// Durable dirty versions live in PostgreSQL; after() is an accelerator, not the sole queue.
export function kickCalendarUpdates(preferredUserId?: string) {
  if (!calendarEnabled()) return;
  after(async () => {
    const start = Date.now();
    try {
      if (
        preferredUserId &&
        (await prisma.personalCalendarConnection.count({
          where: {
            userId: preferredUserId,
            state: "ACTIVE",
            retryAt: { lte: new Date() },
          },
        }))
      )
        await syncPersonalCalendar(preferredUserId, { budgetMs: 10000 });
      const remaining = 14000 - (Date.now() - start);
      if (remaining > 1000)
        await drainCalendarQueue({ budgetMs: remaining, maxUsers: 12 });
    } catch {
      /* Pending versions remain for the next request/daily cron. Never log credentials. */
    }
  });
}
export function refreshCalendarAfterVisit(userId: string) {
  if (calendarEnabled())
    after(async () => {
      try {
        await syncPersonalCalendar(userId, { budgetMs: 12000 });
      } catch {
        /* UI remains usable; persistent state records provider failures. */
      }
    });
}
