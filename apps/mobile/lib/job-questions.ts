/**
 * The questions a customer is asked about a job, for each service.
 *
 * A request that says only "cleaning" tells a professional almost nothing: a
 * weekly tidy and a post-renovation clean are different jobs at very different
 * prices. So once the customer picks a service they are shown a few quick
 * questions with tap-to-choose answers. What they choose is saved with the
 * request, in the fixed layout below, so professionals see it as a clear list
 * and can send an accurate price without a round of messages first.
 *
 * To change what a service asks, edit the lists here. Nothing else needs to
 * change. Every answer is optional: the customer can skip any question and the
 * free-text box still works.
 */

export interface JobOption {
  id: string;
  label: string;
}

export interface JobQuestion {
  id: string;
  /** The question as the customer reads it. */
  label: string;
  /** The short name shown to the professional beside the answers. */
  short: string;
  /** "multi": choose any that apply. "single": choose one. */
  kind: "multi" | "single";
  options: JobOption[];
}

const other: JobOption = { id: "other", label: "Something else" };

export const JOB_QUESTIONS: Record<string, JobQuestion[]> = {
  plumbing: [
    {
      id: "problem",
      label: "What is the plumbing problem?",
      short: "Problem",
      kind: "multi",
      options: [
        { id: "leak", label: "Leak or dripping" },
        { id: "clog", label: "Clogged drain or toilet" },
        { id: "toilet", label: "Toilet will not flush or keeps running" },
        { id: "water-heater", label: "Water heater (no hot water, leak or replace)" },
        { id: "pipe", label: "Burst, frozen or damaged pipe" },
        { id: "install", label: "Install a faucet, sink, shower or tub" },
        { id: "disposal", label: "Garbage disposal" },
        { id: "sump", label: "Sump pump or flooded basement" },
        { id: "sewer", label: "Sewer line or main drain" },
        { id: "pressure", label: "Low water pressure" },
        { id: "gas", label: "Gas line" },
        other,
      ],
    },
    {
      id: "where",
      label: "Where in the home is it?",
      short: "Where",
      kind: "multi",
      options: [
        { id: "kitchen", label: "Kitchen" },
        { id: "bathroom", label: "Bathroom" },
        { id: "basement", label: "Basement" },
        { id: "laundry", label: "Laundry room" },
        { id: "outside", label: "Outside" },
        { id: "whole", label: "Whole house" },
      ],
    },
  ],

  electrical: [
    {
      id: "need",
      label: "What do you need done?",
      short: "Work needed",
      kind: "multi",
      options: [
        { id: "outlet", label: "Outlet or switch not working, or a new one" },
        { id: "lighting", label: "Light fixture or ceiling fan" },
        { id: "panel", label: "Breaker panel or tripping breakers" },
        { id: "wiring", label: "New wiring or rewiring" },
        { id: "power-out", label: "Power out in part of the home" },
        { id: "ev", label: "Electric car charger" },
        { id: "generator", label: "Generator or transfer switch" },
        { id: "smoke", label: "Smoke or CO detectors" },
        { id: "outdoor", label: "Outdoor or landscape lighting" },
        { id: "circuit", label: "Circuit for a stove, dryer or hot tub" },
        { id: "inspection", label: "Safety inspection" },
        other,
      ],
    },
    {
      id: "where",
      label: "Where is the work?",
      short: "Where",
      kind: "single",
      options: [
        { id: "inside", label: "Inside the home" },
        { id: "outside", label: "Outside" },
        { id: "garage", label: "Garage or shed" },
        { id: "whole", label: "Whole home" },
      ],
    },
  ],

  hvac: [
    {
      id: "need",
      label: "What do you need?",
      short: "Work needed",
      kind: "multi",
      options: [
        { id: "ac-repair", label: "AC not cooling or not turning on" },
        { id: "heat-repair", label: "Furnace or heat not working" },
        { id: "install-ac", label: "Install a new AC" },
        { id: "install-furnace", label: "Install a new furnace" },
        { id: "heat-pump", label: "Heat pump" },
        { id: "tune-up", label: "Seasonal tune-up or maintenance" },
        { id: "thermostat", label: "Thermostat" },
        { id: "ducts", label: "Ductwork or duct cleaning" },
        { id: "air-quality", label: "Air purifier, humidifier or filters" },
        { id: "noise-smell", label: "Strange noise or smell" },
        { id: "boiler", label: "Boiler or radiators" },
        other,
      ],
    },
    {
      id: "system",
      label: "What kind of system do you have?",
      short: "System",
      kind: "single",
      options: [
        { id: "central", label: "Central air and furnace" },
        { id: "heat-pump", label: "Heat pump" },
        { id: "mini-split", label: "Ductless mini-split" },
        { id: "boiler", label: "Boiler or radiators" },
        { id: "window", label: "Window or portable unit" },
        { id: "unsure", label: "Not sure" },
      ],
    },
  ],

  "garage-doors": [
    {
      id: "need",
      label: "What do you need?",
      short: "Work needed",
      kind: "multi",
      options: [
        { id: "wont-move", label: "Door will not open or close" },
        { id: "spring", label: "Broken spring" },
        { id: "off-track", label: "Off track or cable snapped" },
        { id: "opener-repair", label: "Opener not working" },
        { id: "opener-new", label: "Install a new opener" },
        { id: "new-door", label: "Replace the whole door" },
        { id: "panel", label: "Dented or damaged panel" },
        { id: "remote", label: "Remote or keypad" },
        { id: "noisy", label: "Noisy or shaky door" },
        { id: "seal", label: "Weatherstrip or seal" },
        { id: "tune-up", label: "Tune-up" },
        other,
      ],
    },
    {
      id: "door",
      label: "What kind of door is it?",
      short: "Door",
      kind: "single",
      options: [
        { id: "single", label: "Single-car" },
        { id: "double", label: "Double-car" },
        { id: "commercial", label: "Commercial or roll-up" },
        { id: "unsure", label: "Not sure" },
      ],
    },
  ],

  roofing: [
    {
      id: "need",
      label: "What do you need?",
      short: "Work needed",
      kind: "multi",
      options: [
        { id: "leak", label: "Leak or water stain" },
        { id: "shingles", label: "Missing or damaged shingles" },
        { id: "replace", label: "Full roof replacement" },
        { id: "inspection", label: "Roof inspection or estimate" },
        { id: "storm", label: "Storm, wind or hail damage" },
        { id: "gutters", label: "Gutters or downspouts" },
        { id: "flashing", label: "Flashing or chimney" },
        { id: "skylight", label: "Skylight" },
        { id: "flat", label: "Flat roof repair" },
        { id: "vents", label: "Vents or ventilation" },
        { id: "moss", label: "Moss or algae cleaning" },
        { id: "insurance", label: "Help with an insurance claim" },
        other,
      ],
    },
    {
      id: "material",
      label: "What is the roof made of?",
      short: "Roof",
      kind: "single",
      options: [
        { id: "asphalt", label: "Asphalt shingles" },
        { id: "metal", label: "Metal" },
        { id: "flat", label: "Flat or rubber" },
        { id: "tile", label: "Tile or slate" },
        { id: "unsure", label: "Not sure" },
      ],
    },
  ],

  "appliance-repair": [
    {
      id: "appliance",
      label: "Which appliance?",
      short: "Appliance",
      kind: "multi",
      options: [
        { id: "fridge", label: "Refrigerator or freezer" },
        { id: "washer", label: "Washing machine" },
        { id: "dryer", label: "Dryer" },
        { id: "dishwasher", label: "Dishwasher" },
        { id: "oven", label: "Oven, range or stove" },
        { id: "microwave", label: "Microwave" },
        { id: "ice-maker", label: "Ice maker" },
        { id: "install", label: "Install a new appliance" },
        other,
      ],
    },
    {
      id: "wrong",
      label: "What is it doing?",
      short: "Problem",
      kind: "multi",
      options: [
        { id: "wont-start", label: "Will not turn on" },
        { id: "temperature", label: "Not heating or cooling" },
        { id: "leak", label: "Leaking" },
        { id: "noise", label: "Strange noise" },
        { id: "drain", label: "Will not drain or spin" },
        { id: "error", label: "Shows an error code" },
      ],
    },
    {
      id: "age",
      label: "How old is it?",
      short: "Age",
      kind: "single",
      options: [
        { id: "under-5", label: "Under 5 years" },
        { id: "5-10", label: "5 to 10 years" },
        { id: "over-10", label: "Over 10 years" },
        { id: "unsure", label: "Not sure" },
      ],
    },
  ],

  handyman: [
    {
      id: "need",
      label: "What needs doing?",
      short: "Work needed",
      kind: "multi",
      options: [
        { id: "furniture", label: "Assemble furniture" },
        { id: "mount", label: "Mount a TV or shelves" },
        { id: "hang", label: "Hang pictures, curtains or mirrors" },
        { id: "drywall", label: "Drywall or wall repair" },
        { id: "paint", label: "Painting or touch-ups" },
        { id: "doors", label: "Door or lock repair" },
        { id: "carpentry", label: "Small carpentry or trim" },
        { id: "caulk", label: "Caulking or sealing" },
        { id: "tile", label: "Tile or grout repair" },
        { id: "fence", label: "Fence or gate repair" },
        { id: "list", label: "A list of small jobs" },
        other,
      ],
    },
    {
      id: "size",
      label: "How big is the job?",
      short: "Size",
      kind: "single",
      options: [
        { id: "small", label: "One small task (under 2 hours)" },
        { id: "few", label: "A few tasks (half a day)" },
        { id: "day", label: "A full day or more" },
      ],
    },
  ],

  cleaning: [
    {
      id: "kind",
      label: "What kind of cleaning do you need?",
      short: "Cleaning",
      kind: "multi",
      options: [
        { id: "regular", label: "Regular house cleaning" },
        { id: "deep", label: "Deep cleaning" },
        { id: "move", label: "Move-in or move-out cleaning" },
        { id: "construction", label: "After construction or renovation" },
        { id: "carpet", label: "Carpets or upholstery" },
        { id: "windows", label: "Windows" },
        { id: "pressure", label: "Pressure washing" },
        { id: "kitchen", label: "Kitchen or appliances (oven, fridge)" },
        { id: "turnover", label: "Airbnb or rental turnover" },
        { id: "office", label: "Office or business" },
        { id: "garage", label: "Garage or basement" },
        other,
      ],
    },
    {
      id: "size",
      label: "How big is the space?",
      short: "Size",
      kind: "single",
      options: [
        { id: "studio", label: "Studio or 1 bedroom" },
        { id: "2br", label: "2 bedrooms" },
        { id: "3br", label: "3 bedrooms" },
        { id: "4br", label: "4 or more bedrooms" },
        { id: "business", label: "Business or large space" },
      ],
    },
    {
      id: "often",
      label: "How often?",
      short: "How often",
      kind: "single",
      options: [
        { id: "once", label: "Just once" },
        { id: "weekly", label: "Every week" },
        { id: "biweekly", label: "Every two weeks" },
        { id: "monthly", label: "Every month" },
      ],
    },
  ],

  "pest-control": [
    {
      id: "pest",
      label: "What are you seeing?",
      short: "Pest",
      kind: "multi",
      options: [
        { id: "ants", label: "Ants" },
        { id: "roaches", label: "Cockroaches" },
        { id: "bed-bugs", label: "Bed bugs" },
        { id: "rodents", label: "Mice or rats" },
        { id: "spiders", label: "Spiders" },
        { id: "wasps", label: "Wasps, hornets or bees" },
        { id: "termites", label: "Termites or wood damage" },
        { id: "fleas", label: "Fleas or ticks" },
        { id: "mosquitoes", label: "Mosquitoes" },
        { id: "wildlife", label: "Raccoons, squirrels, bats or birds" },
        { id: "unsure", label: "Not sure what it is" },
        { id: "prevention", label: "A regular prevention plan" },
      ],
    },
    {
      id: "where",
      label: "Where are they?",
      short: "Where",
      kind: "single",
      options: [
        { id: "inside", label: "Inside the home" },
        { id: "outside", label: "Outside or in the yard" },
        { id: "attic", label: "Attic or crawl space" },
        { id: "both", label: "Both inside and out" },
      ],
    },
    {
      id: "long",
      label: "How long has it been going on?",
      short: "How long",
      kind: "single",
      options: [
        { id: "new", label: "Just noticed it" },
        { id: "weeks", label: "A few weeks" },
        { id: "months", label: "Months" },
        { id: "returns", label: "It comes back every year" },
      ],
    },
  ],

  landscaping: [
    {
      id: "need",
      label: "What do you need?",
      short: "Work needed",
      kind: "multi",
      options: [
        { id: "mowing", label: "Lawn mowing" },
        { id: "trees", label: "Tree trimming or removal" },
        { id: "garden", label: "Planting or garden design" },
        { id: "mulch", label: "Mulching or bed edging" },
        { id: "cleanup", label: "Leaf or yard cleanup" },
        { id: "sprinklers", label: "Sprinklers or irrigation" },
        { id: "lawn-care", label: "Seeding, sod or lawn treatment" },
        { id: "hardscape", label: "Patio, walkway or retaining wall" },
        { id: "snow", label: "Snow removal" },
        { id: "stump", label: "Stump grinding" },
        { id: "drainage", label: "Drainage or grading" },
        other,
      ],
    },
    {
      id: "size",
      label: "How big is the yard?",
      short: "Yard",
      kind: "single",
      options: [
        { id: "small", label: "Small (townhouse or small lot)" },
        { id: "medium", label: "Medium (a typical lot)" },
        { id: "large", label: "Large (over half an acre)" },
        { id: "unsure", label: "Not sure" },
      ],
    },
    {
      id: "often",
      label: "How often?",
      short: "How often",
      kind: "single",
      options: [
        { id: "once", label: "Just once" },
        { id: "weekly", label: "Every week" },
        { id: "biweekly", label: "Every two weeks" },
        { id: "monthly", label: "Every month" },
        { id: "seasonal", label: "Each season" },
      ],
    },
  ],
};

