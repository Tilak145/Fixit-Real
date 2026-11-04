/**
 * FixIt job cost estimates — a typical-price guide, not a quote.
 *
 * Homeowners routinely ask "what will this roughly cost?" before they commit,
 * so this gives an honest ballpark for the service they described. It is a
 * transparent rules engine: a category has a typical range, a recognised task
 * (for example a water-heater replacement) narrows it, and an emergency adds a
 * same-day premium. Every figure is a published market range, never invented at
 * request time, and the result is always labelled an estimate so nobody
 * mistakes it for a fixed price. The professional's own quote is what the
 * customer pays.
 *
 * This module has no imports, so its arithmetic can be tested by Node directly.
 */

export type Urgency = "emergency" | "soon" | "flexible";

export interface CostEstimate {
  categorySlug: string;
  categoryName: string;
  /** What the estimate is based on, e.g. "Water heater replacement". */
  basis: string;
  lowCents: number;
  highCents: number;
  /** A one-line, plain-language summary for the customer. */
  summary: string;
  /** True when the job reads as an emergency, which raises the range. */
  emergency: boolean;
  /** The honest caveat that always accompanies a range. */
  note: string;
}

interface Money {
  low: number;
  high: number;
}

/** Dollars, converted to cents once so every figure stays an integer. */
function usd(dollars: number): number {
  return Math.round(dollars * 100);
}

/** The category names, kept here so this module needs no other import. */
const CATEGORY_NAMES: Record<string, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
  "garage-doors": "Garage Doors",
  roofing: "Roofing",
  "appliance-repair": "Appliance Repair",
  handyman: "Handyman",
  cleaning: "Cleaning",
  "pest-control": "Pest Control",
  landscaping: "Landscaping",
};

/**
 * The typical range for a whole category, used when the customer's wording does
 * not point at a specific task.
 */
const CATEGORY_BASE: Record<string, { label: string; range: Money }> = {
  plumbing: { label: "General plumbing repair", range: { low: usd(150), high: usd(500) } },
  electrical: { label: "General electrical work", range: { low: usd(150), high: usd(600) } },
  hvac: { label: "Heating and cooling repair", range: { low: usd(200), high: usd(800) } },
  "garage-doors": { label: "Garage door repair", range: { low: usd(200), high: usd(700) } },
  roofing: { label: "Roof repair", range: { low: usd(300), high: usd(1_200) } },
  "appliance-repair": { label: "Appliance repair", range: { low: usd(150), high: usd(500) } },
  handyman: { label: "Handyman job", range: { low: usd(120), high: usd(400) } },
  cleaning: { label: "Home cleaning", range: { low: usd(120), high: usd(350) } },
  "pest-control": { label: "Pest treatment", range: { low: usd(150), high: usd(500) } },
  landscaping: { label: "Yard and landscaping work", range: { low: usd(120), high: usd(500) } },
};

interface TaskRule {
  label: string;
  keywords: string[];
  range: Money;
}

/**
 * Recognised tasks, each with the words that identify it and the typical range.
 * A more specific match wins, so "water heater" beats a bare "plumbing" read.
 */
