# SEO Audit — Redmont Strategies Group

**Domain:** https://redmontstrategiesgroup.com
**Audit type:** Full site audit (30 pages)
**Date:** July 25, 2026
**Auditor:** Claude Code

> **Data note:** No SEO tool (Ahrefs/Semrush) is connected, so keyword volumes and difficulty are *relative estimates* based on the competitive landscape and search-intent research — not precise numbers. Connect Ahrefs or Semrush via MCP to auto-populate exact volume, difficulty, and ranking data. Ranking positions could not be pulled because the site does not yet appear to be indexed (see below).

---

## Executive Summary

Redmont Strategies Group has an **unusually strong on-page and technical foundation** for a business of its size — unique titles and meta descriptions on every page, exactly one H1 per page, clean canonical tags, complete Open Graph/Twitter markup, full image alt coverage, and rich `Service` + `BreadcrumbList` + `FAQPage` structured data on all service and industry pages. Most local competitors do not come close to this level of technical polish. **The build quality is not the problem.**

The problem is **visibility and authority**. A `site:redmontstrategiesgroup.com` search returns no pages from the domain, which strongly indicates the site is **not yet indexed** — it has no organic footprint, no Google Business Profile signals, no reviews, no backlinks, and no fresh-content engine. For a brand-new local business, that means the entire SEO opportunity is in **discovery and local trust signals**, not more on-page tweaks.

**Top 3 priorities, in order of impact:**

1. **Get indexed and establish local presence.** Set up Google Search Console, submit the sitemap, and request indexing. Create and fully optimize a Google Business Profile, and add `LocalBusiness`/`ProfessionalService` schema with real NAP (name, address, phone) data. This is the difference between "invisible" and "found."
2. **Do NOT ship the staged URL migration as-is.** Your local working copy converts clean, hyphenated, geo-rich URLs (`/business-consulting-plymouth-county-ma`) into concatenated, no-hyphen slugs (`/businessconsulting`, `/medspabusinessconsultingaiautomation`). This is a step *backward* per Google's own URL guidance. The live URLs are better than the proposed ones. (Details in Technical section.)
3. **Add a content engine and reviews.** A blog/resource hub targeting question-based and local-vertical keywords, plus a review-collection habit, will build the topical authority and trust signals a new domain needs to rank.

**Overall assessment: Strong foundation, held back by zero off-page presence.** The site is built like a site that should rank; it now needs the discovery, local-signal, and authority work that actually earns rankings — and one staged mistake (the URL migration) avoided before it ships.

---

## Keyword Opportunity Table

Opportunity score weighs relevance to RSG's actual pages, search intent, and (inverse) competition. For a new, unindexed local site, **low-competition long-tail and local-vertical terms are the realistic near-term wins**; broad head terms are long-game.

