import { describe, expect, it } from "vitest";
import {
  formatPhone,
  isValidPhone,
  normalisePhone,
  toWhatsAppNumber,
} from "@/server/phone";

describe("normalisePhone", () => {
  it("accepts the seven digits staff actually type", () => {
    expect(normalisePhone("7712233")).toBe("+9607712233");
  });

  it.each([
    ["771 2233", "+9607712233"],
    ["771-2233", "+9607712233"],
    [" 7712233 ", "+9607712233"],
    ["+960 771 2233", "+9607712233"],
    ["9607712233", "+9607712233"],
    ["00960 7712233", "+9607712233"],
  ])("normalises %s", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each(["", "771223", "77122334", "abcdefg", "+1 555 0100"])(
    "rejects %s",
    (input) => {
      expect(normalisePhone(input)).toBeNull();
    },
  );

  it("accepts a landline, because the office is a real delivery address", () => {
    expect(normalisePhone("3323456")).toBe("+9603323456");
  });
});

describe("isValidPhone", () => {
  it("only accepts the stored shape", () => {
    expect(isValidPhone("+9607712233")).toBe(true);
    expect(isValidPhone("7712233")).toBe(false);
    expect(isValidPhone("+960771223")).toBe(false);
  });
});

describe("formatPhone", () => {
  it("groups for reading", () => {
    expect(formatPhone("+9607712233")).toBe("771 2233");
  });

  it("passes anything unexpected through untouched", () => {
    expect(formatPhone("nonsense")).toBe("nonsense");
  });
});

describe("toWhatsAppNumber", () => {
  it("drops the plus for wa.me", () => {
    expect(toWhatsAppNumber("+9607712233")).toBe("9607712233");
  });
});
