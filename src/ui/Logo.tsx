/**
 * The mark is a rounded square tile with a corner radius of 27.5% of its
 * width, filled brand orange, holding a white lightning bolt.
 *
 * The radius is expressed as a ratio rather than a fixed number so the tile
 * keeps its shape at every size, from a 20px tab-bar icon to a 96px splash.
 */

const RADIUS_RATIO = 0.275;

type MarkProps = {
  size?: number;
  className?: string;
};

export function LogoMark({ size = 32, className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        width="40"
        height="40"
        rx={40 * RADIUS_RATIO}
        fill="var(--color-brand)"
      />
      <path
        d="M22.5 8 L13 22 h5.5 L17.5 32 L27 18 h-5.5 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

type LogoProps = MarkProps & {
  /** Hide the word and show the tile alone (tab bars, favicons, tight headers). */
  markOnly?: boolean;
  /** Accessible name. Set to "" only when a nearby heading already says it. */
  label?: string;
};

export function Logo({
  size = 32,
  markOnly = false,
  label = "Taslaafa",
  className,
}: LogoProps) {
  if (markOnly) {
    return (
      <span className={className} role="img" aria-label={label || undefined}>
        <LogoMark size={size} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 ${className ?? ""}`}
      role="img"
      aria-label={label || undefined}
    >
      <LogoMark size={size} />
      <span
        aria-hidden="true"
        className="font-extrabold tracking-[-0.035em] text-ink lowercase"
        style={{ fontSize: size * 0.72 }}
      >
        taslaafa
      </span>
    </span>
  );
}
