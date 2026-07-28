import type { ServiceCategory } from "@/lib/lifecycle/types";

/**
 * Maps the public booking funnel's plain-language help-category slugs
 * (rows in `services`) to lifecycle service categories, so questionnaire
 * templates and appointment-type recommendations line up with what the
 * visitor actually asked for.
 */
const SLUG_TO_CATEGORY: Record<string, ServiceCategory> = {
  "more-leads": "growth_systems",
  "customer-communication": "growth_systems",
  "website-presence": "website_platform",
  "automate-tasks": "operations_systems",
  "business-operations": "operations_systems",
  "explore-ai": "private_ai",
  "custom-private-ai": "private_ai",
  "not-sure": "business_systems",
  "something-else": "business_systems",
};

export function serviceCategoryForSlug(
  slug: string | null | undefined,
): ServiceCategory | null {
  if (!slug) return null;
  return SLUG_TO_CATEGORY[slug] ?? null;
}