| # | Keyword | Est. Difficulty | Opportunity | Current Rank | Intent | Recommended Content Type |
|---|---------|-----------------|-------------|--------------|--------|--------------------------|
| 1 | business systems audit | Easy | **High** | Not indexed | Commercial | Existing `/systemsaudit` page (own this term) |
| 2 | business consultant plymouth county ma | Moderate | **High** | Not indexed | Commercial | Existing service page (live) |
| 3 | med spa consultant south shore ma | Easy | **High** | Not indexed | Commercial | Existing med spa landing page |
| 4 | small business automation south shore ma | Easy | **High** | Not indexed | Commercial | Existing `/aiautomation` + local page |
| 5 | missed call text back for med spas | Easy | **High** | Not indexed | Commercial | Demo page + supporting blog post |
| 6 | contractor lead management system | Moderate | **High** | Not indexed | Commercial | Contractor landing + demo |
| 7 | crm setup for small business | Moderate | **High** | Not indexed | Commercial | `/crmsystems` + how-to guide |
| 8 | how to automate customer follow up | Low–Mod | **High** | Not indexed | Informational | Blog guide (pillar) |
| 9 | what is a business systems audit | Easy | **High** | Not indexed | Informational | Blog/guide → funnels to `/systemsaudit` |
| 10 | ai automation agency massachusetts | Moderate | Medium | Not indexed | Commercial | `/aiautomation` optimized for geo |
| 11 | operations consultant massachusetts | Low–Mod | Medium | Not indexed | Commercial | `/operationsconsulting` |
| 12 | crm for contractors | Moderate | Medium | Not indexed | Commercial | Contractor landing + comparison |
| 13 | gym membership follow up software | Moderate | Medium | Not indexed | Commercial | Gym landing + demo |
| 14 | ai receptionist for dental office | Low–Mod | Medium | Not indexed | Commercial | Dental landing + blog |
| 15 | how much does a business consultant cost | Low | Medium | Not indexed | Informational | Blog (you answer this in FAQ already) |
| 16 | marketing automation agency massachusetts | Mod–High | Medium | Not indexed | Commercial | Service page + local content |
| 17 | home service business software | Mod–High | Medium | Not indexed | Commercial | Home-service landing |
| 18 | why am i losing leads / slow lead response | Low | Medium | Not indexed | Informational | Blog (speed-to-lead pillar) |
| 19 | contractor business coach massachusetts | Easy | Medium | Not indexed | Commercial | Contractor landing + local page |
| 20 | small business consultant near me | High | Medium | Not indexed | Commercial | Homepage + GBP (map pack play) |
| 21 | med spa marketing automation | Moderate | Medium | Not indexed | Commercial | Med spa landing + blog |
| 22 | ai for small business owners | High | Low | Not indexed | Informational | Blog (top-funnel awareness) |
| 23 | dental office missed call recovery | Low–Mod | Medium | Not indexed | Commercial | Dental landing + demo |
| 24 | best crm for service businesses | Mod–High | Low | Not indexed | Commercial | Comparison/listicle blog |
| 25 | how to get more reviews for my business | Low | Medium | Not indexed | Informational | Blog → ties to reputation service |

**Reading this table:** rows 1–9 are the near-term focus — low competition, high relevance, and mostly served by pages you *already have*. The job there is discovery (indexing + links), not new content. Rows 15, 18, 25 and the other informational terms are the blog roadmap.

---

## On-Page Issues Table

| Page | Issue | Severity | Recommended Fix |
|------|-------|----------|-----------------|
| `/faq` | **No `FAQPage` schema**, despite 6 real Q&A pairs — and you already implement `FAQPage` on every service page | **High** | Add `FAQPage` JSON-LD to `/faq`. Highest-value rich-result opportunity on the site; near-zero effort since the pattern already exists. |
| Site-wide | **No `LocalBusiness`/`ProfessionalService` schema and no NAP address** anywhere | **High** | Upgrade `Organization` schema to `ProfessionalService` with `address` (PostalAddress), `geo`, `openingHours`, `priceRange`, and `sameAs` (social/GBP). Critical for local pack. |
| `/faq` | FAQ questions are in `<span>`, not headings — page has **0 H2/H3** | Medium | Mark each question as an `<h2>` or `<h3>`. Improves semantic structure, accessibility, and FAQ eligibility. |
| Homepage | Title 74 chars — truncates in SERPs; brand name first pushes keywords to the truncated tail | Medium | Front-load the keyword: e.g. "Business & AI Consulting in Plymouth County, MA \| RSG" (~55 chars). |
| `/operationsconsulting` (71), `/businessconsulting` (69), `/webdevelopment` (69), `/servicearea` (68) | Titles exceed ~60 chars → truncation | Medium | Trim to ≤60. Keep primary keyword + geo; shorten or drop the full brand name to "RSG". |
| `/servicearea` (185), `/demos/contractors` (173), `/businessconsulting` (171), `/demos/dental` (171) | Meta descriptions exceed ~160 chars → truncation | Low–Med | Trim to 150–160 chars; keep the CTA and primary keyword in the first 120 chars. |
| `/book/consultation`, `/book/strategy`, `/login` | **Duplicate meta description** (reuse the generic homepage boilerplate) | Medium | Write unique descriptions matching each page's intent. |
| `/book`, `/book/consultation`, `/book/strategy` | **Missing canonical tag** (but present in sitemap) | Medium | Add self-referencing canonicals. Prevents param/duplicate ambiguity. |
| `/login` | Disallowed in robots.txt **and** linked sitewide in footer; carries `index, follow` | Low | Remove the footer link (or move behind auth) to avoid an "indexed though blocked" notice. It shouldn't be a crawl target at all. |
| `/demos/*` | Very heavy HTML (up to 247 KB) from inline interactive demos | Low | Fine for UX, but monitor Core Web Vitals; lazy-load below-the-fold demo widgets. |

