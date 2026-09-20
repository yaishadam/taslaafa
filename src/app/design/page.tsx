import { Logo, LogoMark } from "@/ui/Logo";

/**
 * TEMPORARY. A sheet showing the design tokens rendered, so the system can be
 * checked before any screen is built on it. Deleted once the shop routes land.
 */

const SURFACES = [
  { name: "ground", hex: "#F6F4F1", note: "the page" },
  { name: "surface", hex: "#FFFFFF", note: "cards" },
  { name: "muted", hex: "#FAF8F6", note: "inset rows" },
  { name: "hairline", hex: "#E8E3DD", note: "1px borders" },
];

const INKS = [
  { name: "ink", hex: "#1A1613", note: "primary" },
  { name: "ink-2", hex: "#6E6660", note: "secondary" },
  { name: "ink-3", hex: "#9B938C", note: "12–13px labels only" },
];

const FAMILIES = [
  { name: "brand", base: "#F05703", tint: "#FDEEE4", text: "#B84503" },
  { name: "good", base: "#14794A", tint: "#E6F3EC", text: "#0F6B41" },
  { name: "bad", base: "#C23E22", tint: "#FBEAE5", text: "#A5321A" },
];

const RADII = [
  { name: "chip", px: 12 },
  { name: "field", px: 14 },
  { name: "card", px: 18 },
  { name: "sheet", px: 22 },
  { name: "full", px: 999 },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({
  hex,
  name,
  note,
  bordered,
}: {
  hex: string;
  name: string;
  note?: string;
  bordered?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div
        className={`h-16 rounded-chip ${bordered ? "border border-hairline" : ""}`}
        style={{ backgroundColor: hex }}
      />
      <div>
        <p className="text-sm font-semibold">{name}</p>
        <p className="tabular text-xs text-ink-3">{hex}</p>
        {note ? <p className="text-xs text-ink-2">{note}</p> : null}
      </div>
    </div>
  );
}

export default function DesignCheck() {
  return (
    <main className="mx-auto max-w-3xl space-y-10 px-5 py-10">
      <header className="space-y-6">
        <Logo size={40} />
        <div>
          <h1 className="text-3xl">Design system check</h1>
          <p className="mt-2 text-ink-2">
            Temporary page. Every token below is live from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
              globals.css
            </code>
            , not hard-coded here, apart from the hex labels.
          </p>
        </div>
      </header>

      <Section title="Logo">
        <div className="flex flex-wrap items-end gap-6 rounded-card border border-hairline bg-surface p-6 shadow-card">
          <LogoMark size={24} />
          <LogoMark size={40} />
          <LogoMark size={64} />
          <Logo size={28} />
        </div>
      </Section>

      <Section title="Surfaces">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SURFACES.map((s) => (
            <Swatch key={s.name} {...s} bordered />
          ))}
        </div>
      </Section>

      <Section title="Text">
        <div className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          {INKS.map((i) => (
            <p key={i.name} className="py-1" style={{ color: i.hex }}>
              <span className="font-semibold">{i.name}</span>{" "}
              <span className="tabular text-xs">{i.hex}</span>{" "}
              <span className="text-xs">— {i.note}</span>
            </p>
          ))}
        </div>
      </Section>

      <Section title="Brand, confirmed, alert">
        <div className="space-y-4">
          {FAMILIES.map((f) => (
            <div key={f.name} className="grid grid-cols-3 gap-4">
              <Swatch hex={f.base} name={f.name} />
              <Swatch hex={f.tint} name={`${f.name}-tint`} bordered />
              <Swatch hex={f.text} name={`${f.name}-text`} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Contrast rule">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-card bg-brand p-5">
            <p className="text-ink font-bold">Ink on orange</p>
            <p className="mt-1 text-sm text-ink">
              Correct. This is the only way text sits on brand orange below
              24px.
            </p>
          </div>
          <div className="rounded-card bg-brand p-5">
            <p className="font-bold text-white">White on orange</p>
            <p className="mt-1 text-sm text-white">
              Wrong. 2.6:1 — fails WCAG AA. Shown here only so the difference
              is visible.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Radii">
        <div className="flex flex-wrap gap-4">
          {RADII.map((r) => (
            <div key={r.name} className="space-y-2 text-center">
              <div
                className="h-20 w-20 border border-hairline bg-surface shadow-card"
                style={{ borderRadius: r.px }}
              />
              <p className="text-xs font-semibold">{r.name}</p>
              <p className="tabular text-xs text-ink-3">{r.px}px</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="space-y-3 rounded-card border border-hairline bg-surface p-6 shadow-card">
          <h1 className="text-4xl">Heading 800, −0.04em</h1>
          <h2 className="text-2xl">Heading 800, −0.04em</h2>
          <p className="text-base font-semibold">Body semibold 600</p>
          <p className="text-base">
            Body regular 400. Numbers line up when tabular:{" "}
            <span className="tabular">1,204 · 18:42 · +960 771 2233</span>
          </p>
          <p className="text-xs text-ink-3">
            Tertiary label, 12px. Labels only, never body copy.
          </p>
        </div>
      </Section>

      <Section title="Touch targets">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="h-11 rounded-field bg-brand px-5 font-bold text-ink"
          >
            44px tall
          </button>
          <button
            type="button"
            className="h-11 rounded-field border border-hairline bg-surface px-5 font-semibold"
          >
            Secondary
          </button>
          <span className="rounded-full bg-good-tint px-3 py-1.5 text-sm font-semibold text-good-text">
            Confirmed
          </span>
          <span className="rounded-full bg-bad-tint px-3 py-1.5 text-sm font-semibold text-bad-text">
            Running late
          </span>
          <span className="rounded-full bg-brand-tint px-3 py-1.5 text-sm font-semibold text-brand-text">
            Out now
          </span>
        </div>
      </Section>
    </main>
  );
}
