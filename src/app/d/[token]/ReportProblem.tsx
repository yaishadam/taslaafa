"use client";

import { useState } from "react";
import { Button } from "@/ui/primitives";

/**
 * Preset reasons plus an optional note, so the shop can count them later.
 * A free-text box alone produces messages nobody sorts and nobody reads.
 */
const REASONS = [
  "Hasn't arrived",
  "Wrong items",
  "Wrong address",
  "Driver asked for the code over the phone",
] as const;

export function ReportProblem({
  token,
  alreadyReported,
}: {
  token: string;
  alreadyReported: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(alreadyReported);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (sent) {
    return (
      <div className="rounded-card border border-hairline bg-muted p-4 text-center">
        <p className="font-bold text-ink">The shop has been told</p>
        <p className="mt-1 text-sm text-ink-2">
          They can see your message alongside this delivery.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <Button tone="secondary" size="lg" full onClick={() => setOpen(true)}>
        Report a problem
      </Button>
    );
  }

  async function send() {
    if (!reason) return;
    setBusy(true);
    setFailed(false);

    const response = await fetch("/api/public/problem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, reason, note: note.trim() || null }),
    });

    if (response.ok) setSent(true);
    else setFailed(true);
    setBusy(false);
  }

  return (
    <div className="space-y-3 rounded-sheet border border-hairline bg-surface p-5 shadow-card">
      <p className="font-bold text-ink">What went wrong?</p>

      <div className="space-y-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={reason === r}
            onClick={() => setReason(r)}
            className={`min-h-11 w-full rounded-field px-4 py-2.5 text-left text-[15px] font-semibold transition ${
              reason === r
                ? "bg-brand-tint text-brand-text ring-2 ring-brand"
                : "border border-hairline bg-surface text-ink hover:bg-muted"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="problem-note"
          className="block text-[13px] font-bold text-ink-2"
        >
          Anything else? Optional.
        </label>
        <textarea
          id="problem-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-field border border-hairline bg-surface p-3 text-base text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {failed ? (
        <p role="alert" className="text-sm font-semibold text-bad-text">
          That did not send. Try once more.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <Button tone="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button onClick={send} disabled={!reason || busy}>
          {busy ? "Sending…" : "Tell the shop"}
        </Button>
      </div>
    </div>
  );
}
