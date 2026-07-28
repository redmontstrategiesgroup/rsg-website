import type { FormSection } from "./types.ts";

/**
 * Pure helpers shared by the FormFlow client component and server-side
 * validation (API routes must evaluate the same conditional logic the
 * browser saw).
 */

export function showIfMatches(
  showIf: { key: string; anyOf: string[] } | undefined,
  answers: Record<string, unknown>,
): boolean {
  if (!showIf) return true;
  const value = answers[showIf.key];
  if (Array.isArray(value)) return value.some((v) => showIf.anyOf.includes(String(v)));
  return showIf.anyOf.includes(String(value ?? ""));
}

/** Sections and questions visible for the given answers. */
export function visibleSections(
  sections: FormSection[],
  answers: Record<string, unknown>,
): FormSection[] {
  return sections
    .filter((s) => showIfMatches(s.showIf, answers))
    .map((s) => ({
      ...s,
      questions: s.questions.filter((q) => showIfMatches(q.showIf, answers)),
    }))
    .filter((s) => s.questions.length > 0);
}

export function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim().length > 0;
}
