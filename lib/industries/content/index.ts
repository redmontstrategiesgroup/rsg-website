/**
 * Authored default content for the three primary verticals, plus the
 * secondary-industries list. Admin overrides (lib/industries/store.ts) merge
 * over these at read time.
 */

import type { IndustryVertical, SecondaryIndustry, VerticalSlug } from "../types";
import { homeServicesVertical } from "./home-services";
import { dentalVertical } from "./dental";
import { retailVertical } from "./retail";

export const DEFAULT_VERTICALS: Record<VerticalSlug, IndustryVertical> = {
  "home-services": homeServicesVertical,
  "dental-practices": dentalVertical,
  retail: retailVertical,
};

/**
 * Industries RSG can evaluate but does not claim specialization in.
 * Deliberately short: no fabricated systems, case studies, or claims — each
 * entry states only the honest overlap with a system RSG has already built.
 */
export const DEFAULT_SECONDARY_INDUSTRIES: SecondaryIndustry[] = [
  {
    name: "Professional services",
    overlap:
      "Consultation booking, intake, and follow-up mirror the qualification and scheduling systems built for our primary verticals.",
  },
  {
    name: "Property management",
    overlap:
      "Maintenance requests, vendor dispatch, and tenant communication map closely to our home-service scheduling and dispatch work.",
  },
  {
    name: "Automotive services",
    overlap:
      "Appointment scheduling, estimate follow-up, and review generation work much like the service-business systems we already run.",
  },
  {
    name: "Legal offices",
    overlap:
      "Consultation intake, document collection, and client communication resemble our appointment-based practice systems.",
  },
  {
    name: "Construction",
    overlap:
      "Bid follow-up, job tracking, and customer updates extend the contractor workflows in our home-services vertical.",
  },
  {
    name: "Hospitality",
    overlap:
      "Reservation handling, guest messaging, and review management overlap with our booking and reputation systems.",
  },
  {
    name: "Logistics",
    overlap:
      "Status updates, dispatch coordination, and customer notifications share the automation backbone of our dispatch systems.",
  },
  {
    name: "Financial services",
    overlap:
      "Appointment scheduling and secure, permissioned internal AI assistants overlap with systems from our healthcare vertical.",
  },
];
