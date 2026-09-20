"use client";

import Link from "next/link";
import { useState } from "react";
import {
  boardOrder,
  derive,
  type Counters,
  type Delivery,
} from "@/lib/status";
import { IconPlus } from "@/ui/icons";
import { DeliveryCard } from "@/ui/DeliveryCard";
import { Card, Empty, Segmented } from "@/ui/primitives";

type Filter = "out" | "today" | "problems";

/**
 * `now` is fixed by the server and refreshed by the ten second poll, rather
 * than read from the client clock. Two reasons: the markup matches on
 * hydration, and every row on the screen is measured against the same
 * instant, so two cards can never disagree about what time it is.
 */
export function TodayBoard({
  deliveries,
  counters,
  todayIds,
  now,
}: {
  deliveries: Delivery[];
  counters: Counters;
  todayIds: string[];
  now: number;
}) {
  const [filter, setFilter] = useState<Filter>("out");
  const today = new Set(todayIds);

  const buckets: Record<Filter, Delivery[]> = {
    out: deliveries.filter((d) => {
      const s = derive(d, now).status;
      return s === "out" || s === "late";
    }),
    today: deliveries.filter((d) => today.has(d.id)),
    problems: deliveries.filter((d) => derive(d, now).needsLook),
  };

  const shown = boardOrder(buckets[filter], now);

  const EMPTY: Record<Filter, { title: string; body: string }> = {
    out: {
      title: "Nothing out right now",
      body: "Every delivery sent today has been confirmed.",
    },
    today: {
      title: "No deliveries yet today",
      body: "Tap the plus button to send the first one out.",
    },
    problems: {
      title: "Nothing needs a look",
      body: "No late deliveries, locked codes or unopened links.",
    },
  };

  return (
    <>
      <div className="mx-auto max-w-md space-y-4 px-5 pt-4 pb-24">
        <div className="grid grid-cols-3 gap-2.5">
          <Stat label="Out now" value={String(counters.outNow)} />
          <Stat
            label="On time"
            value={
              counters.onTimePercent === null
                ? "—"
                : `${counters.onTimePercent}%`
            }
            tone={
              counters.onTimePercent !== null && counters.onTimePercent < 80
                ? "bad"
                : "good"
            }
          />
          <Stat
            label="Late"
            value={String(counters.runningLate)}
            tone={counters.runningLate > 0 ? "bad" : undefined}
          />
        </div>

        <Segmented<Filter>
          label="Which deliveries"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "out", label: "Out now", count: buckets.out.length },
            { value: "today", label: "Today", count: buckets.today.length },
            {
              value: "problems",
              label: "Problems",
              count: buckets.problems.length,
            },
          ]}
        />

        {shown.length === 0 ? (
          <Empty {...EMPTY[filter]} />
        ) : (
          <ul className="space-y-2.5">
            {shown.map((delivery) => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                href={`/delivery/${delivery.id}`}
                now={now}
              />
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/new"
        aria-label="New delivery"
        className="fixed right-5 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-ink shadow-[0_6px_20px_-6px_rgba(240,87,3,0.7)] transition active:scale-95"
      >
        <IconPlus size={26} />
      </Link>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <Card className="px-3 py-3">
      <p className="text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">
        {label}
      </p>
      <p
        className={`tabular mt-1 text-2xl leading-none font-extrabold tracking-[-0.04em] ${
          tone === "bad"
            ? "text-bad-text"
            : tone === "good"
              ? "text-good-text"
              : "text-ink"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
