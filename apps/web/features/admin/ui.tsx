"use client";

import { cn } from "@/lib/utils";

/**
 * A status is the thing an operator scans for, so it gets a colour: good is
 * green, waiting-on-someone is amber, stopped is red, and everything else stays
 * neutral. Colour is never the only signal — the word itself is always shown.
 */
const TONES: Record<string, string> = {
  good: "bg-[#E7F6EC] text-[#1B7F3B] border-[#BFE7CC]",
  warn: "bg-[#FFF3E0] text-[#B35C00] border-[#FFDDB0]",
  bad: "bg-[#FDECEC] text-[#B3261E] border-[#F6C9C6]",
  info: "bg-[#E9F1FB] text-[#1565C0] border-[#C6DBF4]",
  neutral: "bg-muted text-muted-foreground border-border",
};

const GOOD = new Set(["approved", "completed", "scheduled", "active", "published"]);
const WARN = new Set(["pending", "new", "claimed", "in_progress"]);
const BAD = new Set(["rejected", "cancelled", "blocked"]);

function toneFor(value: string): keyof typeof TONES {
  const key = value.toLowerCase().replace(/[\s-]/g, "_");
  if (GOOD.has(key)) return "good";
  if (WARN.has(key)) return "warn";
  if (BAD.has(key)) return "bad";
  return "neutral";
}

/** Split a value into words so a raw `in_progress` reads as "In progress". */
export function humanize(value: string): string {
  const spaced = value.replace(/[_-]/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : spaced;
}

export function StatusPill({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-semibold",
        TONES[toneFor(value)],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {humanize(value)}
    </span>
  );
}
