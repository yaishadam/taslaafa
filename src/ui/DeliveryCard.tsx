import Link from "next/link";
import { CONCERN_LABELS, derive, type Delivery } from "@/lib/status";
import { formatClock, formatDuration } from "@/lib/time";
import { IconChevronRight, IconLock, IconWarning } from "@/ui/icons";
import { Pill } from "@/ui/primitives";

/**
 * One delivery in a list.
 *
 * A late one has to be findable without reading: a red left edge, a tinted
 * ground, and the overdue minutes where the elapsed time normally sits.
 */

function StatusPill({ d }: { d: ReturnType<typeof derive> }) {
  if (d.status === "confirmed") {
    return (
      <Pill tone={d.beatPromise === false ? "neutral" : "good"}>
        {d.beatPromise === false ? "Confirmed, late" : "Confirmed"}
      </Pill>
    );
  }
  if (d.status === "late") {
    return <Pill tone="bad">{d.minutesLate} min over</Pill>;
  }
  if (d.status === "taken") return <Pill tone="neutral">Not sent</Pill>;
  return <Pill tone="brand">Out now</Pill>;
}

export function DeliveryCard({
  delivery,
  href,
  now,
}: {
  delivery: Delivery;
  href: string;
  now?: number;
}) {
  const d = derive(delivery, now);
  const late = d.status === "late";

  return (
    <li>
      <Link
        href={href}
        className={`block rounded-card border p-4 shadow-card transition active:scale-[0.995] ${
          late
            ? "border-bad/25 bg-bad-tint/45 hover:bg-bad-tint/60"
            : "border-hairline bg-surface hover:bg-muted"
        }`}
      >
        <div className="flex items-start gap-3">
          {late ? (
            <span
              className="mt-0.5 h-10 w-1 shrink-0 rounded-full bg-bad"
              aria-hidden="true"
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">
                  {delivery.customer.name}
                </p>
                <p className="mt-0.5 truncate text-sm text-ink-2">
                  {delivery.customer.address}
                </p>
              </div>
              <StatusPill d={d} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-ink-3">
              {delivery.orderRef ? (
                <span className="tabular font-semibold text-ink-2">
                  {delivery.orderRef}
                </span>
              ) : null}
              {delivery.driver ? <span>{delivery.driver.name}</span> : null}
              {delivery.sentAt ? (
                <span className="tabular">
                  {d.status === "confirmed" && d.secondsToDoor !== null
                    ? `${formatDuration(d.secondsToDoor)} to the door`
                    : `left ${formatClock(delivery.sentAt)}`}
                </span>
              ) : null}
            </div>

            {d.concerns.length > 0 && d.status !== "confirmed" ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {d.concerns
                  .filter((c) => c !== "late")
                  .map((concern) => (
                    <Pill key={concern} tone="bad">
                      {concern === "locked" ? (
                        <IconLock size={13} />
                      ) : (
                        <IconWarning size={13} />
                      )}
                      {CONCERN_LABELS[concern]}
                    </Pill>
                  ))}
              </div>
            ) : null}
          </div>

          <IconChevronRight
            size={18}
            className="mt-1 shrink-0 self-center text-ink-3"
          />
        </div>
      </Link>
    </li>
  );
}
