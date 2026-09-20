"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatDuration } from "@/lib/time";
import { IconBackspace, IconCheck, IconLock } from "@/ui/icons";
import { Button, Card } from "@/ui/primitives";

/**
 * Four boxes and a keypad built in the page, not the operating system's.
 *
 * The OS keyboard is the wrong tool here: it covers half the screen, it
 * offers letters, and on a phone held in one hand while the other holds a
 * bag, its keys are too small and too high. These are 64px tall and sit in
 * the bottom third where a thumb reaches.
 */

type Outcome =
  | { kind: "confirmed"; secondsToDoor: number; beatPromise: boolean }
  | { kind: "locked" }
  | { kind: "wrong"; attemptsLeft: number }
  | { kind: "error"; message: string };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export function CodeEntry({
  deliveryId,
  customerName,
  address,
  orderRef,
  startsLocked,
}: {
  deliveryId: string;
  customerName: string;
  address: string;
  orderRef: string | null;
  startsLocked: boolean;
}) {
  const router = useRouter();
  const [digits, setDigits] = useState("");

  // Taps are read from a ref, not from state.
  //
  // Two quick presses land in the same task, and both would read the same
  // stale `digits` from the closure -- the second digit is simply lost. On a
  // keypad someone is stabbing at while holding a bag, that is not a corner
  // case. The ref is updated synchronously so each press sees the last one.
  const digitsRef = useRef("");

  function setEntry(value: string) {
    digitsRef.current = value;
    setDigits(value);
  }
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(
    startsLocked ? { kind: "locked" } : null,
  );

  const locked = outcome?.kind === "locked";
  const confirmed = outcome?.kind === "confirmed";

  function press(key: string) {
    if (busy || locked || confirmed) return;

    if (key === "back") {
      setEntry(digitsRef.current.slice(0, -1));
      return;
    }
    if (digitsRef.current.length >= 4) return;

    const next = digitsRef.current + key;
    setEntry(next);
    // Clear a previous miss the moment they start again, so the red is
    // about this attempt and not the last one.
    if (outcome?.kind === "wrong" || outcome?.kind === "error") {
      setOutcome(null);
    }
    if (next.length === 4) void submit(next);
  }

  async function submit(code: string) {
    setBusy(true);

    const response = await fetch(`/api/deliveries/${deliveryId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const result = await response.json().catch(() => ({}));
    setBusy(false);

    switch (result.result) {
      case "confirmed":
        setOutcome({
          kind: "confirmed",
          secondsToDoor: result.seconds_to_door ?? 0,
          beatPromise: result.beat_promise === true,
        });
        // Deliberately no router.refresh() here. The server component would
        // re-render, see confirmed_at set, and replace this whole component
        // with its own "Delivered" summary -- so the rider would never see
        // the moment he just earned. The refresh happens when he taps
        // "Next drop".
        return;
      case "already_confirmed":
        router.replace("/drops");
        return;
      case "locked":
        setOutcome({ kind: "locked" });
        setEntry("");
        router.refresh();
        return;
      case "wrong":
        setOutcome({ kind: "wrong", attemptsLeft: result.attempts_left ?? 0 });
        setEntry("");
        router.refresh();
        return;
      default:
        setOutcome({
          kind: "error",
          message: result.error ?? "That did not go through. Try again.",
        });
        setEntry("");
    }
  }

  if (confirmed && outcome.kind === "confirmed") {
    return (
      <div className="space-y-5">
        <Card className="space-y-3 border-good/25 bg-good-tint p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good text-white">
            <IconCheck size={30} />
          </span>
          <div>
            <h2 className="text-2xl text-good-text">Handed over</h2>
            <p className="mt-1 text-good-text/85">
              {customerName} has the order.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="rounded-chip bg-surface/70 px-3 py-2.5">
              <p className="text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">
                Door to door
              </p>
              <p className="tabular mt-0.5 text-lg font-extrabold text-ink">
                {formatDuration(outcome.secondsToDoor)}
              </p>
            </div>
            <div className="rounded-chip bg-surface/70 px-3 py-2.5">
              <p className="text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">
                Promise
              </p>
              <p
                className={`mt-0.5 text-lg font-extrabold ${
                  outcome.beatPromise ? "text-good-text" : "text-bad-text"
                }`}
              >
                {outcome.beatPromise ? "Beat it" : "Missed it"}
              </p>
            </div>
          </div>
        </Card>

        <Button
          size="lg"
          full
          onClick={() => {
            router.push("/drops");
            router.refresh();
          }}
        >
          Next drop
        </Button>
      </div>
    );
  }

  return (
    // Tall enough to push the keypad into thumb reach with mt-auto, short
    // enough that its bottom row clears the header, the page padding and the
    // tab bar. 14rem is those three added up.
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col gap-5">
      <Card className="p-4">
        <p className="font-bold text-ink">{customerName}</p>
        <p className="mt-0.5 text-sm text-ink-2">{address}</p>
        {orderRef ? (
          <p className="tabular mt-1 text-[13px] text-ink-3">{orderRef}</p>
        ) : null}
      </Card>

      {locked ? (
        <Card className="space-y-2 border-bad/25 bg-bad-tint p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bad text-white">
            <IconLock size={24} />
          </span>
          <p className="font-extrabold text-bad-text">Code locked</p>
          <p className="text-sm text-bad-text/85">
            Three wrong codes. The shop can see this and has to issue a new
            one — call them.
          </p>
        </Card>
      ) : (
        <>
          <div className="text-center">
            <p className="text-[15px] text-ink-2">
              Ask for the code on their phone
            </p>
          </div>

          <div
            className="flex justify-center gap-3"
            role="status"
            aria-live="polite"
            aria-label={`${digits.length} of 4 digits entered`}
          >
            {[0, 1, 2, 3].map((i) => {
              const filled = i < digits.length;
              const missed = outcome?.kind === "wrong";
              return (
                <div
                  key={i}
                  className={`tabular flex h-[68px] w-[62px] items-center justify-center rounded-field border-2 text-3xl font-extrabold transition ${
                    missed
                      ? "border-bad bg-bad-tint text-bad-text"
                      : filled
                        ? "border-ink bg-surface text-ink"
                        : "border-hairline bg-surface text-ink-3"
                  }`}
                >
                  {filled ? digits[i] : ""}
                </div>
              );
            })}
          </div>

          <div className="min-h-[2.5rem] text-center" aria-live="assertive">
            {outcome?.kind === "wrong" ? (
              <p className="font-bold text-bad-text">
                Not that code.{" "}
                {outcome.attemptsLeft === 1
                  ? "One try left."
                  : `${outcome.attemptsLeft} tries left.`}
              </p>
            ) : null}
            {outcome?.kind === "error" ? (
              <p className="font-bold text-bad-text">{outcome.message}</p>
            ) : null}
            {busy ? <p className="text-ink-3">Checking…</p> : null}
          </div>

          <div className="mt-auto grid grid-cols-3 gap-2.5">
            {KEYS.map((key, i) =>
              key === "" ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => press(key)}
                  disabled={busy}
                  aria-label={key === "back" ? "Delete last digit" : key}
                  className={`tabular flex h-16 items-center justify-center rounded-field text-2xl font-extrabold transition active:scale-95 disabled:opacity-40 ${
                    key === "back"
                      ? "text-ink-2 hover:bg-muted"
                      : "border border-hairline bg-surface text-ink shadow-card hover:bg-muted"
                  }`}
                >
                  {key === "back" ? <IconBackspace size={24} /> : key}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
