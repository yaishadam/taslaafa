"use client";

import { useState } from "react";
import { boardOrder, derive, type Delivery } from "@/lib/status";
import { DeliveryCard } from "@/ui/DeliveryCard";
import { Card, Empty, Segmented } from "@/ui/primitives";

type Which = "active" | "history";

export function DropsBoard({
  deliveries,
  now,
}: {
  deliveries: Delivery[];
  now: number;
}) {
  const [which, setWhich] = useState<Which>("active");

  const active = deliveries.filter((d) => derive(d, now).status !== "confirmed");
  const history = deliveries.filter(
    (d) => derive(d, now).status === "confirmed",
  );

  const onTime = history.filter((d) => derive(d, now).beatPromise === true);
  const shown = boardOrder(which === "active" ? active : history, now);

  return (
    <div className="mx-auto max-w-md space-y-4 px-5 pt-4 pb-24">
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="To go" value={String(active.length)} />
        <Stat label="Done" value={String(history.length)} />
        <Stat
          label="On time"
          value={
            history.length
              ? `${Math.round((onTime.length / history.length) * 100)}%`
              : "—"
          }
        />
      </div>

      <Segmented<Which>
        label="Which drops"
        value={which}
        onChange={setWhich}
        options={[
          { value: "active", label: "Active", count: active.length },
          { value: "history", label: "History", count: history.length },
        ]}
      />

      {shown.length === 0 ? (
        <Empty
          title={
            which === "active" ? "Nothing to deliver" : "Nothing delivered yet"
          }
          body={
            which === "active"
              ? "The shop will send the next one to your phone."
              : "Confirmed drops show up here."
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {shown.map((delivery) => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              href={`/drops/${delivery.id}/code`}
              now={now}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-3 py-3">
      <p className="text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">
        {label}
      </p>
      <p className="tabular mt-1 text-2xl leading-none font-extrabold tracking-[-0.04em] text-ink">
        {value}
      </p>
    </Card>
  );
}
