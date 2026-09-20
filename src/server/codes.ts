import crypto from "node:crypto";

/**
 * Rule 2: nobody at the shop can read a code.
 *
 * This is the only module in the app that may touch a delivery code. It is
 * server-only -- importing it from a client component is a build error, and
 * tests/guards/ asserts that `revealCode` is imported by exactly one file.
 *
 * A code has to be two things at once: verifiable when the driver types it,
 * and displayable on the customer's page. A one-way hash alone cannot do the
 * second, so every code is stored twice:
 *
 *   code_hash  HMAC-SHA256(mac_key, code)   verifying an attempt
 *   code_ct    AES-256-GCM(enc_key, code)   showing the customer
 *
 * Both keys are HKDF-derived from TASLAAFA_CODE_KEY, which lives in the
 * environment and is never written to the database. That is what makes a
 * database dump useless: there are only 10,000 possible codes, so an
 * unkeyed hash would fall to a wordlist in milliseconds. Without the key,
 * neither column can be read or brute-forced.
 */

import "server-only";

const KEY_BYTES = 32;
const IV_BYTES = 12; // GCM standard
const TAG_BYTES = 16;

let cachedRoot: Buffer | null = null;

function rootKey(): Buffer {
  if (cachedRoot) return cachedRoot;

  const raw = process.env.TASLAAFA_CODE_KEY;
  if (!raw) {
    throw new Error(
      "TASLAAFA_CODE_KEY is not set. Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `TASLAAFA_CODE_KEY must be ${KEY_BYTES} bytes of base64, got ${key.length}.`,
    );
  }

  cachedRoot = key;
  return key;
}

type SubkeyName = "taslaafa:mac:v1" | "taslaafa:enc:v1";

const subkeyCache = new Map<SubkeyName, Buffer>();

/**
 * Separate keys for separate jobs, from one secret.
 *
 * Cached. Re-deriving on every mint and every verify is pure waste, and it is
 * the difference between a fast test suite and a slow one.
 */
function subkey(info: SubkeyName): Buffer {
  const hit = subkeyCache.get(info);
  if (hit) return hit;

  const derived = Buffer.from(
    crypto.hkdfSync("sha256", rootKey(), Buffer.alloc(0), info, KEY_BYTES),
  );
  subkeyCache.set(info, derived);
  return derived;
}

/**
 * The hash stored in delivery_code.code_hash, and the value the confirm route
 * passes to attempt_code() in Postgres. The plaintext never leaves this
 * process.
 */
export function hashCode(code: string): string {
  return crypto
    .createHmac("sha256", subkey("taslaafa:mac:v1"))
    .update(code, "utf8")
    .digest("hex");
}

function encryptCode(code: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", subkey("taslaafa:enc:v1"), iv);
  const ct = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

/**
 * Decrypt a stored code for display.
 *
 * ONLY the public customer page may call this. Every other caller is a bug,
 * and tests/guards/no-code-in-authenticated-responses.test.ts fails the build
 * if a second importer appears.
 */
export function revealCode(codeCt: string): string {
  const buf = Buffer.from(codeCt, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = buf.subarray(IV_BYTES + TAG_BYTES);

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    subkey("taslaafa:enc:v1"),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export type MintedCode = {
  /** The plaintext. Returned once, never stored, never logged. */
  code: string;
  codeHash: string;
  codeCt: string;
};

/**
 * Mint a fresh 4-digit code.
 *
 * randomInt is uniform over the full range, so 0000 and 1234 are as likely as
 * anything else. Excluding "memorable" codes would shrink the space for no
 * real gain -- three attempts and a lock is what protects this, not entropy.
 */
export function mintCode(): MintedCode {
  const code = mintCodeDigits();
  return { code, codeHash: hashCode(code), codeCt: encryptCode(code) };
}

/**
 * Just the digits, with no key material involved. Split out from mintCode so
 * the distribution can be tested across tens of thousands of draws without
 * running AES that many times.
 */
export function mintCodeDigits(): string {
  return String(crypto.randomInt(0, 10_000)).padStart(4, "0");
}

/** An unguessable public link token: 16 random bytes, 22 url-safe characters. */
export function mintToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}
