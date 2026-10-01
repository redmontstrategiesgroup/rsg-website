import type { DraftOutput } from "./schema.ts";
import { TAILORED_KEYS, type ProposalSection } from "./types.ts";

const TAILORED = new Set<string>(TAILORED_KEYS);

/**
 * Apply drafted copy to the proposal's sections. Only tailored keys are taken;
 * titles, order, hidden flags and every boilerplate section stay as they were.
 */
export function mergeDraftSections(
  base: ProposalSection[],
  drafted: DraftOutput["sections"],
): ProposalSection[] {
  const byKey = new Map<string, DraftOutput["sections"][number]>();
  for (const d of drafted) {
    if (TAILORED.has(d.key) && !byKey.has(d.key)) byKey.set(d.key, d);
  }
  return base.map((s) => {
    const d = byKey.get(s.key);
    if (!d) return s;
    const next: ProposalSection = { ...s };
    if (d.body.trim()) next.body = d.body.trim();
    if (d.items !== undefined) {
      if (d.items.length) {
        next.items = d.items.map((i) => ({
          title: i.title,
          ...(i.detail ? { detail: i.detail } : {}),
          ...(i.meta ? { meta: i.meta } : {}),
        }));
      } else {
        delete next.items;
      }
    }
    return next;
  });
}

const CURRENCY_RE = /\$\s?\d|\bUSD\b|\bdollars?\b|\b\d[\d,.]*\s?[kK]\b/;

/** Titles of visible tailored sections whose text mentions an amount of money. */
export function sectionsWithCurrency(sections: ProposalSection[]): string[] {
  return sections
    .filter((s) => TAILORED.has(s.key) && !s.hidden)
    .filter((s) =>
      CURRENCY_RE.test(
        [s.body, ...(s.items ?? []).flatMap((i) => [i.title, i.detail ?? "", i.meta ?? ""])].join("\n"),
      ),
    )
    .map((s) => s.title);
}
