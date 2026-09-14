import { healthwellnessConfig } from "./healthwellness";
import { contractorConfig } from "./contractor";
import { realestateConfig } from "./realestate";
import type { IndustryConfig } from "../types";
import { DEMO_REQUEST_SLUGS, type DemoSlug } from "@/lib/demo-request-schema";

/**
 * `satisfies` fails the build if a slug in DEMO_REQUEST_SLUGS has no config
 * or a config is registered under a slug the request API doesn't accept.
 */
const registry = {
  healthwellness: healthwellnessConfig,
  contractors: contractorConfig,
  realestate: realestateConfig,
} satisfies Record<DemoSlug, IndustryConfig>;

export const DEMO_CONFIGS: IndustryConfig[] = DEMO_REQUEST_SLUGS.map((slug) => registry[slug]);

export { healthwellnessConfig, contractorConfig, realestateConfig };

export function demoBySlug(slug: string): IndustryConfig | undefined {
  return DEMO_CONFIGS.find((c) => c.slug === slug);
}
