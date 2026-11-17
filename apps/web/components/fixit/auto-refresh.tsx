"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-reads the page's data every so often, so a number that depends on the
 * time of day (who is available right now) does not go stale while a visitor
 * leaves the tab open. It refreshes the data in place: no flash, and scroll
 * position and anything typed are kept.
 *
 * A hidden tab does not refresh; when the visitor comes back, the page is
 * refreshed at once if it has been longer than the interval.
 */
export function AutoRefresh({ everyMinutes = 30 }: { everyMinutes?: number }) {
  const router = useRouter();
  const last = useRef(Date.now());

  useEffect(() => {
    const interval = everyMinutes * 60_000;
    const refresh = () => {
      last.current = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, interval);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last.current >= interval) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, everyMinutes]);

  return null;
}
