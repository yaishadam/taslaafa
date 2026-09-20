import { requireRole } from "@/server/auth";
import { loadToday, sweepLate } from "@/server/deliveries";
import { AppHeader } from "@/ui/AppHeader";
import { Poll } from "@/ui/Poll";
import { DropsBoard } from "./DropsBoard";

export const metadata = { title: "My drops · Taslaafa" };
export const dynamic = "force-dynamic";

export default async function DropsPage() {
  const user = await requireRole("driver");
  await sweepLate(user.shop.id);

  // No driver_id filter here on purpose. The RLS policy on delivery narrows
  // this to his own drops, so a missing filter leaks nothing -- and if it
  // ever did, that would be a policy bug worth finding rather than papering
  // over in a query.
  const deliveries = await loadToday(user.shop.timezone);
  const now = Date.now();

  return (
    <>
      <Poll seconds={10} />
      <AppHeader title={user.fullName} subtitle={user.shop.name} />
      <DropsBoard deliveries={deliveries} now={now} />
    </>
  );
}
