// lib/apiv1/resources/public-catalog.ts
import { listActiveServices, listPublicAppointmentTypes } from "@/lib/scheduling/catalog";
import type { AppointmentType, Service } from "@/lib/scheduling/types";
import { getVerticals } from "@/lib/industries/store";
import type { IndustryVertical } from "@/lib/industries/types";
import { listPlans } from "@/lib/managed-services/store";
import type { ManagedServicePlan } from "@/lib/managed-services/types";
import type { ApiHandler } from "../types.ts";

const CACHE_HEADERS = { "Cache-Control": "public, max-age=300" };

function serviceDto(s: Service) {
  return { id: s.id, name: s.name, slug: s.slug, description: s.description };
}

function appointmentTypeDto(a: AppointmentType) {
  return {
    id: a.id,
    name: a.name,
    slug: a.slug,
    description: a.public_description,
    service_id: a.service_id,
    duration_minutes: a.duration_minutes,
    meeting_formats: a.meeting_formats,
    price_cents: a.price_cents,
  };
}

function industryDto(v: IndustryVertical) {
  return { slug: v.slug, name: v.name, short_name: v.shortName, status: v.status };
}

function planDto(p: ManagedServicePlan) {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    tagline: p.tagline,
    monthly_price_cents: p.monthlyPriceCents,
    annual_price_cents: p.annualPriceCents,
    setup_fee_cents: p.setupFeeCents,
    custom_pricing: p.customPricing,
    included_hours: p.includedHours,
    support_level: p.supportLevel,
    response_time: p.responseTime,
    minimum_commitment_months: p.minimumCommitmentMonths,
    features: p.features,
    recommended: p.recommended,
  };
}

export const listServices: ApiHandler<undefined, undefined> = async () => {
  const [services, appointmentTypes] = await Promise.all([listActiveServices(), listPublicAppointmentTypes()]);
  return {
    data: { services: services.map(serviceDto), appointment_types: appointmentTypes.map(appointmentTypeDto) },
    headers: CACHE_HEADERS,
  };
};

export const listIndustries: ApiHandler<undefined, undefined> = async () => {
  const verticals = await getVerticals();
  return { data: verticals.filter((v) => v.status === "published").map(industryDto), headers: CACHE_HEADERS };
};

export const listPlansHandler: ApiHandler<undefined, undefined> = async () => {
  const plans = await listPlans({ includeInactive: false });
  return { data: plans.map(planDto), headers: CACHE_HEADERS };
};