const TASK_RULES: Record<string, TaskRule[]> = {
  plumbing: [
    { label: "Water heater replacement", keywords: ["water heater", "hot water heater", "no hot water"], range: { low: usd(1_200), high: usd(2_500) } },
    { label: "Sewer line repair", keywords: ["sewer line", "sewer", "sewage", "main line"], range: { low: usd(2_000), high: usd(6_000) } },
    { label: "Whole-home repipe", keywords: ["repipe", "repiping", "replace pipes", "whole house"], range: { low: usd(3_000), high: usd(8_000) } },
    { label: "Sump pump service", keywords: ["sump pump"], range: { low: usd(500), high: usd(1_500) } },
    { label: "Drain clearing", keywords: ["clog", "clogged", "drain", "backed up", "slow drain", "snake"], range: { low: usd(150), high: usd(500) } },
    { label: "Toilet repair", keywords: ["toilet", "running"], range: { low: usd(150), high: usd(450) } },
    { label: "Faucet or fixture repair", keywords: ["faucet", "tap", "shut-off", "shutoff", "valve"], range: { low: usd(150), high: usd(450) } },
    { label: "Pipe leak repair", keywords: ["leak", "leaking", "burst", "pipe"], range: { low: usd(180), high: usd(700) } },
    { label: "Garbage disposal", keywords: ["disposal"], range: { low: usd(150), high: usd(450) } },
  ],
  electrical: [
    { label: "Electrical panel upgrade", keywords: ["panel", "breaker box", "service upgrade"], range: { low: usd(1_500), high: usd(4_000) } },
    { label: "Whole-home rewiring", keywords: ["rewire", "rewiring", "replace the wiring"], range: { low: usd(3_000), high: usd(10_000) } },
    { label: "EV charger installation", keywords: ["ev charger", "car charger", "level 2"], range: { low: usd(800), high: usd(2_500) } },
    { label: "Ceiling fan installation", keywords: ["ceiling fan"], range: { low: usd(150), high: usd(450) } },
    { label: "Light fixture installation", keywords: ["light fixture", "lighting", "lights", "recessed"], range: { low: usd(150), high: usd(600) } },
    { label: "Outlet or switch repair", keywords: ["outlet", "socket", "switch", "sparking"], range: { low: usd(120), high: usd(350) } },
    { label: "Breaker or short repair", keywords: ["breaker", "short", "fuse", "no power", "tripping"], range: { low: usd(150), high: usd(500) } },
  ],
  hvac: [
    { label: "AC replacement", keywords: ["replace the ac", "new ac", "ac replacement", "replace ac", "air conditioner replacement"], range: { low: usd(4_000), high: usd(8_000) } },
    { label: "Furnace replacement", keywords: ["replace the furnace", "new furnace", "furnace replacement"], range: { low: usd(3_000), high: usd(7_000) } },
    { label: "Heat pump installation", keywords: ["heat pump"], range: { low: usd(4_000), high: usd(9_000) } },
    { label: "Duct cleaning or sealing", keywords: ["duct", "ducts", "vent cleaning"], range: { low: usd(300), high: usd(900) } },
    { label: "Thermostat replacement", keywords: ["thermostat"], range: { low: usd(150), high: usd(500) } },
    { label: "AC repair", keywords: ["ac", "a/c", "air conditioner", "air conditioning", "not cooling", "blowing warm", "blowing hot"], range: { low: usd(200), high: usd(750) } },
    { label: "Furnace or heating repair", keywords: ["furnace", "heater", "heating", "no heat", "not heating"], range: { low: usd(200), high: usd(800) } },
    { label: "HVAC tune-up", keywords: ["tune up", "tune-up", "maintenance"], range: { low: usd(80), high: usd(200) } },
  ],
  "garage-doors": [
    { label: "New garage door installation", keywords: ["new garage door", "install a garage door", "replace the garage door"], range: { low: usd(800), high: usd(2_500) } },
    { label: "Opener replacement", keywords: ["opener", "remote"], range: { low: usd(250), high: usd(700) } },
    { label: "Spring replacement", keywords: ["spring", "springs"], range: { low: usd(200), high: usd(450) } },
    { label: "Track or roller repair", keywords: ["track", "off track", "roller", "stuck", "won't open", "will not open"], range: { low: usd(150), high: usd(400) } },
  ],
  roofing: [
    { label: "Roof replacement", keywords: ["replace the roof", "new roof", "roof replacement", "reroof"], range: { low: usd(6_000), high: usd(15_000) } },
    { label: "Roof leak repair", keywords: ["roof leak", "leaking roof", "ceiling stain"], range: { low: usd(300), high: usd(1_200) } },
    { label: "Shingle repair", keywords: ["shingle", "shingles", "flashing"], range: { low: usd(250), high: usd(900) } },
    { label: "Gutter repair", keywords: ["gutter", "gutters", "downspout"], range: { low: usd(150), high: usd(600) } },
  ],
  "appliance-repair": [
    { label: "Refrigerator repair", keywords: ["fridge", "refrigerator", "freezer", "ice maker"], range: { low: usd(200), high: usd(650) } },
    { label: "Washer or dryer repair", keywords: ["washer", "dryer", "washing machine"], range: { low: usd(150), high: usd(450) } },
    { label: "Dishwasher repair", keywords: ["dishwasher"], range: { low: usd(150), high: usd(450) } },
    { label: "Oven or stove repair", keywords: ["oven", "stove", "range", "cooktop"], range: { low: usd(150), high: usd(500) } },
    { label: "Appliance repair call", keywords: ["appliance", "microwave"], range: { low: usd(120), high: usd(400) } },
  ],
  handyman: [
    { label: "TV mounting", keywords: ["tv mount", "mount a tv", "television"], range: { low: usd(120), high: usd(350) } },
    { label: "Furniture assembly", keywords: ["assemble", "assembly", "put together"], range: { low: usd(80), high: usd(250) } },
    { label: "Drywall patch", keywords: ["drywall", "patch", "hole in the wall"], range: { low: usd(150), high: usd(500) } },
    { label: "Door or lock repair", keywords: ["door", "lock", "hinge", "stuck door", "squeaky"], range: { low: usd(100), high: usd(350) } },
    { label: "Shelf or picture hanging", keywords: ["shelf", "shelves", "hang", "mount", "curtain"], range: { low: usd(80), high: usd(250) } },
    { label: "Caulking or weatherproofing", keywords: ["caulk", "caulking", "weatherstrip", "seal"], range: { low: usd(100), high: usd(300) } },
  ],
  cleaning: [
    { label: "Move-out cleaning", keywords: ["move out", "move-out", "moving out"], range: { low: usd(250), high: usd(600) } },
    { label: "Deep cleaning", keywords: ["deep clean", "deep cleaning", "spring clean"], range: { low: usd(200), high: usd(500) } },
    { label: "Carpet or upholstery cleaning", keywords: ["carpet", "upholstery", "rug", "sofa"], range: { low: usd(150), high: usd(450) } },
    { label: "Window or pressure washing", keywords: ["window", "pressure wash", "power wash"], range: { low: usd(150), high: usd(450) } },
    { label: "Standard home cleaning", keywords: ["clean", "cleaning", "maid", "housekeeping"], range: { low: usd(120), high: usd(300) } },
  ],
  "pest-control": [
    { label: "Termite treatment", keywords: ["termite", "termites"], range: { low: usd(700), high: usd(2_500) } },
    { label: "Bed bug treatment", keywords: ["bed bug", "bed bugs"], range: { low: usd(500), high: usd(2_000) } },
    { label: "Rodent removal", keywords: ["mice", "mouse", "rats", "rat", "rodent"], range: { low: usd(200), high: usd(700) } },
    { label: "Wasp or bee removal", keywords: ["wasp", "wasps", "bee", "bees", "hornet"], range: { low: usd(150), high: usd(500) } },
    { label: "General pest treatment", keywords: ["pest", "bugs", "ants", "roach", "roaches", "cockroach", "spider", "insect"], range: { low: usd(150), high: usd(400) } },
  ],
  landscaping: [
    { label: "Fence installation", keywords: ["fence", "fencing"], range: { low: usd(1_500), high: usd(5_000) } },
    { label: "Tree trimming or removal", keywords: ["tree", "trees", "trim", "stump"], range: { low: usd(200), high: usd(1_500) } },
    { label: "Yard cleanup", keywords: ["cleanup", "clean up", "leaves", "yard waste", "debris"], range: { low: usd(150), high: usd(500) } },
    { label: "Sod or mulching", keywords: ["sod", "mulch", "soil", "seed"], range: { low: usd(300), high: usd(1_200) } },
    { label: "Lawn mowing", keywords: ["mow", "mowing", "lawn", "grass"], range: { low: usd(40), high: usd(120) } },
  ],
};