Everything else on-page checks out: unique titles, single H1 per page, full alt-text coverage, logical heading hierarchy on content pages, clean internal linking via the footer.

---

## Content Gap Recommendations

The site is all bottom-funnel (service + landing + booking pages). There is **no top-funnel content** — no blog, guides, or comparison pages — which is both the biggest content gap and the biggest untapped keyword surface.

| Gap | Why it matters | Format | Priority | Effort |
|-----|----------------|--------|----------|--------|
| **No blog / resource hub** | Competitors (South Shore Digital Marketing, Sandy Neck Media) publish content; it's how new sites earn topical authority and capture informational search. You have none. | Blog section + 6–10 launch posts | **High** | Substantial (multi-day) |
| Speed-to-lead / follow-up pillar | You *sell* this ("fix lead flow and follow-up") but rank for none of the searches around it. Strong intent match. | Pillar guide + cluster posts (missed-call recovery, 5-minute rule, follow-up automation) | **High** | Moderate |
| "What a Business Systems Audit is / costs" | You own the term "Business Systems Audit" but there's no explainer to rank and funnel to the offer. | Guide/landing hybrid | **High** | Moderate (half day) |
| Per-industry education (med spa, dental, gym, contractor, home service) | You have landing pages but no supporting content to build cluster authority around each vertical. | 1–2 blog posts per vertical, internally linked to each landing page | Medium | Substantial |
| City/town-level local pages | You target the *county*; competitors target *towns* (Weymouth, Plymouth, Norwell). Town-level pages capture "[service] + [town]" searches and feed the map pack. | Localized landing pages for 4–6 core towns | Medium | Moderate |
| Comparison / "how to choose" content | Captures commercial-investigation intent ("best CRM for contractors", "AI vs. hiring a receptionist"). | Comparison posts | Medium | Moderate |
| Case studies / results | New site has no proof. Even 1–2 anonymized before/after stories build trust and earn links. | Case study pages | Medium | Moderate (needs client data) |
| Freshness signal | Nothing on the site changes; a cadence of new posts signals an active, maintained site. | Ongoing (2–4 posts/month) | Medium | Ongoing |

---

## Technical SEO Checklist

