import { describe, expect, it } from "vitest";
import { chooseFocus, type PrioritizableWork } from "../src/lib/study/priority";
const work = (
  id: string,
  status: string,
  urgency: string,
  days: number | null,
  date: string | null,
): PrioritizableWork & { id: string } => ({
  id,
  accepted: false,
  userProgress: { status },
  deadline: date ? { date: new Date(date) } : null,
  timing: { urgency, daysRemaining: days },
});
describe("daily work priority", () => {
  it("offers a future submission before a stale overdue date", () => {
    const old = work("old", "NOT_STARTED", "OVERDUE", -24, "2026-09-22");
    const next = work("next", "NOT_STARTED", "UPCOMING", 11, "2026-10-27");
    expect(chooseFocus([old, next])?.id).toBe("next");
  });
  it("surfaces this week's deadline before distant work already in progress", () => {
    expect(
      chooseFocus([
        work("distant", "IN_PROGRESS", "UPCOMING", 53, "2026-12-08"),
        work("soon", "NOT_STARTED", "DUE_TOMORROW", 1, "2026-10-17"),
      ])?.id,
    ).toBe("soon");
  });
  it("does not ask students to re-submit work waiting for a result", () => {
    const waiting = work("waiting", "SUBMITTED", "OVERDUE", -1, "2026-10-15");
    const accepted = {
      ...waiting,
      id: "accepted",
      accepted: true,
      userProgress: { status: "ACCEPTED" },
    };
    expect(chooseFocus([waiting, accepted])).toBeUndefined();
  });
  it("returns to the most recent overdue work when there are no future dates", () => {
    expect(
      chooseFocus([
        work("old", "NOT_STARTED", "OVERDUE", -24, "2026-09-22"),
        work("recent", "NOT_STARTED", "OVERDUE", -3, "2026-10-13"),
      ])?.id,
    ).toBe("recent");
  });
  it("supports undated work and an empty semester", () => {
    expect(
      chooseFocus([work("undated", "NOT_STARTED", "NO_DEADLINE", null, null)])
        ?.id,
    ).toBe("undated");
    expect(chooseFocus([])).toBeUndefined();
  });
});
