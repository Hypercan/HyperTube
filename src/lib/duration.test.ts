import { describe, expect, it } from "vitest";
import { formatDuration, parseDurationFilter, parseIsoDuration } from "./duration";

describe("parseIsoDuration", () => {
  it.each([
    ["PT45S", 45],
    ["PT12M3S", 723],
    ["PT1H2M3S", 3723],
    ["PT2H", 7200],
    ["P1DT1H", 90000],
    ["P0D", 0],
    ["garbage", 0],
  ])("%s → %i", (input, expected) => {
    expect(parseIsoDuration(input)).toBe(expected);
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(723)).toBe("12:03");
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(formatDuration(59)).toBe("0:59");
  });
});

describe("parseDurationFilter", () => {
  it("defaults to longform", () => {
    expect(parseDurationFilter(undefined)).toBe("20+");
    expect(parseDurationFilter("nope")).toBe("20+");
    expect(parseDurationFilter("60+")).toBe("60+");
  });
});