| Check | Status | Details |
|-------|--------|---------|
| HTTPS | ✅ Pass | Secure, HTTP→HTTPS upgrade in place. |
| Mobile viewport | ✅ Pass | `width=device-width, initial-scale=1` on every page. |
| One H1 per page | ✅ Pass | All 30 pages have exactly one H1. |
| Image alt text | ✅ Pass | 100% coverage (site is mostly inline SVG + logos). |
| Canonical tags | ⚠️ Warning | Present and correct on most pages; **missing on `/book`, `/book/consultation`, `/book/strategy`, `/login`**. |
| XML sitemap | ⚠️ Warning | Live sitemap is correct (hyphenated URLs). **Local sitemap lists concatenated URLs that 404 in production** — do not deploy it without the matching pages + redirects. |
| robots.txt | ✅ Pass | Sensible disallows (`/admin`, `/dashboard`, `/portal`, `/login`, `/api/`, `/thankyou`); sitemap referenced. |
| Structured data (Org, Service, FAQ, Breadcrumb) | ✅ Pass | Genuinely strong. Service + BreadcrumbList + FAQPage on all 13 service/industry pages. |
| `LocalBusiness`/`ProfessionalService` schema | ❌ Fail | Absent site-wide. No PostalAddress, geo, openingHours, or priceRange. Biggest structured-data gap for a local business. |
| `FAQPage` on the FAQ page | ❌ Fail | The one page most deserving of it doesn't have it (service pages do). |
| Review / `aggregateRating` schema | ⚠️ N/A | None present — correctly, since there are no real reviews yet. Add once you collect genuine reviews (never fabricate). |
| Indexation | ❌ Fail | `site:` search returns no pages from the domain → site appears **not indexed**. Verify and fix via Google Search Console. |
| URL structure (live/production) | ✅ Pass | Clean, hyphenated, keyword- and geo-rich. Good as-is. |
| URL structure (staged local migration) | ❌ Fail | Converts to concatenated, no-hyphen slugs — a regression. See below. |
| 301 redirects for the migration | ⚠️ Warning | None found. If you *do* change any URL, add 301s old→new. |
| Custom 404 | ✅ Pass | Branded "Page not found" with a route home. |
| Open Graph / Twitter cards | ✅ Pass | Complete, with 1200×630 images that exist. |
| Google Business Profile | ❌ Fail / Unknown | No `sameAs` link or GBP signal detected. Create and verify one — essential for local. |
| Page speed / Core Web Vitals | ⚠️ Warning | Demo pages are heavy (up to 247 KB HTML). Monitor in PageSpeed Insights/CrUX once traffic exists. |

### The URL migration — the one thing to stop before it ships

