import Link from "next/link";
import { notFound } from "next/navigation";
import { deliveryUrl, proofMessage } from "@/lib/share";
import { CONCERN_LABELS, derive } from "@/lib/status";
import { buildTimeline } from "@/lib/timeline";
import { formatClock, formatDuration, formatStamp } from "@/lib/time";
import { formatPhone } from "@/server/phone";
import { requireRole } from "@/server/auth";
import { loadDelivery } from "@/server/deliveries";
import { IconCheck, IconWarning } from "@/ui/icons";
import { Card, Pill } from "@/ui/primitives";
import { ProofActions } from "./ProofActions";
import { ReissueCode } from "./ReissueCode";

export const metadata = { title: "Delivery · Taslaafa" };
export const dynamic = "force-dynamic";

const DOT: Record<string, string> = {
  neutral: "bg-ink",
  good: "bg-good",
  bad: "bg-bad",
  brand: "bg-brand",
};

export default async function ProofPage({
  params,
}: PageProps<"/delivery/[id]">) {
  const user = await requireRole("owner", "staff");
  const { id } = await params;

  const delivery = await loadDelivery(id);
  if (!delivery) notFound();

  const d = derive(delivery);
  const rows = buildTimeline(delivery.events);
  const confirmed = d.status === "confirmed";

  const shopName = user.shop.branch
    ? `${user.shop.name}, ${user.shop.branch}`
    : user.shop.name;

  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "";
  const url = deliveryUrl(delivery.publicToken, origin);

  const message = proofMessage({
    shopName,
    customerName: delivery.customer.name,
    orderRef: delivery.orderRef,
    lines: rows.map((r) => ({ label: r.label, at: formatStamp(r.at) })),
    doorToDoor:
      d.secondsToDoor !== null ? formatDuration(d.secondsToDoor) : null,
    beatPromise: d.beatPromise,
    url,
  });

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-hairline bg-ground/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-3">
          <Link
            href="/today"
            className="-ml-2 flex h-11 items-center rounded-field px-2 text-[15px] font-bold text-ink-2 hover:bg-muted"
          >
            Back
          </Link>
          <h1 className="flex-1 text-center text-[17px]">
            {delivery.orderRef ?? "Delivery"}
          </h1>
          <span className="h-11 w-14" aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-5 py-4 pb-24">
        {confirmed ? (
          <Card className="flex items-center gap-3 border-good/25 bg-good-tint p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-good text-white">
              <IconCheck size={24} />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold text-good-text">
                Confirmed at the door
              </p>
              <p className="text-sm text-good-text/85">
                {delivery.customer.name} entered the code at{" "}
                {formatClock(delivery.confirmedAt!)}.
              </p>
            </div>
          </Card>
        ) : (
          <Card
            className={`p-5 ${d.needsLook ? "border-bad/25 bg-bad-tint" : ""}`}
          >
            <div className="flex items-center gap-3">
              {d.needsLook ? (
                <span className="shrink-0 text-bad">
                  <IconWarning size={22} />
                </span>
              ) : null}
              <div>
                <p
                  className={`font-extrabold ${d.needsLook ? "text-bad-text" : "text-ink"}`}
                >
                  {d.status === "late"
                    ? `${d.minutesLate} minutes past the promise`
                    : "Out for delivery"}
                </p>
                <p
                  className={`text-sm ${d.needsLook ? "text-bad-text/85" : "text-ink-2"}`}
                >
                  {d.wrongAttempts === 0
                    ? "Not confirmed yet. No code has been entered."
                    : `Not confirmed yet. ${d.wrongAttempts} wrong ${
                        d.wrongAttempts === 1 ? "code" : "codes"
                      } entered at the door.`}
                </p>
              </div>
            </div>
            {d.concerns.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {d.concerns.map((c) => (
                  <Pill key={c} tone="bad">
                    {CONCERN_LABELS[c]}
                  </Pill>
                ))}
              </div>
            ) : null}
          </Card>
        )}

        {confirmed ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Card className="px-4 py-3">
              <p className="text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">
                Door to door
              </p>
              <p className="tabular mt-0.5 text-xl font-extrabold text-ink">
                {d.secondsToDoor !== null
                  ? formatDuration(d.secondsToDoor)
                  : "—"}
              </p>
            </Card>
            <Card className="px-4 py-3">
              <p className="text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">
                Promised {delivery.promiseMinutes} min
              </p>
              <p
                className={`mt-0.5 text-xl font-extrabold ${
                  d.beatPromise ? "text-good-text" : "text-bad-text"
                }`}
              >
                {d.beatPromise ? "Beat it" : "Missed it"}
              </p>
            </Card>
          </div>
        ) : null}

        {d.locked && !confirmed && user.role === "owner" ? (
          <ReissueCode deliveryId={delivery.id} />
        ) : null}

        {d.locked && !confirmed && user.role !== "owner" ? (
          <Card className="border-bad/25 bg-bad-tint p-5">
            <p className="font-extrabold text-bad-text">Code locked</p>
            <p className="mt-1 text-sm text-bad-text/85">
              Three wrong tries. Only the owner can issue a new code.
            </p>
          </Card>
        ) : null}

        <Card className="p-5">
          <h2 className="text-xs font-bold tracking-[0.06em] text-ink-3 uppercase">
            What happened
          </h2>
          <ol className="mt-4">
            {rows.map((r, i) => (
              <li key={r.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[r.tone]}`}
                  />
                  {i < rows.length - 1 ? (
                    <span className="w-px flex-1 bg-hairline" />
                  ) : null}
                </div>
                <div className={i < rows.length - 1 ? "pb-5" : ""}>
                  <p
                    className={`text-[15px] font-bold ${
                      r.tone === "bad"
                        ? "text-bad-text"
                        : r.tone === "good"
                          ? "text-good-text"
                          : "text-ink"
                    }`}
                  >
                    {r.label}
                  </p>
                  <p className="tabular text-[13px] text-ink-2">
                    {formatStamp(r.at)}
                  </p>
                  {r.detail ? (
                    <p className="mt-0.5 text-[13px] text-ink-3">{r.detail}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-hairline pt-3 text-xs text-ink-3">
            This log cannot be edited or deleted, by anyone at the shop or by
            us. Every line is a row written when it happened.
          </p>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-xs font-bold tracking-[0.06em] text-ink-3 uppercase">
            Customer
          </h2>
          <div>
            <p className="font-bold text-ink">{delivery.customer.name}</p>
            <p className="text-sm text-ink-2">{delivery.customer.address}</p>
            <a
              href={`tel:${delivery.customer.phone}`}
              className="tabular mt-1 inline-flex min-h-11 items-center text-[15px] font-bold text-brand-text"
            >
              {formatPhone(delivery.customer.phone)}
            </a>
          </div>
          {delivery.driver ? (
            <div className="border-t border-hairline pt-3">
              <p className="text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">
                Taken by
              </p>
              <p className="font-bold text-ink">{delivery.driver.name}</p>
            </div>
          ) : null}
        </Card>

        <ProofActions message={message} url={url} />
      </div>
    </>
  );
}
