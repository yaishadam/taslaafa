import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

/**
 * The small set of shapes every screen is built from.
 *
 * Real <button>, <a href> and <label>-paired inputs throughout. Anything
 * tappable is at least 44px tall, which is why the size scale starts there
 * rather than at something prettier.
 */

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ------------------------------------------------------------------ Button

type ButtonTone = "primary" | "secondary" | "quiet" | "danger";
type ButtonSize = "md" | "lg";

const BUTTON_TONES: Record<ButtonTone, string> = {
  // Ink on orange, never white. Below 24px white fails contrast on this
  // orange, and a primary button is never above 24px.
  primary: "bg-brand text-ink hover:brightness-[0.97] active:brightness-95",
  secondary:
    "bg-surface text-ink border border-hairline hover:bg-muted active:bg-muted",
  quiet: "bg-transparent text-ink-2 hover:bg-muted active:bg-muted",
  danger: "bg-bad-tint text-bad-text hover:brightness-[0.98]",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-6 text-base",
};

type ButtonProps = ComponentProps<"button"> & {
  tone?: ButtonTone;
  size?: ButtonSize;
  full?: boolean;
};

export function Button({
  tone = "primary",
  size = "md",
  full = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-field font-bold",
        "transition disabled:cursor-not-allowed disabled:opacity-45",
        BUTTON_TONES[tone],
        BUTTON_SIZES[size],
        full && "w-full",
        className,
      )}
      {...rest}
    />
  );
}

type LinkButtonProps = ComponentProps<"a"> & {
  tone?: ButtonTone;
  size?: ButtonSize;
  full?: boolean;
};

/** Same shape, but a real link -- so it opens in a new tab, copies, bookmarks. */
export function LinkButton({
  tone = "secondary",
  size = "md",
  full = false,
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <a
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-field font-bold",
        "transition",
        BUTTON_TONES[tone],
        BUTTON_SIZES[size],
        full && "w-full",
        className,
      )}
      {...rest}
    />
  );
}

/** Icon-only. aria-label is required, not optional. */
export function IconButton({
  label,
  tone = "quiet",
  className,
  type = "button",
  ...rest
}: Omit<ComponentProps<"button">, "aria-label"> & {
  label: string;
  tone?: ButtonTone;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(
        "inline-flex h-11 w-11 items-center justify-center rounded-field transition",
        BUTTON_TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}

// -------------------------------------------------------------------- Card

export function Card({
  className,
  as: As = "div",
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <As
      className={cx(
        "rounded-card border border-hairline bg-surface shadow-card",
        className,
      )}
      {...rest}
    />
  );
}

// -------------------------------------------------------------------- Pill

type PillTone = "brand" | "good" | "bad" | "neutral";

const PILL_TONES: Record<PillTone, string> = {
  brand: "bg-brand-tint text-brand-text",
  good: "bg-good-tint text-good-text",
  bad: "bg-bad-tint text-bad-text",
  neutral: "bg-muted text-ink-2 border border-hairline",
};

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold whitespace-nowrap",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------------- Field

type FieldProps = ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string | null;
  /** Sits inside the field, before the value. For the +960 on a phone box. */
  prefix?: string;
};

export function Field({
  label,
  hint,
  error,
  prefix,
  id,
  className,
  ...rest
}: FieldProps) {
  const inputId = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-[13px] font-bold text-ink-2"
      >
        {label}
      </label>

      <div
        className={cx(
          "flex items-center rounded-field border bg-surface transition",
          "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20",
          error ? "border-bad" : "border-hairline",
        )}
      >
        {prefix ? (
          <span className="tabular pl-4 text-ink-3 select-none">{prefix}</span>
        ) : null}
        <input
          id={inputId}
          aria-describedby={cx(hintId, errorId) || undefined}
          aria-invalid={error ? true : undefined}
          className={cx(
            "h-12 w-full bg-transparent px-4 text-base text-ink outline-none",
            "placeholder:text-ink-3",
            prefix && "pl-2",
            className,
          )}
          {...rest}
        />
      </div>

      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-semibold text-bad-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------- Segments

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 rounded-full border border-hairline bg-surface p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cx(
              "h-9 flex-1 rounded-full px-3 text-[13px] font-bold transition",
              active ? "bg-ink text-white" : "text-ink-2 hover:bg-muted",
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={cx("tabular ml-1.5", !active && "text-ink-3")}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------------- Misc

export function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-[0.06em] text-ink-3 uppercase">
      {children}
    </p>
  );
}

export function Empty({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="rounded-card border border-dashed border-hairline px-6 py-12 text-center">
      <p className="font-bold text-ink-2">{title}</p>
      {body ? <p className="mt-1 text-sm text-ink-3">{body}</p> : null}
    </div>
  );
}
