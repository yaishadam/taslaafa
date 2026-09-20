import Link from "next/link";
import { notFound } from "next/navigation";
import { derive } from "@/lib/status";
import { formatClock, formatDuration } from "@/lib/time";
import { requireRole } from "@/server/auth";
import { loadDelivery } from "@/server/deliveries";
import { IconCheck } from "@/ui/icons";
import { Card } from "@/ui/primitives";
import { CodeEntry } from "./CodeEntry";

export const metadata = { title: "Enter the code · Taslaafa" };
export const dynamic = "force-dynamic";

export default async function CodePage({
  params,
}: PageProps<"/drops/[id]/code">) {
  const user = await requireRole("driver");
  const { id } = await params;

  // RLS already limits this to his own drops, so a delivery belonging to
  // another rider comes back null and reads as not found.
  const delivery = await loadDelivery(id);
  if (!delivery) notFound();

  const d = derive(delivery);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-hairline bg-ground/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-3">
          <Link
            href="/drops"
            className="-ml-2 flex h-11 items-center rounded-field px-2 text-[15px] font-bold text-ink-2 hover:bg-muted"
          >
            Back
          </Link>
          <h1 className="flex-1 text-center text-[17px]">
            {d.status === "confirmed" ? "Delivered" : "Enter the code"}
          </h1>
          <span className="h-11 w-14" aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 py-4 pb-24">
        {d.status === "confirmed" ? (
          <div className="space-y-4">
            <Card className="flex items-center gap-3 border-good/25 bg-good-tint p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-good text-white">
                <IconCheck size={22} />
              </span>
              <div>
                <p className="font-extrabold text-good-text">
                  {delivery.customer.name}
                </p>
                <p className="text-sm text-good-text/85">
                  Confirmed at {formatClock(delivery.confirmedAt!)}
                </p>
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-sm text-ink-2">{delivery.customer.address}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">
                    Door to door
                  </p>
                  <p className="tabular mt-0.5 font-extrabold text-ink">
                    {d.secondsToDoor !== null
                      ? formatDuration(d.secondsToDoor)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">
                    Promise
                  </p>
                  <p
                    className={`mt-0.5 font-extrabold ${
                      d.beatPromise ? "text-good-text" : "text-bad-text"
                    }`}
                  >
                    {d.beatPromise ? "Beat it" : "Missed it"}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <CodeEntry
            deliveryId={delivery.id}
            customerName={delivery.customer.name}
            address={delivery.customer.address}
            orderRef={delivery.orderRef}
            startsLocked={d.locked}
          />
        )}
      </div>
    </>
  );
}
