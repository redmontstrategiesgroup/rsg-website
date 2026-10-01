/** Shared fixtures for the call-proposal tests. */

import type { CallInput } from "../../lib/call-proposal/types.ts";
import type { Lead } from "../../lib/types.ts";

export const calls: CallInput[] = [
  {
    recordingId: "r1",
    title: "Discovery",
    recordedAt: "2026-09-20T15:00:00Z",
    transcript: "",
    segments: [
      { speaker: "Joseph", text: "What's going wrong?" },
      { speaker: "Dana", text: "Honestly we miss every call after six." },
      { speaker: "Dana", text: "We use Jobber for scheduling." },
    ],
  },
  {
    recordingId: "r2",
    title: "Follow-up",
    recordedAt: "2026-09-27T15:00:00Z",
    transcript: "I want jobs booked without me. Budget is maybe five to eight grand.",
    segments: [],
  },
];

export const lead: Lead = {
  id: "lead-1",
  name: "Dana Ruiz",
  company: "Glow Home Services",
  email: "dana@example.com",
  phone: "555-0100",
  website: "",
  industry: "Home services",
  problem: "We miss calls after 6pm.",
  improve: "After-hours booking.",
  submittedAt: "2026-09-19T12:00:00.000Z",
};

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
