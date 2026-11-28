// The sums behind the overview boxes, kept apart so Node can test them.

export interface Paid {
  /** When the price was accepted. */
  at: string;
  cents: number;
}

export interface MonthTotal {
  key: string;
  label: string;
  cents: number;
}

/** The last `count` months, oldest first, each with what was agreed in it. */
export function monthlySpending(paid: Paid[], now: Date = new Date(), count = 6): MonthTotal[] {
  const months: MonthTotal[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
    months.push({
      key: `${first.getFullYear()}-${first.getMonth()}`,
      label: first.toLocaleDateString("en-US", { month: "short" }),
      cents: 0,
    });
  }
  for (const item of paid) {
    const when = new Date(item.at);
    const month = months.find((entry) => entry.key === `${when.getFullYear()}-${when.getMonth()}`);
    if (month) month.cents += item.cents;
  }
  return months;
}

/** A round top for the chart's axis, in dollars: 100, 200, 400, 1000, 2000, 4000… */
export function axisTop(largestCents: number): number {
  const dollars = largestCents / 100;
  for (let step = 100; ; step *= 10) {
    for (const top of [step, step * 2, step * 4]) {
      if (top >= dollars) return top;
    }
  }
}

/** Percent change from last month, or null when last month had nothing to compare. */
export function changeFromLastMonth(months: MonthTotal[]): number | null {
  const [last, current] = months.slice(-2);
  if (!last || !current || last.cents === 0) return null;
  return Math.round(((current.cents - last.cents) / last.cents) * 100);
}

export interface StatusPart {
  label: string;
  colour: string;
  count: number;
}

/** Open repairs split into groups that never overlap: urgent ones are counted only as urgent. */
export function openParts(repairs: Array<{ status: string; priority: string }>): StatusPart[] {
  const open = repairs.filter((repair) => !["completed", "cancelled"].includes(repair.status));
  const rest = open.filter((repair) => repair.priority !== "urgent");
  const among = (statuses: string[]) => rest.filter((repair) => statuses.includes(repair.status)).length;
  return [
    { label: "Urgent", colour: "#E5484D", count: open.length - rest.length },
    { label: "Waiting for prices", colour: "#8E6FE0", count: among(["submitted", "awaiting_quotes", "awaiting_approval"]) },
    { label: "Booked", colour: "#2F80ED", count: among(["assigned", "scheduled"]) },
    { label: "In progress", colour: "#F59E0B", count: among(["in_progress"]) },
  ];
}

export function completedThisMonth(repairs: Array<{ status: string; updated_at: string }>, now: Date = new Date()): number {
  return repairs.filter((repair) => {
    const when = new Date(repair.updated_at);
    return repair.status === "completed" && when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth();
  }).length;
}

export interface VisitTime {
  scheduled_for: string;
  status: string;
}

/** Booked visits from today on: today's first list, then the later ones, earliest first. */
export function splitVisits<T extends VisitTime>(visits: T[], now: Date = new Date()): { today: T[]; later: T[] } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const booked = visits
    .filter((visit) => visit.status === "scheduled" && new Date(visit.scheduled_for).getTime() >= start)
    .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
  return {
    today: booked.filter((visit) => new Date(visit.scheduled_for).getTime() < end),
    later: booked.filter((visit) => new Date(visit.scheduled_for).getTime() >= end),
  };
}

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  return hour < 12 ? "Good morning!" : hour < 18 ? "Good afternoon!" : "Good evening!";
}
