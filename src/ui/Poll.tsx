"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-runs the server component on an interval.
 *
 * Deliberately not websockets. A shop with a handful of riders does not need
 * a socket held open, and a ten second refresh means nobody has to think
 * about whether the screen is stale -- which is the actual requirement.
 *
 * Pauses while the tab is hidden. A phone in a pocket should not be polling.
 */
export function Poll({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => router.refresh(), seconds * 1000);
    }

    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        // Catch up immediately rather than waiting out the interval.
        router.refresh();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);

  return null;
}
