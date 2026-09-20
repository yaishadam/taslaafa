import { requireRole } from "@/server/auth";
import { AppHeader } from "@/ui/AppHeader";
import { Card, Empty } from "@/ui/primitives";

export const metadata = { title: "Settings · Taslaafa" };

export default async function DriverSettingsPage() {
  const user = await requireRole("driver");

  return (
    <>
      <AppHeader title="Settings" />
      <div className="mx-auto max-w-md space-y-4 px-5 py-6">
        <Card className="p-5">
          <p className="text-xs font-bold tracking-[0.06em] text-ink-3 uppercase">
            Signed in as
          </p>
          <p className="mt-1 font-bold text-ink">{user.fullName}</p>
          <p className="text-sm text-ink-2">
            {user.shop.name}
            {user.shop.branch ? `, ${user.shop.branch}` : ""}
          </p>
        </Card>
        <Empty
          title="Nothing to change here yet"
          body="Sign out from the button at the top right."
        />
      </div>
    </>
  );
}
