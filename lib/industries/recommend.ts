import type { IndustryVertical, RsgSystem } from "./types";

/**
 * Keyword-match the visitor's answers against the vertical's rules.
 *
 * Note the matching model, because it constrains how content authors write
 * their keywords: every answer is flattened into ONE lowercase haystack, and
 * the FIRST rule with any matching keyword wins. A short keyword ("routing",
 * "nurture", "reporting") can therefore be triggered by an unrelated
 * question's option text. Keywords should be full distinctive phrases taken
 * from the deciding question's own options, and the rules ordered to match
 * that question's option order.
 *
 * Lives here rather than in AssessmentForm.tsx so the matcher is importable
 * by tests — the form is a client component and node:test cannot load it.
 */
export function recommendSystem(
  vertical: IndustryVertical,
  answers: Record<string, string>
): RsgSystem {
  const haystack = Object.values(answers).join(" ").toLowerCase();
  for (const rule of vertical.assessment.recommendations) {
    if (rule.keywords.some((k) => haystack.includes(k.toLowerCase()))) {
      const system = vertical.systems.find((s) => s.id === rule.systemId);
      if (system) return system;
    }
  }
  return (
    vertical.systems.find((s) => s.id === vertical.assessment.fallbackSystemId) ??
    vertical.systems[0]
  );
}
