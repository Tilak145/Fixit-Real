/**
 * What "available" means on FixIt, in one place.
 *
 * A homeowner deciding who to call is really asking: can someone help me soon?
 * A professional is available when both are true:
 *
 *   * they are accepting work — the switch they flip when they get busy; and
 *   * right now is inside the hours they published for today.
 *
 * Two honest cases sit outside that. A professional who publishes no hours is
 * not claimed either way: we cannot say they are free, and we must not say they
 * are unavailable, so their card says so plainly and they sort below the pros
 * we can vouch for. A professional who has switched off is not offered at all.
 * Emergency help adds a third condition, because a burst pipe at eleven at
 * night is no use to someone who does not answer at eleven at night: they must
 * also have opted in to after-hours work.
 *
 * Everything here works in one named market timezone rather than the machine's,
 * so a server rendering in one region and a browser in another agree on what
 * "today" means for Akron. The arithmetic is done on wall-clock minutes from
 * the timezone's own calendar; there is no Date subtraction, so no daylight
 * saving edge case and nothing to mock in a test but the current instant.
 */

import { formatMinute, type AvailabilityWindow } from "./fixit-availability.ts";

/** The market FixIt serves. Availability is judged in this timezone. */
export const MARKET_TIMEZONE = "America/New_York";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const WEEKDAY_NAME = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** What a customer may look for. */
export type AvailabilityFilter = "any" | "today" | "tomorrow" | "emergency";

export interface AvailabilityFacts {
  /** The professional's own on/off switch. False means they are not taking work. */
  acceptingWork: boolean;
  /** Whether they take emergency and after-hours calls. */
  acceptsEmergency: boolean;
  /** The published weekly hours; an empty week means no hours published. */
  windows: AvailabilityWindow[];
}

export interface ZonedClock {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Minutes from midnight in the market timezone, 0–1439. */
  minuteOfDay: number;
  /** A whole-day counter, so "tomorrow" is simply one more. */
  dayNumber: number;
}

/** The market's wall clock at a given instant. */
export function zonedClock(now: Date, timeZone: string = MARKET_TIMEZONE): ZonedClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const value: Record<string, string> = {};
  for (const part of parts) value[part.type] = part.value;

  const weekday = WEEKDAY_INDEX[value.weekday] ?? now.getDay();
  // Some engines report midnight as hour "24"; both read as the same minute.
  const hour = Number(value.hour) % 24;
  const minute = Number(value.minute);
  const dayNumber = Math.floor(
    Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)) / 86_400_000,
  );
  return { weekday, minuteOfDay: hour * 60 + minute, dayNumber };
}

export type AvailabilityState = "available" | "open-later" | "unlisted" | "off";

/** The window the professional published for one weekday, if any. */
function windowForDay(facts: AvailabilityFacts, weekday: number): AvailabilityWindow | null {
  return facts.windows.find((window) => window.weekday === weekday) ?? null;
}

/**
 * The professional's availability right now.
 *
 * The switch wins over the hours: a pro inside their hours who has stepped out
 * is not available, and saying otherwise would send a customer to a phone
 * nobody is watching. No hours at all is "unlisted", not "off" — we do not know
 * their day, and the product must not invent one.
 */
export function availabilityState(
  facts: AvailabilityFacts,
  now: Date,
  timeZone: string = MARKET_TIMEZONE,
): AvailabilityState {
  if (!facts.acceptingWork) return "off";
  if (facts.windows.length === 0) return "unlisted";
  const clock = zonedClock(now, timeZone);
  const window = windowForDay(facts, clock.weekday);
  if (!window) return "open-later";
  return clock.minuteOfDay >= window.startMinute && clock.minuteOfDay < window.endMinute
    ? "available"
    : "open-later";
}

export interface NextOpening {
  /** Whole days from today; 0 means later today. */
  daysAhead: number;
  window: AvailabilityWindow;
  /** Minutes from now until the opening, for ordering. */
  minutesAhead: number;
}

/**
 * The next moment the professional works, as whole days ahead plus the window
 * they open in. Walks forward a week, which is enough: a pro with any hours at
 * all is open again within seven days.
 */
export function nextOpening(
  facts: AvailabilityFacts,
  now: Date,
  timeZone: string = MARKET_TIMEZONE,
): NextOpening | null {
  if (!facts.acceptingWork || facts.windows.length === 0) return null;
  const clock = zonedClock(now, timeZone);
  for (let daysAhead = 0; daysAhead < 8; daysAhead += 1) {
    const weekday = (clock.weekday + daysAhead) % 7;
    const window = windowForDay(facts, weekday);
    if (!window) continue;
    // Later today only counts if the opening is still ahead of us.
    if (daysAhead === 0 && window.startMinute <= clock.minuteOfDay) continue;
    const minutesAhead =
      daysAhead * 1440 + window.startMinute - clock.minuteOfDay;
    return { daysAhead, window, minutesAhead };
  }
  return null;
}

