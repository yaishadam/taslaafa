import Link from "next/link";
import { requireRole } from "@/server/auth";
import { loadDrivers } from "@/server/deliveries";
import { NewDeliveryForm } from "./NewDeliveryForm";

export const metadata = { title: "New delivery · Taslaafa" };
export const dynamic = "force-dynamic";

export default async function NewDeliveryPage() {
  const user = await requireRole("owner", "staff");
  const drivers = await loadDrivers();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-hairline bg-ground/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-3">
          <Link
            href="/today"
            className="-ml-2 flex h-11 items-center rounded-field px-2 text-[15px] font-bold text-ink-2 hover:bg-muted"
          >
            Cancel
          </Link>
          <h1 className="flex-1 text-center text-[17px]">New delivery</h1>
          {/* Balances the cancel link so the title sits centred. */}
          <span className="h-11 w-16" aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 py-4 pb-24">
        <NewDeliveryForm
          drivers={drivers}
          defaultPromiseMinutes={user.shop.defaultPromiseMinutes}
          defaultDriverId={drivers[0]?.id ?? null}
        />
      </div>
    </>
  );
}
