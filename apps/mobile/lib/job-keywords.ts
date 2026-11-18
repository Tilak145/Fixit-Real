/**
 * Guessing the service from what a visitor typed on the home page ("my sink is
 * leaking" means plumbing), so the request form opens on the right service and
 * its questions.
 *
 * Words are matched as whole words, so "plant" is not read as "ant" (pests) and
 * "heater" is not read as "eat". The first matching trade in the list wins, so
 * the more specific words come first.
 */

const RULES: Array<[slug: string, pattern: RegExp]> = [
  ["garage-doors", /\bgarage\s*door|\bgarage\b|\bopener\b|\bdoor spring/],
  ["pest-control", /\bpests?\b|\bants?\b|\broach(?:es)?\b|\bcockroach(?:es)?\b|\bmice\b|\bmouse\b|\brats?\b|\brodents?\b|\bbed ?bugs?\b|\btermites?\b|\bwasps?\b|\bhornets?\b|\bbees?\b|\bspiders?\b|\bfleas?\b|\bticks?\b|\bmosquito(?:es)?\b|\braccoons?\b|\bsquirrels?\b|\bbats?\b/],
  ["roofing", /\broof(?:ing|er)?\b|\bshingles?\b|\bgutters?\b|\bchimney\b|\bskylight/],
  ["appliance-repair", /\bwashers?\b|\bwashing machine\b|\bdryers?\b|\bfridge\b|\brefrigerator\b|\bfreezer\b|\bdishwasher\b|\boven\b|\bstove\b|\brange\b|\bmicrowave\b|\bice maker\b|\bappliances?\b/],
  ["hvac", /\bhvac\b|\bfurnace\b|\bheat(?:ing)?\b|\bair condition(?:er|ing)?\b|\ba\/c\b|\bac\b|\bthermostat\b|\bducts?\b|\bboiler\b|\bheat pump\b/],
  ["electrical", /\belectric(?:al|ian)?\b|\boutlets?\b|\bwiring\b|\bbreaker\b|\bfuse\b|\blights?\b|\blighting\b|\bceiling fan\b|\bswitch\b|\bpanel\b|\bgenerator\b|\bev charger\b/],
  ["plumbing", /\bplumb(?:ing|er)?\b|\bleaks?\b|\bleaking\b|\bfaucets?\b|\btoilets?\b|\bdrains?\b|\bclog(?:ged)?\b|\bpipes?\b|\bsinks?\b|\bwater heater\b|\bshower\b|\bsewer\b|\bsump\b|\bgarbage disposal\b|\bdisposal\b/],
  ["cleaning", /\bclean(?:ing|er|ers)?\b|\bmaids?\b|\bjanitorial\b|\bpressure wash(?:ing)?\b|\bcarpet\b|\bwindow wash/],
  ["landscaping", /\blawn\b|\bmow(?:ing)?\b|\btrees?\b|\bgarden(?:ing)?\b|\bmulch\b|\byard\b|\blandscap(?:e|ing)\b|\bsprinklers?\b|\birrigation\b|\bsnow\b|\bstump\b|\bhedges?\b|\bleaves\b|\bplant(?:s|ing)?\b|\bflowers?\b|\bshrubs?\b|\bbush(?:es)?\b|\bsod\b|\bgrass\b/],
  ["handyman", /\bhandyman\b|\bassembl(?:e|y)\b|\bmount(?:ing)?\b|\btv mount\b|\bdrywall\b|\bpaint(?:ing)?\b|\bshelves\b|\bshelf\b|\bcaulk(?:ing)?\b|\bfence\b|\bodd jobs?\b|\bsmall repairs?\b/],
];

/** The service a piece of text is about, or null when nothing in it names one. */
export function guessService(text: string | null | undefined): string | null {
  const words = (text ?? "").toLowerCase();
  if (!words.trim()) return null;
  for (const [slug, pattern] of RULES) {
    if (pattern.test(words)) return slug;
  }
  return null;
}
