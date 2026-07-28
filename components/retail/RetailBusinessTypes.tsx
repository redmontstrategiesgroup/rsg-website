"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { TrackedLink } from "@/components/TrackedLink";

type BusinessType = {
  id: string;
  label: string;
  /** What the systems concretely do for this store type. */
  example: string;
};

const TYPES: BusinessType[] = [
  { id: "boutique", label: "Clothing boutiques", example: "Capture sizes and style preferences at checkout, text customers when their size restocks, invite top spenders to new-arrival previews, and win back shoppers who went quiet after one visit." },
  { id: "jewelry", label: "Jewelry stores", example: "Track anniversaries and past purchases, send milestone reminders before the dates that matter, answer after-hours questions about custom work, and follow up on every quote that goes silent." },
  { id: "furniture", label: "Furniture & home décor", example: "Quote custom and special orders in minutes, keep buyers updated from order to delivery, request reviews after the piece is placed, and reactivate past customers when new collections land." },
  { id: "pet", label: "Pet stores", example: "Send replenishment reminders timed to food and litter cycles, run a visit-based loyalty program, recover missed calls about stock, and flag when a weekly regular disappears." },
  { id: "sporting", label: "Sporting-goods stores", example: "Answer sizing and gear-fit questions automatically, alert customers when seasonal gear arrives, reward league and team referrals, and see which categories carry each season." },
  { id: "food", label: "Specialty food stores", example: "Remind customers when their staples run out, promote weekly arrivals to the right segments, take pre-orders for holidays, and keep gift baskets moving with markdown campaigns." },
  { id: "florist", label: "Florists", example: "Capture occasion dates once and remind customers every year, recover missed calls during rush weeks, take pickup and delivery orders automatically, and request reviews after every arrangement." },
  { id: "gift", label: "Gift shops", example: "Turn one-time gift buyers into regulars with welcome offers, recommend by occasion and budget over text, and keep slow-moving stock visible before the season ends." },
  { id: "beauty", label: "Beauty-supply stores", example: "Send replenishment reminders on product cycles, run VIP tiers for weekly regulars, answer product questions when the floor is busy, and track which lines actually drive repeat visits." },
  { id: "auto", label: "Auto-accessory retailers", example: "Capture fitment questions from missed calls, quote installs and bulk orders instantly, follow up on every estimate, and alert customers when back-ordered parts arrive." },
  { id: "collectibles", label: "Collectible & card stores", example: "Notify collectors the moment sought-after items arrive, run want-lists automatically, reward referrals from the community, and see which categories turn versus sit." },
  { id: "hobby", label: "Hobby shops", example: "Welcome new customers into classes and clubs, remind them when consumables run low, promote events to the right segments, and keep long-tail inventory from going stale." },
  { id: "multi", label: "Multi-location retailers", example: "Compare revenue, retention, and inventory across locations in one report, standardize follow-up so every store answers the same way, and route conversations to the right team." },
];

/**
 * Interactive "who this is for" section: choosing a store type updates the
 * concrete example, and the CTAs carry the visitor toward the demo or a call.
 */
export function RetailBusinessTypes() {
  const [selected, setSelected] = useState(TYPES[0]);

  return (
    <div className="section-grid mt-10 items-start">
      <div className="lg:col-span-5">
        <ul className="flex flex-wrap gap-2" role="list">
          {TYPES.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelected(t)}
                aria-pressed={selected.id === t.id}
                className={`rounded border px-3 py-2 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson ${
                  selected.id === t.id
                    ? "border-crimson/60 bg-crimson/[0.1] text-white"
                    : "border-white/12 bg-white/[0.02] text-white/60 hover:border-white/30 hover:text-white/85"
                }`}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-6 lg:col-start-7">
        <div className="card p-6" aria-live="polite">
          <p className="label !text-crimson-light">{selected.label}</p>
          <p className="mt-4 text-sm leading-relaxed text-white/70">{selected.example}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-white/[0.08] pt-5">
            <TrackedLink
              href="/demos/retail"
              event="demo_launch_click"
              eventProps={{ demo: "retail", location: "industry_business_types", type: selected.id }}
              className="btn-primary px-5 py-2.5 text-xs"
            >
              See it in the retail demo
              <ArrowRight size={13} className="ml-1.5" aria-hidden />
            </TrackedLink>
            <TrackedLink
              href="/book"
              event="book_strategy_call_click"
              eventProps={{ source: "retail_business_types", type: selected.id }}
              className="link-underline text-sm"
            >
              Book a retail strategy call
            </TrackedLink>
          </div>
        </div>
      </div>
    </div>
  );
}
