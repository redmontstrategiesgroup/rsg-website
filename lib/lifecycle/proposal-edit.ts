import { z } from "zod";
import type { ProposalSection } from "./types.ts";

/**
 * Pure helpers for admin proposal editing. Kept free of "@/" value imports so
 * node --test can load it.
 */

/** Sections whose text embeds the price at creation (see buildProposalSections). */
export const PRICE_SECTION_KEYS = ["investment", "payment_schedule"];

/** Swap in freshly rendered price text; keep the admin's titles and hidden flags. */
export function refreshPriceSections(
  current: ProposalSection[],
  fresh: ProposalSection[],
): ProposalSection[] {
  return current.map((s) => {
    if (!PRICE_SECTION_KEYS.includes(s.key)) return s;
    const f = fresh.find((x) => x.key === s.key);
    if (!f) return s;
    const next: ProposalSection = { ...s, body: f.body };
    if (f.items) next.items = f.items;
    else delete next.items;
    return next;
  });
}

export function validatePrice(totalCents: number, depositCents: number): string | null {
  if (!Number.isInteger(totalCents) || totalCents < 0) return "Total must be a whole number of cents, zero or more.";
  if (!Number.isInteger(depositCents) || depositCents < 0) return "Deposit must be a whole number of cents, zero or more.";
  if (depositCents > totalCents) return "The deposit can't be more than the total.";
  return null;
}

const SectionsInput = z
  .array(
    z.object({
      key: z.string().trim().min(1).max(60),
      title: z.string().trim().max(200),
      body: z.string().max(20_000),
      items: z
        .array(
          z.object({
            title: z.string().trim().max(300),
            detail: z.string().max(2000).optional(),
            meta: z.string().max(200).optional(),
          }),
        )
        .max(40)
        .optional(),
      hidden: z.boolean().optional(),
    }),
  )
  .max(40);

export function parseSectionsInput(
  raw: unknown,
): { ok: true; sections: ProposalSection[] } | { ok: false; error: string } {
  const r = SectionsInput.safeParse(raw);
  if (r.success) return { ok: true, sections: r.data };
  const issue = r.error.issues[0];
  return { ok: false, error: `Invalid sections: ${issue.path.join(".") || "(root)"} ${issue.message}` };
}
