"use client";

import { useEffect } from "react";
import { pointOnScrollbar } from "@/lib/popup-scrollbar";

/**
 * Helpers for popup windows that cover the page.
 *
 * Two things went wrong with them. The page behind kept scrolling underneath, so
 * a long window felt stuck. And clicking the window's own scrollbar counted as
 * clicking the dim background, which closes the window, so the scrollbar could
 * not be dragged at all.
 */

let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

/** Stops the page behind a popup from scrolling while the popup is open. */
export function useBodyScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    if (locks === 0) {
      const body = document.body;
      saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      // Hiding the page's scrollbar would widen the page; keep its width the same.
      const gap = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (gap > 0) body.style.paddingRight = `${gap}px`;
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0 && saved) {
        document.body.style.overflow = saved.overflow;
        document.body.style.paddingRight = saved.paddingRight;
        saved = null;
      }
    };
  }, [active]);
}

/** True when a mouse press on a popup's backdrop was really on its scrollbar. */
export function clickedScrollbar(event: React.MouseEvent<HTMLElement>): boolean {
  const element = event.currentTarget;
  return pointOnScrollbar(event.clientX, element.getBoundingClientRect().left, element.clientWidth);
}
