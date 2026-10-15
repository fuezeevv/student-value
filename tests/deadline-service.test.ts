import { describe, it, expect } from "vitest";
import { calculateDeadlineStatus } from "../src/server/services/deadline-service";

describe("Deadline Service (Europe/Moscow)", () => {
  const baseNow = new Date("2026-10-15T12:00:00+03:00");

  it("returns NO_DEADLINE when deadline is null", () => {
    const result = calculateDeadlineStatus(null, baseNow, false);
    expect(result.urgency).toBe("NO_DEADLINE");
    expect(result.formattedDate).toBe("Срок не указан");
    expect(result.badgeLabel).toBe("Без срока");
    expect(result.badgeVariant).toBe("muted");
  });

  it("returns ACCEPTED if task is completed, even if date was in past", () => {
    const pastDate = new Date("2026-09-20T23:59:00+03:00");
    const result = calculateDeadlineStatus(pastDate, baseNow, true);
    expect(result.urgency).toBe("ACCEPTED");
    expect(result.badgeLabel).toBe("Принято");
    expect(result.badgeVariant).toBe("success");
  });

  it("detects OVERDUE when date is in the past and task is not accepted", () => {
    const pastDate = new Date("2026-10-10T23:59:00+03:00");
    const result = calculateDeadlineStatus(pastDate, baseNow, false);
    expect(result.urgency).toBe("OVERDUE");
    expect(result.badgeVariant).toBe("destructive");
    expect(result.badgeLabel).toContain("Просрочено");
  });

  it("detects DUE_TODAY when date is later today", () => {
    const todayEvening = new Date("2026-10-15T23:59:00+03:00");
    const result = calculateDeadlineStatus(todayEvening, baseNow, false);
    expect(result.urgency).toBe("DUE_TODAY");
    expect(result.badgeLabel).toBe("Сегодня");
    expect(result.badgeVariant).toBe("destructive");
  });

  it("detects DUE_TOMORROW when date is tomorrow", () => {
    const tomorrow = new Date("2026-10-16T23:59:00+03:00");
    const result = calculateDeadlineStatus(tomorrow, baseNow, false);
    expect(result.urgency).toBe("DUE_TOMORROW");
    expect(result.badgeLabel).toBe("Завтра");
    expect(result.badgeVariant).toBe("warning");
  });

  it("detects DUE_URGENT when date is within 2 to 7 days", () => {
    const inFourDays = new Date("2026-10-19T23:59:00+03:00");
    const result = calculateDeadlineStatus(inFourDays, baseNow, false);
    expect(result.urgency).toBe("DUE_URGENT");
    expect(result.badgeLabel).toBe("Осталось 4 дн.");
    expect(result.badgeVariant).toBe("urgent");
  });

  it("detects UPCOMING when date is more than 7 days ahead", () => {
    const inTwoWeeks = new Date("2026-11-01T23:59:00+03:00");
    const result = calculateDeadlineStatus(inTwoWeeks, baseNow, false);
    expect(result.urgency).toBe("UPCOMING");
    expect(result.badgeLabel).toContain("Через 17 дн.");
    expect(result.badgeVariant).toBe("info");
  });
});
