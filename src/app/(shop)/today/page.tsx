import { countBoard, type Delivery } from "@/lib/status";
import { requireRole } from "@/server/auth";
import { loadOpen, loadToday, sweepLate } from "@/server/deliveries";
import { AppHeader } from "@/ui/AppHeader";
import { Poll } from "@/ui/Poll";
import { TodayBoard } from "./TodayBoard";

export const metadata = { title: "Today · Taslaafa" };

// Never cached. This screen's whole job is to be current.
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireRole("owner", "staff");

  // Flag anything that went past its promise since the last look. Idempotent,
  // so calling it on every load is free.
  await sweepLate(user.shop.id);

  const [today, open] = await Promise.all([
    loadToday(user.shop.timezone),
    loadOpen(),
  ]);

  // Something sent at 23:50 and still out at 00:10 belongs on this screen
  // even though it is no longer "today". Merge, keeping one of each.
  const byId = new Map<string, Delivery>();
  for (const d of [...today, ...open]) byId.set(d.id, d);
  const all = [...byId.values()];

  const now = Date.now();
  const counters = countBoard(all, now);

  return (
    <>
      <Poll seconds={10} />
      <AppHeader
        title={user.shop.name}
        subtitle={user.shop.branch}
        alert={counters.needsLook > 0}
        alertLabel={`${counters.needsLook} deliveries need a look`}
      />
      <TodayBoard
        deliveries={all}
        counters={counters}
        todayIds={today.map((d) => d.id)}
        now={now}
      />
    </>
  );
}
