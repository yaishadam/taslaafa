import type { DeliveryEvent } from "@/lib/status";

/**
 * Turning the log into something a shop owner can read out to a customer a
 * week later.
 *
 * Every row here is a row in delivery_event. Nothing is summarised away and
 * nothing is invented -- if it is on this screen it happened, and if it
 * happened it is on this screen. That is the whole product.
 */

export type Tone = "neutral" | "good" | "bad" | "brand";

export type TimelineRow = {
  id: number;
  label: string;
  detail: string | null;
  at: string;
  tone: Tone;
};

export function describeEvent(event: DeliveryEvent): TimelineRow | null {
  const { payload } = event;
  const by = event.actorName ? `by ${event.actorName}` : null;

  switch (event.type) {
    case "created":
      return row(event, "Order taken", by, "neutral");

    case "sent_out":
      return row(
        event,
        "Left the shop",
        [by, payload.driver ? `with ${payload.driver}` : null]
          .filter(Boolean)
          .join(", ") || null,
        "neutral",
      );

    case "link_opened":
      return row(event, "Customer opened the link", null, "brand");

    case "code_attempted": {
      // The successful attempt is left out: code_confirmed says the same
      // thing one line down, and a proof screen that repeats itself reads
      // like it is padding a case.
      if (payload.ok === true) return null;

      const attempt = Number(payload.attempt ?? 0);
      return row(
        event,
        payload.locked === true
          ? "Code locked after three wrong tries"
          : "Wrong code entered",
        payload.locked === true ? by : `Attempt ${attempt} of 3${by ? `, ${by}` : ""}`,
        "bad",
      );
    }

    case "code_reissued":
      return row(event, "New code issued", by, "brand");

    case "marked_late":
      return row(
        event,
        "Passed the promised time",
        payload.minutes_over ? `${payload.minutes_over} minutes over` : null,
        "bad",
      );

    case "problem_reported":
      return row(
        event,
        `Customer reported: ${payload.reason ?? "a problem"}`,
        payload.note ? String(payload.note) : null,
        "bad",
      );

    case "code_confirmed":
      return row(event, "Handed over", by, "good");

    default:
      return null;
  }
}

function row(
  event: DeliveryEvent,
  label: string,
  detail: string | null,
  tone: Tone,
): TimelineRow {
  return { id: event.id, label, detail, at: event.createdAt, tone };
}

export function buildTimeline(events: DeliveryEvent[]): TimelineRow[] {
  return events
    .map(describeEvent)
    .filter((r): r is TimelineRow => r !== null)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id - b.id);
}
