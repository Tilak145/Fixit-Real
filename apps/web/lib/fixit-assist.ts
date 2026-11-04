/**
 * FixIt Smart Assist — on-demand job description helper.
 *
 * A transparent rules engine: matches the customer's own words against known
 * problem vocabulary to suggest a service category, urgency, and a cleaned-up
 * job description. It runs instantly in the app, costs nothing per use, and
 * never invents facts — every suggestion comes from the customer's text.
 */

import { CORE_CATEGORIES } from "@/components/fixit/service-icons";

export type { Urgency } from "@/lib/fixit-estimate";

import type { Urgency } from "@/lib/fixit-estimate";

export interface AssistSuggestion {
  categorySlug: string;
  categoryName: string;
  urgency: Urgency;
  urgencyLabel: string;
  title: string;
  description: string;
  matchedKeywords: string[];
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  plumbing: [
    "leak", "leaking", "leaky", "faucet", "tap", "sink", "toilet", "pipe", "drain",
    "clog", "clogged", "water heater", "hot water", "sewage", "sewer", "burst",
    "flood", "flooding", "disposal", "shower", "bathtub", "sump pump", "water pressure",
  ],
  electrical: [
    "electric", "electrical", "outlet", "socket", "switch", "wiring", "breaker",
    "panel", "power", "light fixture", "lights out", "sparking", "spark", "short",
    "ev charger", "ceiling fan", "fuse", "shock",
  ],
  hvac: [
    "ac", "a/c", "air conditioner", "air conditioning", "furnace", "heater",
    "heating", "hvac", "thermostat", "duct", "vent", "cooling", "heat pump",
    "not cooling", "not heating", "blowing hot", "blowing cold",
  ],
  "garage-doors": [
    "garage door", "garage", "opener", "door won't open", "door stuck", "springs",
    "spring", "track", "remote", "off track",
  ],
  roofing: [
    "roof", "shingle", "shingles", "gutter", "gutters", "ceiling stain",
    "roof leak", "flashing", "downspout", "storm damage",
  ],
  "appliance-repair": [
    "dishwasher", "washer", "dryer", "fridge", "refrigerator", "freezer", "oven",
    "stove", "range", "microwave", "appliance", "washing machine", "ice maker",
  ],
  handyman: [
    "handyman", "repair", "fix", "install", "assemble", "mount", "hang",
    "squeaky", "stuck door", "patch", "caulk", "shelf", "tv mount",
  ],
  cleaning: [
    "clean", "cleaning", "maid", "deep clean", "move out", "carpet", "upholstery",
    "window cleaning", "pressure wash", "housekeeping",
  ],
  "pest-control": [
    "pest", "bugs", "insects", "ants", "roaches", "cockroach", "mice", "mouse",
    "rats", "termites", "wasps", "bees", "spiders", "bed bugs", "infestation",
  ],
  landscaping: [
    "lawn", "grass", "mow", "yard", "landscaping", "tree", "trees", "bushes",
    "garden", "leaves", "mulch", "fence", "sod", "weeds", "snow",
  ],
};

const EMERGENCY_KEYWORDS = [
  "burst", "flooding", "flood", "everywhere", "sparking", "smoke", "fire",
  "gas smell", "gas leak", "sewage", "sewer backup", "no power", "no heat",
  "no hot water", "emergency", "urgent", "asap", "right now", "tonight",
  "overflowing", "pouring", "gushing",
];

const SOON_KEYWORDS = [
  "this week", "few days", "soon", "worse", "getting worse", "intermittent",
  "sometimes", "keeps", "again", "noisy", "loud", "slow drain", "smell",
];

function score(haystack: string, words: string[]): { score: number; matched: string[] } {
  let total = 0;
  const matched: string[] = [];
  for (const w of words) {
    if (haystack.includes(w)) {
      total += w.includes(" ") ? 2 : 1; // multi-word matches weigh more
      matched.push(w);
    }
  }
  return { score: total, matched };
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Build a short job title from the customer's text (max ~8 words). */
function buildTitle(text: string): string {
  const cleaned = text
    .replace(/\s+/gu, " ")
    .replace(/^(hi|hello|please help|i need|we need|looking for|need)\b[,\s]*/iu, "")
    .trim();
  const firstSentence = cleaned.split(/[.!?]/u)[0] ?? cleaned;
  const words = firstSentence.split(" ").slice(0, 8).join(" ").trim();
  return titleCase(words || "Home service job");
}

const URGENCY_META: Record<Urgency, string> = {
  emergency: "Emergency — same-day help recommended",
  soon: "Soon — within a few days",
  flexible: "Flexible — whenever it suits you",
};

export function assistJob(rawDescription: string): AssistSuggestion | null {
  const text = rawDescription.toLowerCase().trim();
  if (text.length < 3) return null;

  let bestSlug = "";
  let bestScore = 0;
  let bestMatched: string[] = [];
  for (const cat of CORE_CATEGORIES) {
    const { score: s, matched } = score(text, CATEGORY_KEYWORDS[cat.slug] ?? []);
    if (s > bestScore) {
      bestScore = s;
      bestSlug = cat.slug;
      bestMatched = matched;
    }
  }
  if (bestScore === 0) return null;

  const em = score(text, EMERGENCY_KEYWORDS);
  const soon = score(text, SOON_KEYWORDS);
  const urgency: Urgency = em.score > 0 ? "emergency" : soon.score > 0 ? "soon" : "flexible";
  const category = CORE_CATEGORIES.find((c) => c.slug === bestSlug) ?? CORE_CATEGORIES[0];

  const urgencySentence =
    urgency === "emergency"
      ? "This is urgent — the customer is asking for same-day service."
      : urgency === "soon"
        ? "The customer would like this looked at within the next few days."
        : "Timing is flexible.";

  const description = [
    buildTitle(rawDescription) + ".",
    `Service needed: ${category.name}.`,
    urgencySentence,
    bestMatched.length > 0
      ? `Keywords from the customer's description: ${bestMatched.slice(0, 5).join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    categorySlug: category.slug,
    categoryName: category.name,
    urgency,
    urgencyLabel: URGENCY_META[urgency],
    title: buildTitle(rawDescription),
    description,
    matchedKeywords: bestMatched.slice(0, 5),
  };
}
