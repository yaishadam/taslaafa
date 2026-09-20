/**
 * Every timestamp is stored UTC and rendered in Malé time.
 *
 * The Maldives is +05 all year with no daylight saving, so this is simpler
 * than it usually is -- but the shop's own timezone column is still the
 * source of truth, so a second branch somewhere else stays possible.
 */

export const MALDIVES_TZ = "Indian/Maldives";

type When = string | number | Date;

function toDate(when: When): Date {
  return when instanceof Date ? when : new Date(when);
}

/** "18:42" -- 24 hour, because a driver glancing at a screen should not parse am/pm. */
export function formatClock(when: When, tz: string = MALDIVES_TZ): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(toDate(when));
}

/**
 * "21 Sep".
 *
 * Built from parts rather than month: "short", because ICU renders September
 * as "Sept" in en-GB and that is one character of drift away from a layout
 * bug in a table of dates.
 */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function isoPartsInTz(when: When, tz: string): [number, number, number] {
  // en-CA gives YYYY-MM-DD, which is the only locale shape worth parsing.
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  })
    .format(toDate(when))
    .split("-")
    .map(Number);
  return [y, m, d];
}

export function formatDay(when: When, tz: string = MALDIVES_TZ): string {
  const [, month, day] = isoPartsInTz(when, tz);
  return `${day} ${MONTHS[month - 1]}`;
}

/** "21 Sep, 18:42" -- for the proof screen, where the date matters a week later. */
export function formatStamp(when: When, tz: string = MALDIVES_TZ): string {
  return `${formatDay(when, tz)}, ${formatClock(when, tz)}`;
}

/**
 * "4 min", "23 min", "1 h 04".
 *
 * Door-to-door times are minutes, not hours, so minutes stay unpadded and
 * readable. Past an hour something went wrong and the shape should change to
 * say so.
 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/** Whole minutes from a to b, negative if b is earlier. */
export function minutesBetween(a: When, b: When): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 60_000);
}

/** Minutes past due. Zero or negative means still within the promise. */
export function minutesLate(dueAt: When, now: When = new Date()): number {
  return minutesBetween(dueAt, now);
}

/** The shop's "today", which is not the server's today. */
export function shopDayStart(when: When, tz: string = MALDIVES_TZ): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(toDate(when));
  // The Maldives is a fixed +05, so the day boundary is always 19:00 UTC prior.
  return new Date(`${parts}T00:00:00+05:00`);
}

export function isShopToday(when: When, tz: string = MALDIVES_TZ): boolean {
  return (
    shopDayStart(when, tz).getTime() === shopDayStart(new Date(), tz).getTime()
  );
}
