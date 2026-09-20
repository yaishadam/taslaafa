/**
 * What state a delivery is in, derived from its log rather than stored.
 *
 * Nothing here queries anything. The shop's screens, the driver's screens and
 * the dashboard all reach the same verdict because they all call this, and it
 * can be tested without a database.
 *
 * Note that lockedness is read from the event log, not from delivery_code.
 * No client at the shop can read that table -- which is the point -- so the
 * `locked: true` flag on the failed code_attempted event is how a lock
 * becomes visible. The log is the interface.
 */

export type EventType =
  | "created"
  | "sent_out"
  | "link_opened"
  | "code_attempted"
  | "code_confirmed"
  | "marked_late"
  | "problem_reported"
  | "code_reissued";

export type DeliveryEvent = {
  id: number;
  type: EventType;
  actorKind: "owner" | "staff" | "driver" | "customer" | "system";
  actorName: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type Delivery = {
  id: string;
  orderRef: string | null;
  promiseMinutes: number;
  createdAt: string;
  sentAt: string | null;
  dueAt: string | null;
  confirmedAt: string | null;
  publicToken: string;
  customer: { id: string; name: string; phone: string; address: string };
  driver: { id: string; name: string } | null;
  events: DeliveryEvent[];
};

/**
 * How long a link can sit unopened before the shop should wonder whether the
 * customer ever saw it. Ten minutes: long enough that someone busy has not
 * been flagged, short enough to still be worth acting on.
 */
export const UNOPENED_AFTER_MINUTES = 10;

export type Concern = "late" | "locked" | "unopened";

export type Status = "taken" | "out" | "late" | "confirmed";

export type Derived = {
  status: Status;
  /** True once three wrong codes have been entered. */
  locked: boolean;
  linkOpenedAt: string | null;
  /** Empty when nothing is wrong. Drives the alert dot and the Problems filter. */
  concerns: Concern[];
  needsLook: boolean;
  /** Only meaningful once confirmed. */
  beatPromise: boolean | null;
  secondsToDoor: number | null;
  /** Minutes since it left the shop, or since it was taken if it has not. */
  minutesElapsed: number;
  /** Negative while still inside the promise. */
  minutesLate: number | null;
  reportedProblems: { reason: string; note: string | null; at: string }[];
};

function minutesSince(iso: string, now: number): number {
  return Math.floor((now - Date.parse(iso)) / 60_000);
}

export function derive(delivery: Delivery, now: number = Date.now()): Derived {
  const { events, sentAt, dueAt, confirmedAt } = delivery;

  const linkOpened = events.find((e) => e.type === "link_opened") ?? null;

  const locked = events.some(
    (e) => e.type === "code_attempted" && e.payload.locked === true,
  );

  const confirmEvent = events.find((e) => e.type === "code_confirmed");

  const reportedProblems = events
    .filter((e) => e.type === "problem_reported")
    .map((e) => ({
      reason: String(e.payload.reason ?? "Unspecified"),
      note: e.payload.note ? String(e.payload.note) : null,
      at: e.createdAt,
    }));

  const minutesLate =
    dueAt === null ? null : Math.floor((now - Date.parse(dueAt)) / 60_000);

  let status: Status;
  if (confirmedAt) status = "confirmed";
  else if (sentAt === null) status = "taken";
  else if (minutesLate !== null && minutesLate > 0) status = "late";
  else status = "out";

  const concerns: Concern[] = [];
  if (status === "late") concerns.push("late");
  // A locked code stays a problem even after the delivery is confirmed by a
  // reissued one -- the shop should still see that something went wrong at
  // that door. But once confirmed it is history, not something to act on.
  if (locked && !confirmedAt) concerns.push("locked");
  if (
    !confirmedAt &&
    sentAt !== null &&
    linkOpened === null &&
    minutesSince(sentAt, now) >= UNOPENED_AFTER_MINUTES
  ) {
    concerns.push("unopened");
  }

  const elapsedFrom = sentAt ?? delivery.createdAt;

  return {
    status,
    locked,
    linkOpenedAt: linkOpened?.createdAt ?? null,
    concerns,
    needsLook: concerns.length > 0,
    beatPromise: confirmEvent
      ? confirmEvent.payload.beat_promise === true
      : null,
    secondsToDoor: confirmEvent
      ? Number(confirmEvent.payload.seconds_to_door ?? 0)
      : null,
    minutesElapsed: minutesSince(elapsedFrom, now),
    minutesLate,
  reportedProblems,
  };
}

export const CONCERN_LABELS: Record<Concern, string> = {
  late: "Running late",
  locked: "Code locked",
  unopened: "Link not opened",
};

/** The counters across the top of Today. */
export type Counters = {
  outNow: number;
  onTimePercent: number | null;
  runningLate: number;
  needsLook: number;
  /** Mean door-to-door time of everything confirmed. Null before the first. */
  averageSecondsToDoor: number | null;
};

export function countBoard(
  deliveries: Delivery[],
  now: number = Date.now(),
): Counters {
  const derived = deliveries.map((d) => derive(d, now));

  const confirmed = derived.filter((d) => d.status === "confirmed");
  const onTime = confirmed.filter((d) => d.beatPromise === true);

  const times = confirmed
    .map((d) => d.secondsToDoor)
    .filter((s): s is number => s !== null);

  return {
    outNow: derived.filter((d) => d.status === "out" || d.status === "late")
      .length,
    averageSecondsToDoor: times.length
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : null,
    // No percentage until something has actually been delivered. "0%" before
    // the first drop of the day is a lie that looks like a metric.
    onTimePercent: confirmed.length
      ? Math.round((onTime.length / confirmed.length) * 100)
      : null,
    runningLate: derived.filter((d) => d.status === "late").length,
    needsLook: derived.filter((d) => d.needsLook).length,
  };
}

/**
 * Late first, then everything else newest first.
 *
 * The one at the top of this list should be the one someone is about to
 * complain about.
 */
export function boardOrder(
  deliveries: Delivery[],
  now: number = Date.now(),
): Delivery[] {
  return [...deliveries].sort((a, b) => {
    const da = derive(a, now);
    const db = derive(b, now);

    if (da.needsLook !== db.needsLook) return da.needsLook ? -1 : 1;
    if (da.status === "late" && db.status === "late") {
      return (db.minutesLate ?? 0) - (da.minutesLate ?? 0);
    }
    const at = Date.parse(a.sentAt ?? a.createdAt);
    const bt = Date.parse(b.sentAt ?? b.createdAt);
    return bt - at;
  });
}
