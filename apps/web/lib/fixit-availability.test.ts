import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultWeek,
  describeWeek,
  formatMinute,
  isOpenAt,
  minuteToTimeValue,
  nextOpening,
  timeValueToMinute,
  validateWindow,
  weekGrid,
  type AvailabilityWindow,
} from "./fixit-availability.ts";

const week: AvailabilityWindow[] = [
  { weekday: 1, startMinute: 9 * 60, endMinute: 17 * 60 },
  { weekday: 2, startMinute: 9 * 60, endMinute: 17 * 60 },
  { weekday: 3, startMinute: 9 * 60, endMinute: 17 * 60 },
  { weekday: 4, startMinute: 9 * 60, endMinute: 17 * 60 },
  { weekday: 5, startMinute: 9 * 60, endMinute: 17 * 60 },
  { weekday: 6, startMinute: 10 * 60, endMinute: 14 * 60 },
];

test("a new pro starts with weekday nine-to-five", () => {
  const days = defaultWeek();
  assert.deepEqual(days.map((d) => d.weekday), [1, 2, 3, 4, 5]);
  assert.ok(days.every((d) => d.startMinute === 540 && d.endMinute === 1020));
});

test("minutes read as clock times, in both directions", () => {
  assert.equal(formatMinute(0), "12:00 AM");
  assert.equal(formatMinute(540), "9:00 AM");
  assert.equal(formatMinute(720), "12:00 PM");
  assert.equal(formatMinute(750), "12:30 PM");
  assert.equal(formatMinute(1439), "11:59 PM");
  assert.equal(formatMinute(1440), "12:00 AM");
  assert.equal(minuteToTimeValue(540), "09:00");
  assert.equal(minuteToTimeValue(1020), "17:00");
  assert.equal(timeValueToMinute("17:30"), 1050);
  assert.equal(timeValueToMinute("9:05"), 545);
  assert.equal(timeValueToMinute("nonsense"), null);
  assert.equal(timeValueToMinute("25:00"), null);
});

test("the week is summarised in as few lines as it can be", () => {
  assert.equal(describeWeek(week), "Mon–Fri 9:00 AM–5:00 PM · Sat 10:00 AM–2:00 PM");
  assert.equal(describeWeek([]), "No hours set");
  assert.equal(
    describeWeek([{ weekday: 1, startMinute: 540, endMinute: 1020 }]),
    "Mon 9:00 AM–5:00 PM",
  );
});

test("open windows are judged against the day and the clock", () => {
  // 2026-10-19 is a Monday; 2026-10-18 is a Sunday.
  const mondayMidday = new Date(2026, 9, 19, 12, 0);
  const mondayEarly = new Date(2026, 9, 19, 7, 0);
  const sundayMidday = new Date(2026, 9, 18, 12, 0);
  assert.equal(isOpenAt(week, mondayMidday), true);
  assert.equal(isOpenAt(week, mondayEarly), false);
  // Sunday has no window at all, so it is closed however early it is checked.
  assert.equal(isOpenAt(week, sundayMidday), false);
});

test("the end of a window is not inside it", () => {
  // 5:00 PM exactly is the first moment off the clock, not the last on it.
  assert.equal(isOpenAt(week, new Date(2026, 9, 19, 17, 0)), false);
  assert.equal(isOpenAt(week, new Date(2026, 9, 19, 16, 59)), true);
});

test("the next opening walks forward to the right day and time", () => {
  // Friday evening: the next opening is Saturday morning.
  const fridayEvening = new Date(2026, 9, 23, 18, 0);
  const saturday = nextOpening(week, fridayEvening)!;
  assert.equal(saturday.getDay(), 6);
  assert.equal(saturday.getHours(), 10);
  assert.equal(saturday.getMinutes(), 0);

  // Sunday afternoon: the week rolls around to Monday morning.
  const sunday = nextOpening(week, new Date(2026, 9, 18, 15, 0))!;
  assert.equal(sunday.getDay(), 1);
  assert.equal(sunday.getHours(), 9);
});

test("a pro with no hours has no next opening", () => {
  assert.equal(nextOpening([], new Date(2026, 9, 19, 9, 0)), null);
});

test("a window is validated before it is saved", () => {
  assert.equal(validateWindow(540, 1020), null);
  assert.match(validateWindow(1020, 540) ?? "", /after the start/);
  assert.match(validateWindow(540, 540) ?? "", /after the start/);
  assert.match(validateWindow(-1, 540) ?? "", /start time/);
  assert.match(validateWindow(540, 1441) ?? "", /end time/);
  assert.match(validateWindow(Number.NaN, 540) ?? "", /start and end/);
});

test("the grid has all seven days, in working-week order", () => {
  const grid = weekGrid(week);
  assert.deepEqual(grid.map((g) => g.weekday), [1, 2, 3, 4, 5, 6, 0]);
  assert.equal(grid[0].label, "Monday");
  assert.ok(grid[5].window);
  assert.equal(grid[6].window, null);
});

