import { countBoard, type Delivery } from "@/lib/status";
import { formatDuration } from "@/lib/time";
import { requireRole } from "@/server/auth";
import { loadOpen, loadToday, sweepLate } from "@/server/deliveries";
import { Card } from "@/ui/primitives";
import { Poll } from "@/ui/Poll";
import { LiveBoard } from "./LiveBoard";

export const metadata = { title: "Live deliveries · Taslaafa" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireRole("owner");
  const [, today, open] = await Promise.all([
    sweepLate(user.shop.id),
    loadToday(user.shop.timezone),
    loadOpen(),
  ]);

  const byId = new Map<string, Delivery>();
  for (const d of [...today, ...open]) byId.set(d.id, d);
  const all = [...byId.values()];

  const now = Date.now();
  const counters = countBoard(all, now);

  return (
    <>
      <Poll seconds={10} />

      <div className="px-8 pt-8">
        <h1 className="text-2xl">Live deliveries</h1>
        <p className="mt-1 text-ink-2">
          Refreshes every ten seconds. Rows needing a person are tinted.
        </p>

        <div className="mt-6 grid grid-cols-4 gap-4">
          <Stat label="Out now" value={String(counters.outNow)} />
          <Stat
            label="On time today"
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
            label="Average to the door"
            value={
              counters.averageSecondsToDoor === null
                ? "—"
                : formatDuration(counters.averageSecondsToDoor)
            }
          />
          <Stat
            label="Needs a look"
            value={String(counters.needsLook)}
            tone={counters.needsLook > 0 ? "bad" : undefined}
          />
        </div>
      </div>

      <div className="mt-6">
        <LiveBoard deliveries={all} now={now} />
      </div>
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
    <Card className="px-5 py-4">
      <p className="text-[11px] font-bold tracking-[0.06em] text-ink-3 uppercase">
        {label}
      </p>
      <p
        className={`tabular mt-1.5 text-3xl leading-none font-extrabold tracking-[-0.04em] ${
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
