import { describe, expect, it } from "vitest";
import {
  hashCode,
  mintCode,
  mintCodeDigits,
  mintToken,
  revealCode,
} from "@/server/codes";

describe("mintCode", () => {
  it("always produces exactly four digits, leading zeros kept", () => {
    for (let i = 0; i < 500; i++) {
      expect(mintCode().code).toMatch(/^\d{4}$/);
    }
  });

  it("pads codes below 1000 instead of emitting three digits", () => {
    // The padStart is the easiest thing in this file to break. Over 5,000
    // draws roughly 500 codes should start with a zero; seeing none would
    // mean the whole 0000-0999 band is missing.
    const draws = Array.from({ length: 5_000 }, mintCodeDigits);
    const leadingZero = draws.filter((c) => c.startsWith("0")).length;
    expect(leadingZero).toBeGreaterThan(300);
    expect(leadingZero).toBeLessThan(700);
  });

  it("reaches across the whole range", () => {
    // Coupon collector: 60,000 draws from 10,000 values leaves about 25
    // unseen (10000 * e^-6). Anything below 9,800 is a broken generator, not
    // bad luck -- that would be eleven standard deviations out.
    const seen = new Set<string>();
    for (let i = 0; i < 60_000; i++) seen.add(mintCodeDigits());
    expect(seen.size).toBeGreaterThan(9_800);
  });

  it("stores nothing that reveals the code without the key", () => {
    const { code, codeHash, codeCt } = mintCode();
    expect(codeHash).not.toContain(code);
    expect(codeCt).not.toContain(code);
    expect(Buffer.from(codeCt, "base64").toString("utf8")).not.toContain(code);
  });
});

describe("hashCode", () => {
  it("is stable, so a typed code can be matched against the stored hash", () => {
    expect(hashCode("0427")).toBe(hashCode("0427"));
  });

  it("separates codes that differ only by a leading zero", () => {
    expect(hashCode("0427")).not.toBe(hashCode("427"));
  });

  it("is a fixed-length digest regardless of input", () => {
    expect(hashCode("0000")).toHaveLength(64);
    expect(hashCode("9999")).toHaveLength(64);
  });
});

describe("revealCode", () => {
  it("round-trips a minted code", () => {
    const { code, codeCt } = mintCode();
    expect(revealCode(codeCt)).toBe(code);
  });

  it("gives a different ciphertext each time for the same code", () => {
    // Otherwise equal ciphertexts would leak which deliveries share a code.
    const a = mintCode();
    let sameCode = mintCode();
    for (let i = 0; i < 2000 && sameCode.code !== a.code; i++) {
      sameCode = mintCode();
    }
    if (sameCode.code === a.code) {
      expect(sameCode.codeCt).not.toBe(a.codeCt);
    }
  });

  it("refuses a tampered ciphertext rather than returning wrong digits", () => {
    const { codeCt } = mintCode();
    const buf = Buffer.from(codeCt, "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => revealCode(buf.toString("base64"))).toThrow();
  });
});

describe("mintToken", () => {
  it("is url-safe and long enough to be unguessable", () => {
    const t = mintToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 5000 }, mintToken));
    expect(seen.size).toBe(5000);
  });
});
