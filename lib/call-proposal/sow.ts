import {
  formatCents,
  type PaymentScheduleEntry,
  type ProposalSection,
} from "../lifecycle/types.ts";

export type SowSource = {
  title: string;
  sections: ProposalSection[];
  total_cents: number;
  deposit_cents: number;
  payment_schedule: PaymentScheduleEntry[];
};

export const SOW_TERM_FALLBACK = "the schedule set out in the approved proposal";

function block(s: ProposalSection | undefined): string {
  if (!s) return "";
  return [
    s.body.trim(),
    ...(s.items ?? []).map((i) => `- ${i.title}${i.detail ? `: ${i.detail}` : ""}`),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Template vars for the `sow` contract, built from the edited, priced proposal. */
export function buildSowVars(
  p: SowSource,
  contact: { name: string; company: string },
  today: string,
  termLength: string,
): Record<string, string> {
  const visible = (key: string) => p.sections.find((s) => s.key === key && !s.hidden);
  const scope = [block(visible("scope")), block(visible("deliverables"))].filter(Boolean).join("\n\n");
  return {
    client_business: contact.company.trim() || contact.name,
    client_name: contact.name,
    effective_date: today,
    total_investment: formatCents(p.total_cents),
    deposit: formatCents(p.deposit_cents),
    scope_summary: scope || p.title,
    payment_schedule: p.payment_schedule
      .map((e) => `${e.label}: ${formatCents(e.amount_cents)} (${e.due})`)
      .join("; "),
    term_length: termLength.trim().slice(0, 120) || SOW_TERM_FALLBACK,
  };
}
