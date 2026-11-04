import type { SVGProps } from "react";

/**
 * Stroke icons for the ten core FixIt service categories, matching the
 * approved design (2px stroke, current color).
 */
export function ServiceIcon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
  switch (name) {
    case "plumbing":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 5h4a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3h4" />
          <path d="M18 13v4M15 17h6v3h-6z" />
          <path d="M4 3v4" />
        </svg>
      );
    case "electrical":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
        </svg>
      );
    case "hvac":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 4v3m0 10v3M4 12h3m10 0h3" />
        </svg>
      );
    case "garage-doors":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M3 20V9l9-6 9 6v11" />
          <path d="M6 12h12M6 15h12M6 18h12" />
        </svg>
      );
    case "roofing":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M2 13 12 4l10 9" />
          <path d="M5 13v7h14v-7" />
          <path d="M12 8v5" />
        </svg>
      );
    case "appliance-repair":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M5 8h14" />
          <circle cx="12" cy="14" r="3.5" />
        </svg>
      );
    case "handyman":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M14 6a4 4 0 0 1 5-4l-3 3 1 3 3 1 3-3a4 4 0 0 1-5 5L8 21a2 2 0 0 1-3-3z" />
        </svg>
      );
    case "cleaning":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M9 3h6l1 5H8z" />
          <path d="M8 8h8l1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
          <path d="M12 12v4" />
        </svg>
      );
    case "pest-control":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <ellipse cx="12" cy="14" rx="6" ry="7" />
          <circle cx="12" cy="5" r="2.5" />
          <path d="M6 10 3 7m15 3 3-3M6 17l-3 2m15-2 3 2" />
        </svg>
      );
    case "landscaping":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 21V10" />
          <path d="M12 10C12 5 8 3 4 3c0 5 3 8 8 7z" />
          <path d="M12 13c0-4 3-6 8-6 0 5-3 7-8 6z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      );
  }
}

/** The ten launch categories. Fixed product content — the database adds more, never fewer. */
export const CORE_CATEGORIES: { slug: string; name: string }[] = [
  { slug: "plumbing", name: "Plumbing" },
  { slug: "electrical", name: "Electrical" },
  { slug: "hvac", name: "HVAC" },
  { slug: "garage-doors", name: "Garage Doors" },
  { slug: "roofing", name: "Roofing" },
  { slug: "appliance-repair", name: "Appliance Repair" },
  { slug: "handyman", name: "Handyman" },
  { slug: "cleaning", name: "Cleaning" },
  { slug: "pest-control", name: "Pest Control" },
  { slug: "landscaping", name: "Landscaping" },
];
