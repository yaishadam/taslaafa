"use client";

import { useState } from "react";
import { IconCheck, IconCopy, IconShare } from "@/ui/icons";
import { Button } from "@/ui/primitives";
import { tryNativeShare } from "@/ui/ShareSheet";

export function ProofActions({
  message,
  url,
}: {
  message: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Button onClick={() => tryNativeShare(message)}>
        <IconShare size={18} />
        Share proof
      </Button>
      <Button
        tone="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
