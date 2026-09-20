"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card } from "@/ui/primitives";

/**
 * Shown only to the owner, only when a code is locked and the delivery is
 * still open. Without this the delivery can never be confirmed and the
 * driver is standing at a door with nothing to do.
 */
export function ReissueCode({ deliveryId }: { deliveryId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <Card className="border-good/25 bg-good-tint p-5">
        <p className="font-extrabold text-good-text">New code issued</p>
        <p className="mt-1 text-sm text-good-text/85">
          The customer&rsquo;s link now shows different digits. Nothing needs
          re-sending — tell the rider to ask again.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 border-bad/25 bg-bad-tint p-5">
      <div>
        <p className="font-extrabold text-bad-text">Code locked</p>
        <p className="mt-1 text-sm text-bad-text/85">
          Three wrong tries. This delivery cannot be confirmed until you issue
          a new code. The three failures stay in the log either way.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-bold text-bad-text">
          {error}
        </p>
      ) : null}

      <Button
        full
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const response = await fetch(
            `/api/deliveries/${deliveryId}/reissue`,
            { method: "POST" },
          );
          const result = await response.json().catch(() => ({}));
          setBusy(false);
          if (response.ok) {
            setDone(true);
            router.refresh();
          } else {
            setError(result.error ?? "That did not work. Try again.");
          }
        }}
      >
        {busy ? "Issuing…" : "Issue a new code"}
      </Button>
    </Card>
  );
}
