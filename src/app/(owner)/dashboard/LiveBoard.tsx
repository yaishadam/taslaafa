"use client";

import Link from "next/link";
import { useState } from "react";
import { boardOrder, CONCERN_LABELS, derive, type Delivery } from "@/lib/status";
import { formatClock } from "@/lib/time";
import { IconPlus } from "@/ui/icons";
import { Card, Empty, Pill } from "@/ui/primitives";

/**
 * The live board. One row per delivery, and the rows that need a person are
 * tinted so the owner can glance at a screen across the shop and know
 * whether to get up.
 */
export function LiveBoard({
  deliveries,
  now,
}: {
  deliveries: Delivery[];
  now: number;
}) {
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const matching = needle
    ? deliveries.filter((d) =>
        [d.customer.name, d.customer.address, d.orderRef, d.driver?.name]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(needle)),
      )
    : deliveries;

  const rows = boardOrder(matching, now);

  return (
    <>
      <div className="flex items-center gap-4 border-b border-hairline bg-surface px-8 py-4">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="board-search" className="sr-only">
            Search deliveries
          </label>
          <input
            id="board-search"
            type="search"
            placeholder="Search by customer, address, order or rider"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-field border border-hairline bg-muted px-4 text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <Link
          href="/new"
          className="inline-flex h-11 items-center gap-2 rounded-field bg-brand px-5 font-bold text-ink transition hover:brightness-[0.97]"
        >
          <IconPlus size={20} />
          New delivery
        </Link>
      </div>

      <div className="px-8 py-6">
        {rows.length === 0 ? (
          <Empty
            title={needle ? "Nothing matches that" : "Nothing out right now"}
            body={
              needle
                ? undefined
                : "Every delivery sent today has been confirmed."
            }
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Live deliveries, the ones needing attention first
              </caption>
              <thead>
                <tr className="border-b border-hairline bg-muted">
                  <Th>Customer</Th>
                  <Th>Address</Th>
                  <Th>Rider</Th>
                  <Th>Status</Th>
                  <Th align="right">Elapsed</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((delivery) => {
                  const d = derive(delivery, now);
                  const attention = d.needsLook;

                  return (
                    <tr
                      key={delivery.id}
                      className={`border-b border-hairline last:border-0 ${
                        attention ? "bg-bad-tint/45" : "hover:bg-muted"
                      }`}
                    >
                      <Td>
                        <Link
                          href={`/delivery/${delivery.id}`}
                          className="font-bold text-ink hover:text-brand-text"
                        >
                          {delivery.customer.name}
                        </Link>
                        {delivery.orderRef ? (
                          <span className="tabular block text-[13px] text-ink-3">
                            {delivery.orderRef}
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <span className="text-ink-2">
                          {delivery.customer.address}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-ink-2">
                          {delivery.driver?.name ?? "—"}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          {d.status === "confirmed" ? (
                            <Pill tone={d.beatPromise ? "good" : "neutral"}>
                              {d.beatPromise ? "Confirmed" : "Confirmed, late"}
                            </Pill>
                          ) : d.status === "late" ? (
                            <Pill tone="bad">{d.minutesLate} min over</Pill>
                          ) : (
                            <Pill tone="brand">Out now</Pill>
                          )}
                          {d.concerns
                            .filter((c) => c !== "late")
                            .map((c) => (
                              <Pill key={c} tone="bad">
                                {CONCERN_LABELS[c]}
                              </Pill>
                            ))}
                        </div>
                      </Td>
                      <Td align="right">
                        <span className="tabular font-bold text-ink">
                          {d.minutesElapsed} min
                        </span>
                        {delivery.sentAt ? (
                          <span className="tabular block text-[13px] text-ink-3">
                            left {formatClock(delivery.sentAt)}
                          </span>
                        ) : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-3 text-[11px] font-bold tracking-[0.06em] text-ink-3 uppercase ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`px-5 py-4 align-top text-[15px] ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </td>
  );
}
