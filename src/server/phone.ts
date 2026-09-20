/**
 * Maldivian numbers are 7 digits. Staff type those 7 digits and nothing else,
 * so everything here exists to accept what someone actually types -- spaces,
 * dashes, a country code they pasted from Viber -- and store one shape.
 *
 * Deliberately not validating the leading digit. Mobiles start 7 or 9 and
 * landlines 3 or 6, but a shop that delivers to an office should not be
 * stopped at the form because the field is labelled "mobile".
 */

const E164 = /^\+960[0-9]{7}$/;

export function normalisePhone(input: string): string | null {
  let digits = input.replace(/[^\d]/g, "");

  // 00960 7712233 -> 960 7712233
  if (digits.startsWith("00")) digits = digits.slice(2);
  // 9607712233 -> 7712233
  if (digits.length === 10 && digits.startsWith("960")) digits = digits.slice(3);

  if (digits.length !== 7) return null;
  return `+960${digits}`;
}

export function isValidPhone(value: string): boolean {
  return E164.test(value);
}

/** +9607712233 -> "771 2233". For display only; never store this shape. */
export function formatPhone(e164: string): string {
  if (!isValidPhone(e164)) return e164;
  const d = e164.slice(4);
  return `${d.slice(0, 3)} ${d.slice(3)}`;
}

/** The number as a wa.me link needs no plus and no spaces. */
export function toWhatsAppNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}
