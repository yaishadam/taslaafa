import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The tripwire.
 *
 * The two rules this directory protects are the product. A test that quietly
 * disappears in a busy week is worse than no test, because everyone goes on
 * believing it is there. So the guards attest to each other:
 *
 *   - This file checks that every guard exists and is byte-for-byte what was
 *     locked.
 *   - Each guard checks that this file exists.
 *
 * Deleting one guard fails this. Editing one fails this. Deleting this file
 * fails the others. Removing the protection means deleting all of them in a
 * single diff, which is a deliberate act that a reviewer can see.
 *
 * If you are changing a guard on purpose -- adding a case, tightening an
 * allowlist -- run `npm run guards:lock` and commit the new hashes with the
 * change. That is a normal thing to do. Doing it silently is not.
 */

const HERE = import.meta.dirname;
const LOCK_PATH = path.join(HERE, "GUARDS.lock.json");

/** CRLF checkouts must not change the hash. */
function hashFile(file: string): string {
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function lockedFiles(): Record<string, string> {
  if (!existsSync(LOCK_PATH)) {
    throw new Error(
      `GUARDS.lock.json is missing. If this was deliberate, run ` +
        `'npm run guards:lock' to recreate it. If it was not, restore it ` +
        `from git -- something removed the protection on the two rules.`,
    );
  }
  return JSON.parse(readFileSync(LOCK_PATH, "utf8"));
}

describe("the guards are all present and unmodified", () => {
  const locked = lockedFiles();

  it("locks at least the two rule guards", () => {
    expect(Object.keys(locked)).toEqual(
      expect.arrayContaining([
        "append-only.test.ts",
        "code-visibility.test.ts",
        "guards-intact.test.ts",
      ]),
    );
  });

  it.each(Object.keys(lockedFiles()))("%s still exists", (name) => {
    expect(
      existsSync(path.join(HERE, name)),
      `${name} is locked but missing. Restore it from git.`,
    ).toBe(true);
  });

  it.each(Object.entries(lockedFiles()))(
    "%s is unchanged",
    (name, expected) => {
      const actual = hashFile(path.join(HERE, name));
      expect(
        actual,
        `${name} has been edited since it was locked. If the change is ` +
          `intended, run 'npm run guards:lock' and commit the new hash ` +
          `alongside it.`,
      ).toBe(expected);
    },
  );

  it("locks every file in this directory, so none can be slipped in unlocked", () => {
    const present = readdirSync(HERE)
      .filter((f) => f !== "GUARDS.lock.json")
      .sort();

    expect(present).toEqual(Object.keys(locked).sort());
  });
});
