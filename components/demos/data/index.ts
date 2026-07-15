import { medspaConfig } from "./medspa";
import { contractorConfig } from "./contractor";
import { gymConfig } from "./gym";
import { dentalConfig } from "./dental";
import type { IndustryConfig } from "../types";

export const DEMO_CONFIGS: IndustryConfig[] = [
  medspaConfig,
  contractorConfig,
  gymConfig,
  dentalConfig,
];

export { medspaConfig, contractorConfig, gymConfig, dentalConfig };

export function demoBySlug(slug: string): IndustryConfig | undefined {
  return DEMO_CONFIGS.find((c) => c.slug === slug);
}
