"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDrops, IconProof, IconSettings, IconToday } from "@/ui/icons";
import { Logo } from "@/ui/Logo";

const ICONS = {
  live: IconToday,
  proof: IconProof,
  riders: IconDrops,
  settings: IconSettings,
} as const;

const NAV = [
  { href: "/dashboard", label: "Live deliveries", icon: "live" },
  { href: "/dashboard/proof", label: "Proof log", icon: "proof" },
  { href: "/dashboard/riders", label: "Riders", icon: "riders" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
] as const;

export function Sidebar({
  shopName,
  branch,
  userName,
}: {
  shopName: string;
  branch: string | null;
  userName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-hairline bg-surface">
      <div className="px-5 py-5">
        <Logo size={30} />
      </div>

      <nav className="flex-1 px-3" aria-label="Sections">
        <ul className="space-y-1">
          {NAV.map((item) => {
            // Exact match for the dashboard root, prefix for the rest --
            // otherwise every page marks "Live deliveries" as current.
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = ICONS[item.icon];

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-11 items-center gap-3 rounded-field px-3 text-[15px] font-bold transition ${
                    active
                      ? "bg-brand-tint text-brand-text"
                      : "text-ink-2 hover:bg-muted hover:text-ink"
                  }`}
                >
                  <Icon size={20} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-hairline px-5 py-4">
        <p className="truncate font-bold text-ink">{shopName}</p>
        {branch ? (
          <p className="truncate text-[13px] text-ink-2">{branch}</p>
        ) : null}
        <p className="mt-2 truncate text-[13px] text-ink-3">{userName}</p>
      </div>
    </aside>
  );
}
