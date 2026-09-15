import { describe, expect, it } from "vitest";
import { computeCurrentStreak } from "../streak";

const DAY_MS = 24 * 60 * 60 * 1000;
const TODAY = new Date("2026-09-15T18:00:00Z");

function daysAgo(n: number): Date {
  return new Date(TODAY.getTime() - n * DAY_MS);
}

describe("computeCurrentStreak", () => {
  it("returns 0 when there is no activity", () => {
    expect(computeCurrentStreak([], TODAY)).toBe(0);
  });

  it("counts today plus consecutive prior days", () => {
    const activity = [daysAgo(0), daysAgo(1), daysAgo(2)];
    expect(computeCurrentStreak(activity, TODAY)).toBe(3);
  });

  it("still counts the streak as alive when today has no activity yet but yesterday does", () => {
    const activity = [daysAgo(1), daysAgo(2)];
    expect(computeCurrentStreak(activity, TODAY)).toBe(2);
  });

  it("stops at the first gap", () => {
    const activity = [daysAgo(0), daysAgo(1), daysAgo(3)];
    expect(computeCurrentStreak(activity, TODAY)).toBe(2);
  });

  it("resets to 0 when the most recent activity is more than a day old", () => {
    const activity = [daysAgo(2), daysAgo(3)];
    expect(computeCurrentStreak(activity, TODAY)).toBe(0);
  });

  it("counts multiple attempts on the same day only once", () => {
    const activity = [daysAgo(0), new Date(daysAgo(0).getTime() + 60_000)];
    expect(computeCurrentStreak(activity, TODAY)).toBe(1);
  });
});
