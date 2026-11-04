/**
 * FixIt professional availability — when a pro works, and whether they take
 * emergency calls.
 *
 * A pro sets one window per day of the week (or takes the day off). Everything
 * else in the product reads that single shape: the calendar they edit, the
 * "available now" hint on their dashboard, and the after-hours routing that
 * decides whether an emergency lead is offered to them.
 *
 * Times are minutes from midnight, the same representation the database uses,
 * so nothing here has to reason about timezones or parse a clock string. The
 * arithmetic is kept free of imports so it can be tested by Node directly.
 */

export interface AvailabilityWindow {
  /** 0 = Sunday … 6 = Saturday, matching JavaScript's getDay(). */
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface ProviderAvailability {
  acceptsEmergency: boolean;
  /**
   * The professional's own on/off switch. Unlike the weekly hours, changing
   * this takes effect at once, which is what lets a pro step out of the
   * rotation mid-job without rewriting their week.
   */
  acceptingWork: boolean;
  windows: AvailabilityWindow[];
}

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEKDAY_SHORT: readonly string[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The week starts on Monday here, which is how a work schedule is read. */
export const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

/** A default week for a new pro: weekdays, nine to five. */
export function defaultWeek(): AvailabilityWindow[] {
  return [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
  }));
}

/** 540 reads as "9:00 AM". */
export function formatMinute(minute: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(minute)));
  // The very end of the day is midnight, which reads as 12:00 AM; the ordinary
  // % 12 arithmetic would call it noon.
  if (clamped === 1440) return "12:00 AM";
  const hours24 = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  const period = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return hours12 + ":" + String(minutes).padStart(2, "0") + " " + period;
}

/** "09:00" and "17:30" are what a time input speaks. */
export function minuteToTimeValue(minute: number): string {
  // A time input speaks up to 23:59, so the end of the day is shown as 23:59
  // rather than an unrepresentable 24:00.
  const clamped = Math.max(0, Math.min(1439, Math.round(minute)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
}

export function timeValueToMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total >= 0 && total <= 1440 ? total : null;
}

/** The window a pro has set for one weekday, if any. */
export function windowFor(
  windows: AvailabilityWindow[],
  weekday: number,
): AvailabilityWindow | null {
  return windows.find((w) => w.weekday === weekday) ?? null;
}

/**
 * Turn the week into a readable summary: "Mon–Fri 9:00 AM–5:00 PM", plus any
 * day that differs. Consecutive days sharing a window are grouped so a pro
 * reads one line, not seven.
 */
export function describeWeek(windows: AvailabilityWindow[]): string {
  if (windows.length === 0) return "No hours set";
  const byDay = new Map(windows.map((w) => [w.weekday, w]));
  const ordered = WEEK_ORDER.filter((day) => byDay.has(day));
  const groups: Array<{ days: number[]; window: AvailabilityWindow }> = [];
  for (const day of ordered) {
    const window = byDay.get(day)!;
    const last = groups[groups.length - 1];
    const sameWindow =
      last &&
      last.window.startMinute === window.startMinute &&
      last.window.endMinute === window.endMinute &&
      // Only join days that are adjacent in the working week.
      WEEK_ORDER.indexOf(day) === WEEK_ORDER.indexOf(last.days[last.days.length - 1]) + 1;
    if (sameWindow) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], window });
    }
  }
  return groups
    .map(({ days, window }) => {
      const label =
        days.length > 2
          ? WEEKDAY_SHORT[days[0]] + "–" + WEEKDAY_SHORT[days[days.length - 1]]
          : days.map((d) => WEEKDAY_SHORT[d]).join(" & ");
      return label + " " + formatMinute(window.startMinute) + "–" + formatMinute(window.endMinute);
    })
    .join(" · ");
}

/**
 * Whether the pro is inside their hours at a given moment. Sunday is 0 in both
 * the stored week and Date.getDay(), so the lookup needs no conversion.
 */
export function isOpenAt(windows: AvailabilityWindow[], at: Date): boolean {
  const window = windowFor(windows, at.getDay());
  if (!window) return false;
  const minute = at.getHours() * 60 + at.getMinutes();
  return minute >= window.startMinute && minute < window.endMinute;
}

/**
 * The first moment the pro is next open, starting from from. Walks forward a
 * week at most, which is enough because every pro who has any hours at all is
 * open again within seven days.
 */
export function nextOpening(windows: AvailabilityWindow[], from: Date): Date | null {
  if (windows.length === 0) return null;
  const byDay = new Map(windows.map((w) => [w.weekday, w]));
  for (let offset = 0; offset < 8; offset += 1) {
    const day = new Date(from);
    day.setDate(from.getDate() + offset);
    const window = byDay.get(day.getDay());
    if (!window) continue;
    const candidate = new Date(day);
    candidate.setHours(Math.floor(window.startMinute / 60), window.startMinute % 60, 0, 0);
    if (candidate.getTime() > from.getTime()) return candidate;
  }
  return null;
}

/**
 * Validate a window before it is saved. Returns an error message, or null when
 * the window is usable. The database enforces the same rules; this exists so
 * the pro is told what is wrong instead of watching a save fail.
 */
export function validateWindow(startMinute: number, endMinute: number): string | null {
  if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute)) return "Enter a start and end time.";
  if (startMinute < 0 || startMinute > 1439) return "The start time must be within the day.";
  if (endMinute < 1 || endMinute > 1440) return "The end time must be within the day.";
  if (endMinute <= startMinute) return "The end time must be after the start time.";
  return null;
}

/** Build a full seven-day grid, with a window or nothing for each day. */
export function weekGrid(windows: AvailabilityWindow[]): Array<{
  weekday: number;
  label: string;
  short: string;
  window: AvailabilityWindow | null;
}> {
  return WEEK_ORDER.map((weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    short: WEEKDAY_SHORT[weekday],
    window: windowFor(windows, weekday),
  }));
}

