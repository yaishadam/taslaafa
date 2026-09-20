import { describe, expect, it } from "vitest";
import {
  boardOrder,
  countBoard,
  derive,
  UNOPENED_AFTER_MINUTES,
  type Delivery,
  type DeliveryEvent,
  type EventType,
} from "@/lib/status";

const NOW = Date.parse("2026-09-21T13:00:00Z");
const minutesAgo = (n: number) => new Date(NOW - n * 60_000).toISOString();

let nextEventId = 1;

function event(
  type: EventType,
  at: string,
  payload: Record<string, unknown> = {},
): DeliveryEvent {
  return {
    id: nextEventId++,
    type,
    actorKind: "staff",
    actorName: "Aishath Reem",
    createdAt: at,
    payload,
  };
}

function delivery(overrides: Partial<Delivery> = {}): Delivery {
  const sentAt = minutesAgo(10);
  return {
    id: "d1",
    orderRef: "A-1041",
    promiseMinutes: 30,
    createdAt: minutesAgo(13),
    sentAt,
    dueAt: new Date(Date.parse(sentAt) + 30 * 60_000).toISOString(),
    confirmedAt: null,
    publicToken: "tok",
    customer: {
      id: "c1",
      name: "Aminath Shifa",
      phone: "+9607712233",
      address: "Rihiveli, Majeedhee Magu",
    },
    driver: { id: "u1", name: "Hassan Rasheed" },
    events: [
      event("created", minutesAgo(13)),
      event("sent_out", sentAt),
      event("link_opened", minutesAgo(9)),
    ],
    ...overrides,
  };
}

describe("status", () => {
  it("is out while inside the promise", () => {
    expect(derive(delivery(), NOW).status).toBe("out");
  });

  it("turns late the minute it passes due, without anyone refreshing", () => {
    const sentAt = minutesAgo(31);
    const d = delivery({
      sentAt,
      dueAt: new Date(Date.parse(sentAt) + 30 * 60_000).toISOString(),
    });
    const got = derive(d, NOW);
    expect(got.status).toBe("late");
    expect(got.minutesLate).toBe(1);
  });

  it("is confirmed once there is a confirmed_at, late or not", () => {
    const d = delivery({ confirmedAt: minutesAgo(2) });
    expect(derive(d, NOW).status).toBe("confirmed");
  });

  it("is taken, not out, before it has left the shop", () => {
    const d = delivery({ sentAt: null, dueAt: null });
    expect(derive(d, NOW).status).toBe("taken");
  });
});

describe("lockedness comes from the log, not from the code table", () => {
  it("is locked once an attempt carries locked: true", () => {
    const d = delivery({
      events: [
        event("sent_out", minutesAgo(10)),
        event("code_attempted", minutesAgo(3), { ok: false, attempt: 1 }),
        event("code_attempted", minutesAgo(2), { ok: false, attempt: 2 }),
        event("code_attempted", minutesAgo(1), {
          ok: false,
          attempt: 3,
          locked: true,
        }),
      ],
    });
    expect(derive(d, NOW).locked).toBe(true);
    expect(derive(d, NOW).concerns).toContain("locked");
  });

  it("is not locked after only two wrong attempts", () => {
    const d = delivery({
      events: [
        event("sent_out", minutesAgo(10)),
        event("code_attempted", minutesAgo(3), { ok: false, attempt: 1 }),
        event("code_attempted", minutesAgo(2), { ok: false, attempt: 2 }),
      ],
    });
    expect(derive(d, NOW).locked).toBe(false);
  });

  it("stops being something to act on once the delivery is confirmed", () => {
    // The lock stays in the record -- it happened -- but a confirmed
    // delivery is history, not a problem sitting on the board.
    const d = delivery({
      confirmedAt: minutesAgo(1),
      events: [
        event("sent_out", minutesAgo(10)),
        event("code_attempted", minutesAgo(4), {
          ok: false,
          attempt: 3,
          locked: true,
        }),
        event("code_reissued", minutesAgo(3), { reissue: 1 }),
        event("code_confirmed", minutesAgo(1), {
          beat_promise: true,
          seconds_to_door: 540,
        }),
      ],
    });
    const got = derive(d, NOW);
    expect(got.locked).toBe(true);
    expect(got.concerns).not.toContain("locked");
  });
});

