import { requireRole } from "@/server/auth";
import { BottomTabs, type Tab } from "@/ui/BottomTabs";

const TABS: Tab[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/proof", label: "Proof log", icon: "proof" },
  { href: "/staff", label: "Staff", icon: "staff" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

/**
 * The shop's phone screens. Owners can reach these too -- an owner standing
 * at the counter is doing the same job as staff -- but their home is the
 * desktop dashboard.
 */
// A route group at the root has the root's path as far as the generated
// types are concerned: (shop) does not appear in any URL.
export default async function ShopLayout({ children }: LayoutProps<"/">) {
  await requireRole("owner", "staff");

  return (
    <div className="min-h-dvh pb-16">
      {children}
      <BottomTabs tabs={TABS} />
    </div>
  );
}
