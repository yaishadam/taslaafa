import { requireRole } from "@/server/auth";
import { Card, Empty } from "@/ui/primitives";

export const metadata = { title: "Settings · Taslaafa" };
export const dynamic = "force-dynamic";

export default async function OwnerSettingsPage() {
  const user = await requireRole("owner");

  return (
    <div className="max-w-3xl px-8 py-8">
      <h1 className="text-2xl">Settings</h1>

      <Card className="mt-6 space-y-3 p-5">
        <Row label="Shop" value={user.shop.name} />
        <Row label="Branch" value={user.shop.branch ?? "—"} />
        <Row label="Timezone" value={user.shop.timezone} />
        <Row
          label="Default promise"
          value={`${user.shop.defaultPromiseMinutes} minutes`}
        />
      </Card>

      <div className="mt-4">
        <Empty
          title="Nothing is editable here yet"
          body="These are set in the database while the product is being shaped."
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[13px] font-bold text-ink-3">{label}</span>
      <span className="font-bold text-ink">{value}</span>
    </div>
  );
}