/** A same-day emergency tends to add a premium over the standard range. */
const EMERGENCY_MULTIPLIER = 1.25;

const NOTE =
  "This is a typical range for a job like this, not a quote. Your final price depends on the pro's inspection, and on parts and any surprises found on site.";

function score(text: string, words: string[]): number {
  let total = 0;
  for (const w of words) {
    if (text.includes(w)) total += w.includes(" ") ? 2 : 1;
  }
  return total;
}

function bestRule(text: string, slug: string): TaskRule | null {
  let winner: TaskRule | null = null;
  let winnerScore = 0;
  for (const rule of TASK_RULES[slug] ?? []) {
    const s = score(text, rule.keywords);
    if (s > winnerScore) {
      winnerScore = s;
      winner = rule;
    }
  }
  return winner;
}

/** Round to a friendly figure: dollars under $1,000, $50 steps above it. */
function formatMoney(cents: number): string {
  const dollars = Math.max(cents, 0) / 100;
  const rounded = dollars >= 1_000 ? Math.round(dollars / 50) * 50 : Math.round(dollars);
  return `$${rounded.toLocaleString("en-US")}`;
}

export function formatEstimateRange(lowCents: number, highCents: number): string {
  return `${formatMoney(lowCents)}–${formatMoney(highCents)}`;
}

/**
 * Estimate a typical cost range for the job the customer described. Returns
 * null when there is nothing to base one on, so the UI shows no figure rather
 * than a made-up number.
 */
export function estimateJob(input: { text: string; categorySlug: string; urgency?: Urgency }): CostEstimate | null {
  const text = (input.text ?? "").toLowerCase().trim();
  const slug = input.categorySlug;
  const categoryName = CATEGORY_NAMES[slug];
  const base = CATEGORY_BASE[slug];
  if (!categoryName || !base) return null;

  const rule = text.length >= 3 ? bestRule(text, slug) : null;
  const chosen: { label: string; range: Money } = rule ?? base;

  const emergency = input.urgency === "emergency";
  const low = emergency ? Math.round(chosen.range.low * EMERGENCY_MULTIPLIER) : chosen.range.low;
  const high = emergency ? Math.round(chosen.range.high * EMERGENCY_MULTIPLIER) : chosen.range.high;

  return {
    categorySlug: slug,
    categoryName,
    basis: chosen.label,
    lowCents: low,
    highCents: high,
    emergency,
    summary: `${chosen.label} typically runs about ${formatEstimateRange(low, high)}.`,
    note: NOTE,
  };
}
