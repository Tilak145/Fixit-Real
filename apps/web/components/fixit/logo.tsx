import Link from "next/link";

export function FixItLogo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <svg width="34" height="30" viewBox="0 0 40 34" aria-hidden="true">
        <path d="M20 1 2 16h6v17h24V16h6z" fill={dark ? "#4D8FE0" : "#1565C0"} />
        <circle cx="20" cy="17" r="10" fill={dark ? "#0D2C54" : "#FFFFFF"} />
        <path
          d="M25.5 11.5a7 7 0 1 0 3 7.5l-4-1a3 3 0 1 1-2-3.5z"
          fill={dark ? "#F59A3D" : "#F57C00"}
        />
      </svg>
      <span>
        <span
          className={`block font-display font-bold text-[22px] leading-none ${dark ? "text-white" : "text-secondary"}`}
        >
          Fix<span className="text-accent">It</span>
        </span>
        <span
          className={`block text-[8px] font-bold tracking-[0.2em] ${dark ? "text-[#4D8FE0]" : "text-primary"}`}
        >
          LOCAL SERVICES
        </span>
      </span>
    </Link>
  );
}
