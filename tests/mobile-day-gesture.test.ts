import { describe, it, expect } from "vitest";
import { daySwipeDirection } from "../packages/mobile-contracts/src/day-gesture";
describe("Day navigation intent", () => {
  it("switches in both directions, including a short deliberate flick", () => {
    expect(daySwipeDirection({ dx: -100, dy: 5, vx: -0.3 })).toBe(1);
    expect(daySwipeDirection({ dx: 100, dy: 5, vx: 0.3 })).toBe(-1);
    expect(daySwipeDirection({ dx: -38, dy: 3, vx: -0.8 })).toBe(1);
  });
  it("does not steal vertical scrolling, diagonal gestures or accidental button motion", () => {
    for (const gesture of [
      { dx: 20, dy: 2, vx: 1 },
      { dx: 80, dy: 90, vx: 1 },
      { dx: 50, dy: 0, vx: 0.1 },
      { dx: NaN, dy: 0, vx: 1 },
    ])
      expect(daySwipeDirection(gesture)).toBe(0);
  });
});