/** What the customer has chosen: question id to the chosen option ids. */
export type JobAnswers = Record<string, string[]>;

export function questionsFor(categorySlug: string): JobQuestion[] {
  return JOB_QUESTIONS[categorySlug] ?? [];
}

/** Keeps only answers that name a real question and a real option, in the order the options are listed. */
export function cleanAnswers(categorySlug: string, answers: JobAnswers | null | undefined): JobAnswers {
  const clean: JobAnswers = {};
  for (const question of questionsFor(categorySlug)) {
    const chosen = new Set(answers?.[question.id] ?? []);
    const valid = question.options.filter((option) => chosen.has(option.id)).map((option) => option.id);
    if (valid.length === 0) continue;
    clean[question.id] = question.kind === "single" ? valid.slice(0, 1) : valid;
  }
  return clean;
}

export function hasAnswers(categorySlug: string, answers: JobAnswers | null | undefined): boolean {
  return Object.keys(cleanAnswers(categorySlug, answers)).length > 0;
}

/**
 * Flips one answer. A "single" question holds one answer, so choosing another
 * replaces it and choosing the same one clears it; a "multi" question adds or
 * removes the option.
 */
export function toggleAnswer(
  categorySlug: string,
  answers: JobAnswers,
  questionId: string,
  optionId: string,
): JobAnswers {
  const question = questionsFor(categorySlug).find((item) => item.id === questionId);
  if (!question || !question.options.some((option) => option.id === optionId)) return answers;
  const current = answers[questionId] ?? [];
  const has = current.includes(optionId);
  const next = question.kind === "single" ? (has ? [] : [optionId]) : has ? current.filter((id) => id !== optionId) : [...current, optionId];
  const result = { ...answers };
  if (next.length === 0) delete result[questionId];
  else result[questionId] = next;
  return result;
}

