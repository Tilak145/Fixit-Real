/**
 * Where a professional is in their free period.
 *
 * The first 100 professionals get three months free, then they pay the plan
 * they chose. This turns the stored end date into the one sentence the pro
 * needs: how long is left, and what happens next. It is deliberately blunt
 * about the end — a trial that quietly turns into a charge is the complaint
 * this is designed to avoid.
 *
 * This module has no imports, so it can be tested by Node directly.
 */

export interface TrialState {
  /** No free period is tracked (a paying pro, or one who never took a place). */
  kind: "none" | "active" | "ending-soon" | "over";
  daysLeft: number;
  /** The date the free period ends, when there is one. */
  endsAt: Date | null;
}

/** Trials within this many days are "ending soon", so the ask is not a surprise. */
const ENDING_SOON_DAYS = 14;

export function trialState(trialEndsAt: string | null | undefined, now: Date): TrialState {
  if (!trialEndsAt) return { kind: "none", daysLeft: 0, endsAt: null };
  const ends = new Date(trialEndsAt);
  if (Number.isNaN(ends.getTime())) return { kind: "none", daysLeft: 0, endsAt: null };
  const msLeft = ends.getTime() - now.getTime();
  if (msLeft <= 0) return { kind: "over", daysLeft: 0, endsAt: ends };
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  return {
    kind: daysLeft <= ENDING_SOON_DAYS ? "ending-soon" : "active",
    daysLeft,
    endsAt: ends,
  };
}

/** One plain sentence for the dashboard, written for the professional. */
export function trialMessage(state: TrialState, pricePerMonth: number | null): string {
  if (state.kind === "none") return "";
  const price = pricePerMonth != null ? "$" + pricePerMonth + " a month" : "the plan you chose";
  const on = state.endsAt
    ? state.endsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";
  if (state.kind === "over") {
    return "Your free period ended on " + on + ". Start your plan to keep your listing and leads.";
  }
  const left = state.daysLeft === 1 ? "1 day" : state.daysLeft + " days";
  if (state.kind === "ending-soon") {
    return left + " left of your free period (ends " + on + "). After that it is " + price + ".";
  }
  return "You are in your free period — " + left + " left, until " + on + ". After that it is " + price + ".";
}


/**
 * The reminder notice for a free period inside its last two weeks. The Plan
 * page already says how long is left; this is the version that follows a pro
 * to the dashboard they actually open, and names the date and the price.
 */
export function trialReminder(input: {
  businessName: string | null;
  endsAt: string | null | undefined;
  plan: string;
  pricePerMonth: number;
}, now: Date): string | null {
  const state = trialState(input.endsAt, now);
  if (state.kind !== "ending-soon" || !state.endsAt) return null;
  const on = state.endsAt.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York",
  });
  const left = state.daysLeft === 1 ? "1 day" : state.daysLeft + " days";
  const plan = input.plan.charAt(0).toUpperCase() + input.plan.slice(1);
  return "Heads up, " + (input.businessName?.trim() || "there") + ": your Founding Pro free period ends on " + on +
    " (" + left + " left). Nothing is charged automatically. To continue after that date, " + plan + " is $" +
    input.pricePerMonth + " a month, and you can start it from the Plan page. If you do nothing, your listing stays as it is.";
}
