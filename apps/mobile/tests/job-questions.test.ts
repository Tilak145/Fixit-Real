import test from "node:test";
import assert from "node:assert/strict";
import {
  JOB_QUESTIONS,
  cleanAnswers,
  composeDescription,
  hasAnswers,
  parseDescription,
  questionsFor,
  toggleAnswer,
  type JobAnswers,
} from "../lib/job-questions.ts";
import { guessService } from "../lib/job-keywords.ts";

const SERVICES = [
  "plumbing",
  "electrical",
  "hvac",
  "garage-doors",
  "roofing",
  "appliance-repair",
  "handyman",
  "cleaning",
  "pest-control",
  "landscaping",
];

test("every service FixIt offers asks its customers something", () => {
  for (const slug of SERVICES) {
    const questions = questionsFor(slug);
    assert.ok(questions.length >= 2, `${slug} should ask at least two questions`);
    assert.ok(questions.length <= 3, `${slug} should not ask more than three`);
    assert.ok(questions[0].options.length >= 8, `${slug}'s first question needs a good list of choices`);
  }
  assert.deepEqual(Object.keys(JOB_QUESTIONS).sort(), [...SERVICES].sort());
});

test("question and option ids are unique, and labels are short enough to tap", () => {
  for (const [slug, questions] of Object.entries(JOB_QUESTIONS)) {
    const questionIds = questions.map((q) => q.id);
    assert.equal(new Set(questionIds).size, questionIds.length, `${slug} repeats a question id`);
    for (const question of questions) {
      const optionIds = question.options.map((o) => o.id);
      assert.equal(new Set(optionIds).size, optionIds.length, `${slug}/${question.id} repeats an option id`);
      const labels = question.options.map((o) => o.label.toLowerCase());
      assert.equal(new Set(labels).size, labels.length, `${slug}/${question.id} repeats a label`);
      for (const option of question.options) assert.ok(option.label.length <= 60, `${option.label} is too long`);
      assert.ok(question.short.length <= 14, `${slug}/${question.id} short name is too long`);
      assert.ok(!/[:•\n]/.test(question.short) && !/[•\n]/.test(question.options.map((o) => o.label).join("")), "labels must not break the saved layout");
    }
  }
});

test("a service that does not exist asks nothing", () => {
  assert.deepEqual(questionsFor("astrology"), []);
  assert.equal(composeDescription("astrology", { x: ["y"] }, "  hello  "), "hello");
});

test("choosing answers: single replaces, multi adds, choosing again clears", () => {
  let answers: JobAnswers = {};
  answers = toggleAnswer("cleaning", answers, "kind", "deep");
  answers = toggleAnswer("cleaning", answers, "kind", "windows");
  assert.deepEqual(answers.kind, ["deep", "windows"]);
  answers = toggleAnswer("cleaning", answers, "kind", "deep");
  assert.deepEqual(answers.kind, ["windows"]);
  answers = toggleAnswer("cleaning", answers, "size", "2br");
  answers = toggleAnswer("cleaning", answers, "size", "3br");
  assert.deepEqual(answers.size, ["3br"]);
  answers = toggleAnswer("cleaning", answers, "size", "3br");
  assert.equal("size" in answers, false);
  // An answer that is not on the list is ignored.
  assert.deepEqual(toggleAnswer("cleaning", answers, "kind", "nonsense"), answers);
  assert.deepEqual(toggleAnswer("cleaning", answers, "nope", "deep"), answers);
});

test("answers from another service or made up are dropped", () => {
  const clean = cleanAnswers("cleaning", { kind: ["deep", "leak"], size: ["2br", "3br"], bogus: ["x"] });
  assert.deepEqual(clean, { kind: ["deep"], size: ["2br"] });
  assert.equal(hasAnswers("cleaning", { kind: ["leak"] }), false);
  assert.equal(hasAnswers("cleaning", { kind: ["deep"] }), true);
});

test("the description lists the choices, in the order the questions are asked", () => {
  const text = composeDescription(
    "cleaning",
    { often: ["weekly"], kind: ["windows", "deep"], size: ["3br"] },
    "Two dogs, please bring your own vacuum.",
  );
  assert.equal(
    text,
    [
      "Job details",
      "• Cleaning: Deep cleaning, Windows",
      "• Size: 3 bedrooms",
      "• How often: Every week",
      "",
      "Two dogs, please bring your own vacuum.",
    ].join("\n"),
  );
});

test("with no choices the description is just what the customer typed", () => {
  assert.equal(composeDescription("plumbing", {}, "  kitchen faucet leaking  "), "kitchen faucet leaking");
  assert.equal(composeDescription("plumbing", { problem: ["leak"] }, ""), "Job details\n• Problem: Leak or dripping");
});

test("a saved description reads back into the choices and the customer's words", () => {
  const answers: JobAnswers = { kind: ["deep"], size: ["2br"], often: ["once"] };
  const notes = "Note: the key is under the mat.\n• not a detail line\nThanks!";
  const parsed = parseDescription(composeDescription("cleaning", answers, notes));
  assert.deepEqual(parsed.details, [
    { label: "Cleaning", value: "Deep cleaning" },
    { label: "Size", value: "2 bedrooms" },
    { label: "How often", value: "Just once" },
  ]);
  assert.equal(parsed.notes, notes);
});

test("an older request with only plain text still reads fine", () => {
  assert.deepEqual(parseDescription("kitchen faucet leaking, need repair"), {
    details: [],
    notes: "kitchen faucet leaking, need repair",
  });
  assert.deepEqual(parseDescription(null), { details: [], notes: "" });
  assert.deepEqual(parseDescription("Job details\nnot a list"), { details: [], notes: "Job details\nnot a list" });
});

test("a typed word names the right service, whole words only", () => {
  assert.equal(guessService("I want my cleaning"), "cleaning");
  assert.equal(guessService("Leaky faucet"), "plumbing");
  assert.equal(guessService("my sink is leaking"), "plumbing");
  assert.equal(guessService("stuck garage door"), "garage-doors");
  assert.equal(guessService("no heat, furnace is off"), "hvac");
  assert.equal(guessService("AC not cooling"), "hvac");
  assert.equal(guessService("outlet sparks"), "electrical");
  assert.equal(guessService("roof is leaking after the storm"), "roofing");
  assert.equal(guessService("washing machine won't drain"), "appliance-repair");
  assert.equal(guessService("mice in the kitchen"), "pest-control");
  assert.equal(guessService("termites"), "pest-control");
  assert.equal(guessService("mow my lawn"), "landscaping");
  assert.equal(guessService("trim the tree and mulch"), "landscaping");
  assert.equal(guessService("mount a TV and assemble a desk"), "handyman");
});

test("words that merely contain a trade word are not misread", () => {
  assert.equal(guessService("I want to plant flowers"), "landscaping"); // "plant" is not "ant"
  assert.notEqual(guessService("I want to plant flowers"), "pest-control");
  assert.equal(guessService("water heater"), "plumbing");
  assert.equal(guessService("a great day"), null);
  assert.equal(guessService(""), null);
  assert.equal(guessService(null), null);
});
