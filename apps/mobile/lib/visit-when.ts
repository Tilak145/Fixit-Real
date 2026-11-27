/**
 * How soon a visit is, in words a person reads at a glance: "Today at 3:00 PM",
 * "Tomorrow at 9:00 AM" or "Friday, Nov 27 at 9:00 AM".
 */
export function visitWhen(scheduledFor: string, now: Date = new Date()): string {
  const at = new Date(scheduledFor);
  if (Number.isNaN(at.getTime())) return "";
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const apart = Math.round((day(at) - day(now)) / 86_400_000);
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (apart === 0) return `Today at ${time}`;
  if (apart === 1) return `Tomorrow at ${time}`;
  return `${at.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} at ${time}`;
}