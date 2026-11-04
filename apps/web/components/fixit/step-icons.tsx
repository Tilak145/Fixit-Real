import type { SVGProps } from "react";

/**
 * Stroke icons for the "How FixIt works" steps, matching the FixIt design
 * language (2px stroke, current color). The design calls for inline stroke SVG
 * icons rather than emoji.
 */
export function StepIcon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    ...props,
  };
  switch (name) {
    case "clipboard":
      return (
        <svg {...common}>
          <path d="M9 4h6v3H9z" />
          <path d="M9 5.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5a2 2 0 0 0-2-2h-2" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
          <path d="M17 14.4a5.5 5.5 0 0 1 3.5 5.6" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
          <path d="m9 15 2 2 4-4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