// ---- How the answers are saved with the request ----------------------------
//
// The request's description keeps the layout below, so it stays readable
// anywhere the description is shown as plain text, and can be read back into a
// tidy list for professionals:
//
//   Job details
//   • Cleaning: Deep cleaning, Windows
//   • Size: 3 bedrooms
//
//   <what the customer typed>

export const DETAILS_HEADING = "Job details";
const BULLET = "• ";

/** The text saved as the request's description. */
export function composeDescription(
  categorySlug: string,
  answers: JobAnswers | null | undefined,
  notes: string,
): string {
  const clean = cleanAnswers(categorySlug, answers);
  const lines: string[] = [];
  for (const question of questionsFor(categorySlug)) {
    const ids = clean[question.id];
    if (!ids) continue;
    const labels = question.options.filter((option) => ids.includes(option.id)).map((option) => option.label);
    lines.push(`${BULLET}${question.short}: ${labels.join(", ")}`);
  }
  const typed = notes.trim();
  if (lines.length === 0) return typed;
  return [DETAILS_HEADING, ...lines].join("\n") + (typed ? `\n\n${typed}` : "");
}

export interface ParsedJob {
  /** The details the customer chose, in order; empty when the request has none. */
  details: Array<{ label: string; value: string }>;
  /** What the customer typed. */
  notes: string;
}

/** Reads a saved description back into the chosen details and the customer's own words. */
export function parseDescription(description: string | null | undefined): ParsedJob {
  const text = (description ?? "").replace(/\r\n/g, "\n");
  if (!text.startsWith(`${DETAILS_HEADING}\n${BULLET}`)) return { details: [], notes: text.trim() };
  const lines = text.split("\n").slice(1);
  const details: ParsedJob["details"] = [];
  let used = 0;
  for (const line of lines) {
    if (!line.startsWith(BULLET)) break;
    const body = line.slice(BULLET.length);
    const colon = body.indexOf(": ");
    if (colon < 1) break;
    details.push({ label: body.slice(0, colon), value: body.slice(colon + 2) });
    used += 1;
  }
  const notes = lines.slice(used).join("\n").trim();
  return { details, notes };
}
