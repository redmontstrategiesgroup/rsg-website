/**
 * Authored default content for the three primary verticals. Admin overrides
 * (lib/industries/store.ts) merge over these at read time.
 */

import type { IndustryVertical, VerticalSlug } from "../types";
import { homeServicesVertical } from "./home-services";
import { dentalVertical } from "./dental";
import { retailVertical } from "./retail";

export const DEFAULT_VERTICALS: Record<VerticalSlug, IndustryVertical> = {
  "home-services": homeServicesVertical,
  "dental-practices": dentalVertical,
  retail: retailVertical,
};
