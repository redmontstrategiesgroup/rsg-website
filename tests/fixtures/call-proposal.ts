/** Shared fixtures for the call-proposal tests. */

export const extractOut = {
  pain_points: [
    { text: "Misses after-hours calls", evidence: { quote: "we miss every call after six", call: 1 } },
  ],
  current_tools: [
    {
      name: "Jobber",
      use: "scheduling",
      issue: "no texting",
      evidence: { quote: "We use Jobber for scheduling", call: 1 },
    },
  ],
  goals: [{ text: "Book jobs automatically", evidence: { quote: "I want jobs booked without me", call: 2 } }],
  budget: {
    stated: "around five to eight grand",
    low_cents: 800000,
    high_cents: 500000,
    confidence: "medium",
    evidence: { quote: "maybe five to eight grand", call: 2 },
  },
  timeline: {
    stated: "before spring",
    target_date: null,
    urgency: "medium",
    evidence: { quote: "This sentence is not in any transcript", call: 2 },
  },
  decision_makers: [],
  open_questions: ["Who approves spend?"],
  suggested_template_key: "growth_systems",
  summary: "Owner wants after-hours booking.",
};

export const draftOut = {
  title: "After-hours booking for Glow Home Services",
  term_length: "about six weeks",
  sections: [
    { key: "scope", body: "We will set up after-hours booking.", items: [{ title: "Missed-call text back" }] },
    { key: "investment", body: "Total: $9,000" },
    { key: "timeline", body: "Six weeks, starting in October." },
    { key: "made_up", body: "x" },
  ],
};