Your **production site currently uses good URLs**: `/business-consulting-plymouth-county-ma`, `/med-spa-business-consulting-ai-automation`, `/gym-fitness-studio-business-systems`. These are hyphen-separated (Google's recommended word separator), readable, and carry the geo modifier.

Your **local working copy replaces them** with `/businessconsulting`, `/medspabusinessconsultingaiautomation`, `/gymfitnessstudiobusinesssystems` — concatenated, no hyphens, some with the geo removed. This is worse for SEO on two counts:

1. **No word separators.** Google explicitly recommends hyphens so it can parse words. `medspabusinessconsultingaiautomation` is 37 characters of unbroken text that neither search engines nor humans can tokenize cleanly.
2. **Lost geo signal** in the slugs that drop `-plymouth-county-ma`.

**Recommendation:** Do not ship this migration. Keep the live hyphenated URLs. If the goal is shorter URLs (the geo-stuffed ones *are* long), shorten them *while keeping hyphens* — e.g. `/business-consulting`, `/med-spa-consulting` — and add **301 redirects** from every old URL to its replacement. Because the site isn't indexed yet, **now is the cheapest possible moment to finalize URLs** — but concatenation is the wrong direction. Decide the final structure once, then let Google index it.

---

## Competitor Comparison Summary

Identified local competitors (Plymouth County / South Shore MA). All are established "digital marketing / SEO / web design" shops — **none lead with RSG's "AI automation + business systems" positioning**, which is RSG's clearest differentiation.

| Dimension | Redmont Strategies Group | South Shore Digital Marketing | Sandy Neck Media | Winner |
|-----------|--------------------------|-------------------------------|------------------|--------|
| On-page / technical SEO | Excellent (schema, meta, structure) | Standard agency site | Standard agency site | **RSG** |
| Positioning / differentiation | AI automation + systems (distinct) | SEO/PPC/web design (generic) | Contractor lead-gen (focused) | **RSG** |
| Local vertical targeting | 5 verticals + demos (strong) | Broad | Contractors/trades (deep) | Tie |
| Content depth / blog | **None** | Has content/blog | Has content/service pages | **Competitors** |
| Publishing frequency | None | Ongoing | Ongoing | **Competitors** |
| Backlink / authority signals | ~None (new domain) | Established | Established | **Competitors** |
| Google Business Profile / reviews | **None detected** | Present | Present | **Competitors** |
| Indexation / organic footprint | Not indexed | Indexed, ranking | Indexed, ranking | **Competitors** |

**Read:** RSG wins on build quality and positioning but loses on every signal that actually drives local rankings — content, links, reviews, GBP, and simply *being in the index*. Closing those closes the gap fast, because the foundation is already better than theirs.

---

## Prioritized Action Plan

### Quick Wins (do this week — each under ~2 hours)

| Action | Expected impact | Effort | Dependencies |
|--------|-----------------|--------|--------------|
| Set up **Google Search Console**, submit sitemap, request indexing | **High** — precondition for ranking at all | 1 hr | Domain access |
| Add **`FAQPage` schema** to `/faq` | High — rich-result eligibility, reuse existing pattern | 30 min | — |
| Create/claim **Google Business Profile** (name, categories, service area, phone) | **High** — unlocks local/map visibility | 1–2 hrs | Business verification |
| Trim over-length **titles** (homepage, operations, web dev, service area, business consulting) | Medium — full SERP display, better CTR | 45 min | — |
| Trim over-length **meta descriptions** (service area, demos, business consulting) | Medium | 30 min | — |
| Write **unique meta descriptions** for `/book/*` and `/login` | Low–Med | 30 min | — |
| Add **canonical tags** to `/book`, `/book/consultation`, `/book/strategy` | Medium | 20 min | — |
| Make **FAQ questions real headings** (`h2`/`h3`) | Medium | 30 min | — |
| Remove **`/login`** from the sitewide footer | Low | 10 min | — |

### Strategic Investments (plan for this quarter)

| Action | Expected impact | Effort | Dependencies |
|--------|-----------------|--------|--------------|
| **Finalize URL structure and do NOT ship concatenated slugs.** Keep hyphens; add 301s if shortening | **High** — avoids a self-inflicted ranking reset | Half day (decision + config) | Vercel/Next config access |
| Add **`ProfessionalService` schema + NAP** (address, geo, hours, priceRange, sameAs) | **High** — local pack + entity trust | Half day | Business address/hours |
| Build **local citations** (chamber of commerce, BBB, Yelp, Apple Maps, Bing Places) with consistent NAP | **High** — local ranking factor + discovery | Ongoing, 1–2 wks | GBP first |
| Launch a **blog / resource hub**; publish the speed-to-lead pillar + "Business Systems Audit" guide first | **High** — topical authority + informational traffic | Multi-day, then ongoing | Content plan |
| Earn **initial backlinks** (local partners, vendor pages, guest posts, directories) | **High** — domain authority for a new site | Ongoing | — |
| Start **collecting reviews** → later add `Review`/`aggregateRating` schema (real data only) | Medium–High — trust + CTR + rich stars | Ongoing | Client base |
| Add **town-level local pages** (Plymouth, Hingham, Marshfield, Weymouth, Duxbury) | Medium — "[service] + [town]" + map pack | Multi-day | Content plan |
| Per-vertical **cluster content** linked to each industry landing page | Medium — cluster authority | Ongoing | Blog live |

---

## Suggested Next Steps

I can immediately follow up with any of these:

- Draft **content briefs** for the top keyword opportunities (rows 1–9 and the blog pillars).
- Write **optimized title tags and meta descriptions** for every page as copy-paste-ready replacements.
- Generate the **`FAQPage` and `ProfessionalService` JSON-LD** blocks, ready to drop in.
- Build a **content calendar** from the gap analysis (per-vertical + informational).
- Produce the **301 redirect map** if you decide to shorten any URLs.
- Re-run this audit against a specific competitor for a deeper head-to-head.
