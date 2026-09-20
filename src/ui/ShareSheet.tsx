"use client";

import { useState } from "react";
import { viberLink, whatsappLink } from "@/lib/share";
import { IconCheck, IconCopy, IconShare } from "@/ui/icons";
import { Button, LinkButton } from "@/ui/primitives";

/**
 * Sharing is a deep link opened from the staff member's own phone, with the
 * message already written. No SMS gateway, no WhatsApp Business API -- the
 * order arrived in a Viber or WhatsApp thread, and the link goes back into
 * the same thread.
 *
 * `navigator.share` is tried first because it puts the real thread list in
 * front of them. Where it does not exist, or the browser refuses it because
 * too long has passed since the tap, the explicit buttons are always there.
 */

export async function tryNativeShare(message: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    await navigator.share({ text: message });
    return true;
  } catch {
    // Either the person dismissed the sheet or the browser refused it.
    // Neither is an error worth showing; the buttons below still work.
    return false;
  }
}

export function ShareSheet({
  message,
  url,
  phone,
  onDone,
  doneLabel = "Done",
}: {
  message: string;
  url: string;
  phone?: string | null;
  onDone?: () => void;
  doneLabel?: string;
}) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  async function copy(what: "link" | "message") {
    try {
      await navigator.clipboard.writeText(what === "link" ? url : message);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="space-y-3">
      <Button size="lg" full onClick={() => tryNativeShare(message)}>
        <IconShare size={20} />
        Share the link
      </Button>

      <div className="grid grid-cols-2 gap-2.5">
        <LinkButton href={viberLink(message)} tone="secondary">
          Viber
        </LinkButton>
        <LinkButton
          href={whatsappLink(message, phone)}
          tone="secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </LinkButton>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button tone="quiet" onClick={() => copy("link")}>
          {copied === "link" ? <IconCheck size={18} /> : <IconCopy size={18} />}
          {copied === "link" ? "Copied" : "Copy link"}
        </Button>
        <Button tone="quiet" onClick={() => copy("message")}>
          {copied === "message" ? (
            <IconCheck size={18} />
          ) : (
            <IconCopy size={18} />
          )}
          {copied === "message" ? "Copied" : "Copy message"}
        </Button>
      </div>

      <div className="rounded-chip border border-hairline bg-muted p-3">
        <p className="text-xs font-bold tracking-[0.06em] text-ink-3 uppercase">
          The message
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-line text-ink-2">
          {message}
        </p>
      </div>

      {onDone ? (
        <Button tone="secondary" size="lg" full onClick={onDone}>
          {doneLabel}
        </Button>
      ) : null}
    </div>
  );
}
