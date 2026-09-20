"use client";

import { useState } from "react";
import type { Delivery } from "@/lib/status";
import { DeliveryCard } from "@/ui/DeliveryCard";
import { Empty, Field } from "@/ui/primitives";

/**
 * A week later someone calls to say it never came. This is the screen the
 * owner opens, and the only thing that matters is finding the right delivery
 * in a few seconds -- by the customer's name, their number, or the order
 * reference on the bill.
 */
export function ProofLog({
  deliveries,
  now,
}: {
  deliveries: Delivery[];
  now: number;
}) {
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? deliveries.filter((d) =>
        [d.customer.name, d.customer.phone, d.customer.address, d.orderRef]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle)),
      )
    : deliveries;

  return (
    <div className="mx-auto max-w-md space-y-4 px-5 pt-4 pb-24">
      <Field
        label="Find a delivery"
        placeholder="Name, number or order reference"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />

      {shown.length === 0 ? (
        <Empty
          title={needle ? "Nothing matches that" : "No deliveries yet"}
          body={
            needle
              ? "Try the order reference from the bill, or the last four digits of their number."
              : undefined
          }
        />
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
  );
}