describe("an unopened link", () => {
  it("is not a concern straight away", () => {
    const d = delivery({
      sentAt: minutesAgo(UNOPENED_AFTER_MINUTES - 1),
      events: [event("sent_out", minutesAgo(UNOPENED_AFTER_MINUTES - 1))],
    });
    expect(derive(d, NOW).concerns).not.toContain("unopened");
  });

  it("becomes one after ten minutes", () => {
    const d = delivery({
      sentAt: minutesAgo(UNOPENED_AFTER_MINUTES),
      events: [event("sent_out", minutesAgo(UNOPENED_AFTER_MINUTES))],
    });
    expect(derive(d, NOW).concerns).toContain("unopened");
  });

  it("is never a concern once the delivery is confirmed", () => {
    const d = delivery({
      sentAt: minutesAgo(40),
      confirmedAt: minutesAgo(5),
      events: [event("sent_out", minutesAgo(40))],
    });
    expect(derive(d, NOW).concerns).not.toContain("unopened");
  });
});

describe("customer-reported problems", () => {
  it("are surfaced without being counted as a concern", () => {
    // Deliberate: reports show on the timeline and the proof screen but do
    // not light the alert dot. Flagged to the founder as a possible change.
    const d = delivery({
      events: [
        event("sent_out", minutesAgo(10)),
        // Opened, so nothing else is in play and the report is on its own.
        event("link_opened", minutesAgo(9)),
        event("problem_reported", minutesAgo(2), {
          reason: "Hasn't arrived",
          note: "Waiting downstairs",
        }),
      ],
    });
    const got = derive(d, NOW);
    expect(got.reportedProblems).toHaveLength(1);
    expect(got.reportedProblems[0].reason).toBe("Hasn't arrived");
    expect(got.concerns).toEqual([]);
  });
});

describe("counters", () => {
  const late = delivery({
    id: "late",
    sentAt: minutesAgo(50),
    dueAt: minutesAgo(20),
    events: [event("sent_out", minutesAgo(50)), event("link_opened", minutesAgo(49))],
  });
  const out = delivery({ id: "out" });
  const onTime = delivery({
    id: "ontime",
    confirmedAt: minutesAgo(30),
    events: [
      event("sent_out", minutesAgo(45)),
      event("code_confirmed", minutesAgo(30), {
        beat_promise: true,
        seconds_to_door: 900,
      }),
    ],
  });
  const missed = delivery({
    id: "missed",
    confirmedAt: minutesAgo(10),
    events: [
      event("sent_out", minutesAgo(60)),
      event("code_confirmed", minutesAgo(10), {
        beat_promise: false,
        seconds_to_door: 3000,
      }),
    ],
  });

  it("counts what is still out, late included", () => {
    expect(countBoard([late, out, onTime, missed], NOW).outNow).toBe(2);
  });

  it("counts late separately", () => {
    expect(countBoard([late, out, onTime, missed], NOW).runningLate).toBe(1);
  });

  it("works out on-time from confirmed deliveries only", () => {
    expect(countBoard([late, out, onTime, missed], NOW).onTimePercent).toBe(50);
  });

  it("shows no percentage before the first delivery of the day lands", () => {
    // 0% before anything has been delivered is a lie that looks like a metric.
    expect(countBoard([out], NOW).onTimePercent).toBeNull();
  });
});

describe("board order", () => {
  it("puts problems first, then the most overdue", () => {
    const fresh = delivery({ id: "fresh" });
    const slightlyLate = delivery({
      id: "slightly",
      sentAt: minutesAgo(35),
      dueAt: minutesAgo(5),
      events: [event("sent_out", minutesAgo(35)), event("link_opened", minutesAgo(34))],
    });
    const veryLate = delivery({
      id: "very",
      sentAt: minutesAgo(90),
      dueAt: minutesAgo(60),
      events: [event("sent_out", minutesAgo(90)), event("link_opened", minutesAgo(89))],
    });

    expect(
      boardOrder([fresh, slightlyLate, veryLate], NOW).map((d) => d.id),
    ).toEqual(["very", "slightly", "fresh"]);
  });
});
