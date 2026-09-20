import { notFound } from "next/navigation";
import { formatClock } from "@/lib/time";
import { customerView, recordLinkOpened } from "@/server/customerView";
import { IconCheck, IconWarning } from "@/ui/icons";
import { Logo } from "@/ui/Logo";
import { Card, Pill } from "@/ui/primitives";
import { ReportProblem } from "./ReportProblem";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your delivery",
  // This link goes into a chat thread. Nothing about it should be indexed,
  // previewed by a bot, or followed by a link scanner that would burn the
  // one link_opened event before the customer ever taps it.
  robots: { index: false, follow: false, nocache: true },
};

export default async function CustomerPage({ params }: PageProps<"/d/[token]">) {
  const { token } = await params;
  const view = await customerView(token);

  if (!view) notFound();

  await recordLinkOpened(view.deliveryId);

  const confirmed = view.confirmedAt !== null;
  const late = view.markedLateAt !== null && !confirmed;

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-5 py-6 pb-12">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-extrabold tracking-[-0.03em] text-ink">
            {view.shopName}
          </p>
          {view.orderRef ? (
            <p className="tabular text-sm text-ink-2">
              Order {view.orderRef}
            </p>
          ) : null}
        </div>
        <Logo size={26} markOnly label="" />
      </header>

      {confirmed ? (
        <Card className="flex items-center gap-3 border-good/25 bg-good-tint p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-good text-white">
            <IconCheck size={22} />
          </span>
          <div>
            <p className="font-extrabold text-good-text">Handed over</p>
            <p className="text-sm text-good-text/80">
              Confirmed at {formatClock(view.confirmedAt!)}. This delivery is
              done.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* The code. The single reason this page exists. */}
          <Card className="p-6 text-center">
            <p className="text-xs font-bold tracking-[0.08em] text-ink-3 uppercase">
              Your delivery code
            </p>
            <p
              className="tabular mt-3 text-[56px] leading-none font-extrabold tracking-[0.12em] text-ink"
              aria-label={`Your code is ${view.code.split("").join(" ")}`}
            >
              {view.code}
            </p>
            <p className="mt-3 text-sm text-ink-2">
              Give this to the person at your door.
            </p>
          </Card>

          <Card className="border-bad/25 bg-bad-tint p-4">
            <div className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-bad">
                <IconWarning size={20} />
              </span>
              <div className="space-y-1 text-sm">
                <p className="font-extrabold text-bad-text">
                  Never give this code over the phone
                </p>
                <p className="text-bad-text/85">
                  Not to the shop, not to the driver, not to anyone who calls.
                  Only say it once your order is in your hands. The code is
                  how the shop proves you received it — nobody there can see
                  it.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      <Card className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.06em] text-ink-3 uppercase">
              Bringing it
            </p>
            <p className="mt-0.5 font-bold text-ink">
              {view.driverName ?? "Someone from the shop"}
            </p>
          </div>
          {!confirmed && view.dueAt ? (
            <div className="text-right">
              <p className="text-xs font-bold tracking-[0.06em] text-ink-3 uppercase">
                Arriving by
              </p>
              <p className="tabular mt-0.5 font-bold text-ink">
                {formatClock(view.dueAt)}
              </p>
            </div>
          ) : null}
        </div>

        {late ? <Pill tone="bad">Running late</Pill> : null}

        <ol className="space-y-0">
          <Step
            label="Left the shop"
            at={view.sentAt}
            done={view.sentAt !== null}
          />
          <Step
            label="Running late"
            at={view.markedLateAt}
            done={view.markedLateAt !== null}
            tone="bad"
            hideWhenPending
          />
          <Step
            label="Handed over"
            at={view.confirmedAt}
            done={confirmed}
            tone="good"
            last
          />
        </ol>
      </Card>

      {!confirmed ? (
        <ReportProblem token={token} alreadyReported={view.reportedAt !== null} />
      ) : null}

      <p className="pt-2 text-center text-xs text-ink-3">
        Sent with Taslaafa. The shop cannot see your code.
      </p>
    </main>
  );
}

function Step({
  label,
  at,
  done,
  tone = "neutral",
  last = false,
  hideWhenPending = false,
}: {
  label: string;
  at: string | null;
  done: boolean;
  tone?: "neutral" | "good" | "bad";
  last?: boolean;
  hideWhenPending?: boolean;
}) {
  if (!done && hideWhenPending) return null;

  const dot = done
    ? tone === "good"
      ? "bg-good"
      : tone === "bad"
        ? "bg-bad"
        : "bg-ink"
    : "bg-hairline";

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${dot}`} />
        {!last ? <span className="w-px flex-1 bg-hairline" /> : null}
      </div>
      <div className={last ? "pb-0" : "pb-4"}>
        <p
          className={`text-[15px] font-bold ${done ? "text-ink" : "text-ink-3"}`}
        >
          {label}
        </p>
        {at ? (
          <p className="tabular text-[13px] text-ink-2">{formatClock(at)}</p>
        ) : (
          <p className="text-[13px] text-ink-3">Not yet</p>
        )}
      </div>
    </li>
  );
}
