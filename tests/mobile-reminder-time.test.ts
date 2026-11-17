import { describe, it, expect } from "vitest";
import { deadlineReminderTime } from "../packages/mobile-contracts/src/reminder-time";
describe("Moscow notification timing", () => {
  it("uses the previous Moscow day, including deadlines near UTC midnight", () => {
    expect(
      deadlineReminderTime(
        new Date("2026-11-20T00:30:00+03:00"),
        Date.parse("2026-11-18T00:00:00Z"),
      )?.toISOString(),
    ).toBe("2026-11-19T07:00:00.000Z");
    expect(
      deadlineReminderTime(
        new Date("2026-11-20T23:59:59+03:00"),
        Date.parse("2026-11-18T00:00:00Z"),
      )?.toISOString(),
    ).toBe("2026-11-19T07:00:00.000Z");
  });
  it("falls back without scheduling after the deadline", () => {
    const end = Date.parse("2026-11-20T20:59:59Z");
    expect(
      deadlineReminderTime(new Date(end), end - 3 * 3600_000)?.getTime(),
    ).toBe(end - 2 * 3600_000);
    expect(deadlineReminderTime(new Date(end), end - 60_000)?.getTime()).toBe(
      end - 50_000,
    );
    expect(deadlineReminderTime(new Date(end), end - 5_000)).toBeNull();
    expect(deadlineReminderTime(new Date(end), end)).toBeNull();
    expect(deadlineReminderTime(new Date(NaN), end)).toBeNull();
  });
});
