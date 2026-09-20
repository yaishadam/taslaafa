"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDrops,
  IconProof,
  IconSettings,
  IconStaff,
  IconToday,
} from "@/ui/icons";

/**
 * Icons are looked up here by name rather than passed in.
 *
 * A Server Component cannot hand a function to a Client Component, and the
 * layouts that define these tabs are server-rendered -- so the tab describes
 * which icon it wants and this module resolves it.
 */
const ICONS = {
  today: IconToday,
  proof: IconProof,
  staff: IconStaff,
  settings: IconSettings,
  drops: IconDrops,
} as const;

export type IconName = keyof typeof ICONS;

export type Tab = {
  href: string;
  label: string;
  icon: IconName;
  /** Shows a dot on the tab when something there needs attention. */
  alert?: boolean;
};

/**
 * Fixed to the bottom, with padding for the home indicator on phones that
 * have one. No fake status bar above it -- this runs in a real browser and
 * pretending otherwise would just eat 44px of a small screen.
 */
export function BottomTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = ICONS[tab.icon];

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
                  active ? "text-brand-text" : "text-ink-3 hover:text-ink-2"
                }`}
              >
                <span className="relative">
                  <Icon size={22} />
                  {tab.alert ? (
                    <span
                      className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-bad ring-2 ring-surface"
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
