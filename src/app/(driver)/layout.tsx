import { requireRole } from "@/server/auth";
import { BottomTabs, type Tab } from "@/ui/BottomTabs";

const TABS: Tab[] = [
  { href: "/drops", label: "My drops", icon: "drops" },
  { href: "/driver-settings", label: "Settings", icon: "settings" },
];

export default async function DriverLayout({ children }: LayoutProps<"/">) {
  await requireRole("driver");

  return (
    <div className="min-h-dvh pb-16">
      {children}
      <BottomTabs tabs={TABS} />
    </div>
  );
}
