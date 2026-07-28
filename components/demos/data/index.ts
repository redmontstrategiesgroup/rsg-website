import { medspaConfig } from "./medspa";
import { contractorConfig } from "./contractor";
import { gymConfig } from "./gym";
import { dentalConfig } from "./dental";
import { retailConfig } from "./retail";
import type { IndustryConfig } from "../types";

export const DEMO_CONFIGS: IndustryConfig[] = [
  retailConfig,
  medspaConfig,
  contractorConfig,
  gymConfig,
  dentalConfig,
];

export { medspaConfig, contractorConfig, gymConfig, dentalConfig, retailConfig };

export function demoBySlug(slug: string): IndustryConfig | undefined {
  return DEMO_CONFIGS.find((c) => c.slug === slug);
}
