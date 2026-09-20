import { LogoMark } from "@/ui/Logo";
import { SignOutButton } from "@/ui/SignOutButton";

/**
 * The bar at the top of every phone screen.
 *
 * The alert dot is the one piece of state here: it means something on this
 * screen needs a person. It sits on the shop mark rather than on a tab so it
 * is visible the moment the screen loads, before anyone reads a counter.
 */
export function AppHeader({
  title,
  subtitle,
  alert = false,
  alertLabel = "Something needs a look",
}: {
  title: string;
  subtitle?: string | null;
  alert?: boolean;
  alertLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-ground/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3">
        <span className="relative shrink-0">
          <LogoMark size={34} />
          {alert ? (
            <>
              <span
                className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-bad ring-2 ring-ground"
                aria-hidden="true"
              />
              <span className="sr-only">{alertLabel}</span>
            </>
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] leading-tight">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[13px] text-ink-2">{subtitle}</p>
          ) : null}
        </div>

        <SignOutButton />
      </div>
    </header>
  );
}
