import { parseDescription } from "@/lib/job-questions";

/**
 * A request's description shown the way it was meant to be read: the details the
 * customer chose as a short list, then anything they typed. An older request with
 * only plain text is shown as it is.
 */
export function JobDetails({
  description,
  className = "",
  compact = false,
}: {
  description: string | null | undefined;
  className?: string;
  /** Smaller type, for a row in a list. */
  compact?: boolean;
}) {
  const { details, notes } = parseDescription(description);
  const text = compact ? "text-[12.5px]" : "text-sm";
  if (details.length === 0) {
    return <span className={`block whitespace-pre-line ${text} ${className}`}>{notes}</span>;
  }
  return (
    <span className={`block ${text} ${className}`} data-testid="job-details">
      <span className="grid gap-0.5">
        {details.map((detail) => (
          <span key={detail.label} className="block">
            <strong className="font-semibold text-foreground">{detail.label}:</strong> {detail.value}
          </span>
        ))}
      </span>
      {notes ? <span className="mt-1.5 block whitespace-pre-line">{notes}</span> : null}
    </span>
  );
}