/** Whether they can take an emergency right now, which needs the opt-in too. */
export function availableForEmergency(
  facts: AvailabilityFacts,
  now: Date,
  timeZone: string = MARKET_TIMEZONE,
): boolean {
  return facts.acceptsEmergency && availabilityState(facts, now, timeZone) === "available";
}

/** A short label for a card. Never claims more than the facts support. */
export function availabilityLabel(
  facts: AvailabilityFacts,
  now: Date,
  timeZone: string = MARKET_TIMEZONE,
): string {
  switch (availabilityState(facts, now, timeZone)) {
    case "available":
      return "Available now";
    case "open-later": {
      const next = nextOpening(facts, now, timeZone);
      if (!next) return "Hours listed";
      const clock = zonedClock(now, timeZone);
      const dayLabel =
        next.daysAhead === 0
          ? "today"
          : next.daysAhead === 1
            ? "tomorrow"
            : WEEKDAY_NAME[(clock.weekday + next.daysAhead) % 7];
      return "Back " + dayLabel + " at " + formatMinute(next.window.startMinute);
    }
    case "unlisted":
      return "Hours on request";
    default:
      return "Not taking work";
  }
}

/** Whether the professional published hours for the day that many days ahead. */
export function worksInDays(facts: AvailabilityFacts, days: number, now: Date, timeZone = MARKET_TIMEZONE): boolean {
  const clock = zonedClock(now, timeZone);
  return windowForDay(facts, (clock.weekday + days) % 7) !== null;
}

/**
 * Whether the professional meets the customer's chosen filter.
 *
 * "Today" and "tomorrow" are asked of the published week directly rather than
 * of this minute: a homeowner planning an afternoon call wants the pro who
 * opens at one, and a pro open now is a real answer for tomorrow too.
 *
 * A professional with no published hours matches no day filter. We cannot
 * confirm that day for them, and a filter that guesses would be a promise the
 * product cannot keep.
 */
export function matchesAvailabilityFilter(
  facts: AvailabilityFacts,
  filter: AvailabilityFilter,
  now: Date,
  timeZone: string = MARKET_TIMEZONE,
): boolean {
  if (filter === "emergency") return availableForEmergency(facts, now, timeZone);
  const state = availabilityState(facts, now, timeZone);
  if (state === "off") return false;
  if (filter === "any") return true;
  if (state === "unlisted") return false;
  return worksInDays(facts, filter === "today" ? 0 : 1, now, timeZone);
}

/** Where a professional sits for a customer: available first, then soonest. */
export function availabilityRank(
  facts: AvailabilityFacts,
  now: Date,
  timeZone: string = MARKET_TIMEZONE,
): number {
  switch (availabilityState(facts, now, timeZone)) {
    case "available":
      return 0;
    case "open-later":
      // Sooner openings rank above later ones.
      return 1 + (nextOpening(facts, now, timeZone)?.minutesAhead ?? 0) / 1_000_000;
    case "unlisted":
      return 900_000;
    default:
      return 1_000_000;
  }
}

/**
 * Orders professionals for a customer: whoever can help soonest first, then
 * whoever paid for a higher placement, then whoever is better rated. Availability
 * leads because "can someone come today" is the question a homeowner is actually
 * asking, and a five-star pro who is booked solid is not an answer to it.
 *
 * Placement is a tie-break, never a trump card: a paying professional is shown
 * above an equally-available one with a lower plan, but never above someone who
 * is open now. That keeps the paid placement honest — it buys position among
 * peers, not the top of the list over the customer's own answer.
 */
export function compareByAvailability(
  a: { facts: AvailabilityFacts; rating: number; placement?: number },
  b: { facts: AvailabilityFacts; rating: number; placement?: number },
  now: Date,
  timeZone: string = MARKET_TIMEZONE,
): number {
  const byRank = availabilityRank(a.facts, now, timeZone) - availabilityRank(b.facts, now, timeZone);
  if (byRank !== 0) return byRank;
  // A lower placement number means a higher plan. Absent means no plan data was
  // loaded, which must not be treated as the worst placement.
  const byPlacement = (a.placement ?? 100) - (b.placement ?? 100);
  if (byPlacement !== 0) return byPlacement;
  return b.rating - a.rating;
}
