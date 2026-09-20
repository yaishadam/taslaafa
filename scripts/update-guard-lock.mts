/**
 * Re-locks tests/guards after a deliberate change to one of them.
 *
 * Run with: npm run guards:lock
 *
 * Doing this is normal when you are tightening a guard. Doing it to make a
 * failing guard go away is the thing the lock exists to make visible.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(import.meta.dirname, "..", "tests", "guards");
const LOCK = path.join(DIR, "GUARDS.lock.json");

const lock: Record<string, string> = {};

for (const name of readdirSync(DIR).filter((f) => f !== "GUARDS.lock.json").sort()) {
  const text = readFileSync(path.join(DIR, name), "utf8").replace(/\r\n/g, "\n");
  lock[name] = createHash("sha256").update(text, "utf8").digest("hex");
  console.log(`  ${lock[name].slice(0, 12)}  ${name}`);
}

writeFileSync(LOCK, JSON.stringify(lock, null, 2) + "\n");
console.log(`\n  locked ${Object.keys(lock).length} files\n`);
