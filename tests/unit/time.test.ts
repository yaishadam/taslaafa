import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatDay,
  formatDuration,
  formatStamp,
  minutesBetween,
  minutesLate,
  shopDayStart,
} from "@/server/time";

describe("rendering UTC in Malé time", () => {
  it("shifts by five hours", () => {
    // 13:42 UTC is 18:42 in Malé.
    expect(formatClock("2026-09-21T13:42:00Z")).toBe("18:42");
  });

  it("rolls the date over at 19:00 UTC", () => {
    expect(formatDay("2026-09-21T18:59:00Z")).toBe("21 Sep");
    expect(formatDay("2026-09-21T19:00:00Z")).toBe("22 Sep");
  });

  it("uses 24 hour time", () => {
    expect(formatClock("2026-09-21T20:05:00Z")).toBe("01:05");
    expect(formatStamp("2026-09-21T20:05:00Z")).toBe("22 Sep, 01:05");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0 min"],
    [29, "0 min"],
    [31, "1 min"],
    [240, "4 min"],
    [1380, "23 min"],
    [3600, "1 h 00"],
    [3840, "1 h 04"],
    [7200, "2 h 00"],
  ])("%i seconds reads as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("never shows a negative duration", () => {
    expect(formatDuration(-90)).toBe("0 min");
  });
});

describe("lateness", () => {
  it("counts whole minutes past due", () => {
    expect(
      minutesLate("2026-09-21T13:00:00Z", "2026-09-21T13:07:00Z"),
    ).toBe(7);
  });

  it("is zero or negative while still inside the promise", () => {
    expect(
      minutesLate("2026-09-21T13:00:00Z", "2026-09-21T12:52:00Z"),
    ).toBe(-8);
  });

  it("measures between two instants", () => {
    expect(
      minutesBetween("2026-09-21T13:00:00Z", "2026-09-21T13:45:00Z"),
    ).toBe(45);
  });
});

describe("shopDayStart", () => {
  it("is midnight in Malé, which is 19:00 UTC the day before", () => {
    expect(shopDayStart("2026-09-21T13:42:00Z").toISOString()).toBe(
      "2026-09-20T19:00:00.000Z",
    );
  });

  it("puts 23:30 Malé on the same shop day as 08:00 Malé", () => {
    const morning = shopDayStart("2026-09-21T03:00:00Z"); // 08:00 Malé
    const night = shopDayStart("2026-09-21T18:30:00Z"); // 23:30 Malé
    expect(morning.getTime()).toBe(night.getTime());
  });
});
