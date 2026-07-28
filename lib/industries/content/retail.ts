import type { IndustryVertical } from "../types";

/**
 * Default content for the Retail & Multi-Location Businesses vertical.
 *
 * Honesty rules: no invented statistics, no client names, no guarantees.
 * The case study is explicitly illustrative; all ROI figures are estimates
 * driven by the visitor's own inputs and the stated assumptions.
 */
export const retailVertical: IndustryVertical = {
  slug: "retail",
  status: "published",
  name: "Retail & Multi-Location Businesses",
  shortName: "Retail & Multi-Location",
  audience: [
    "Specialty retail",
    "Local retail chains",
    "Franchise locations",
    "Showrooms",
    "In-store + online hybrid businesses",
  ],
  terminology: {
    customer: "customer",
    customers: "customers",
    job: "order",
    jobs: "orders",
    team: "staff",
  },

  hero: {
    eyebrow: "Retail & Multi-Location Businesses",
    headline: "Every location, every order, every customer — one connected picture.",
    subheadline:
      "RSG builds and operates the systems that keep inventory honest across locations, bring one-time shoppers back, and put every store's numbers in one place — connected to the POS and ecommerce platforms you already run.",
    primaryCta: {
      label: "Assess Your Retail Operations and Customer Journey",
      href: "#assessment",
    },
    demoCta: {
      label: "Explore the Retail Operations Demo",
      href: "/demos/retail",
    },
    designedFor:
      "Designed for specialty retailers, local chains, franchise locations, and showrooms — especially businesses selling both in store and online. If your customers, stock, and reporting live in systems that don't talk to each other, this page is about you.",
  },

  problemsIntro:
    "These are the failure points we find inside retail and multi-location businesses. Individually each one looks like a minor annoyance. Added up, they are usually the difference between a store that compounds and a store that plateaus.",
  problems: [
    {
      id: "inventory-inconsistency",
      title: "Inventory counts that disagree between locations",
      detail:
        "The POS at one store says twelve units, the shelf says four, and the warehouse spreadsheet says something else entirely. Transfers, returns, and shrink go unrecorded until the annual count, so nobody fully trusts the number they are looking at.",
      cost: "A customer told an item is in stock who finds an empty shelf rarely gives the store a second chance.",
    },
    {
      id: "disconnected-pos-ecommerce",
      title: "A POS and an online store that don't talk to each other",
      detail:
        "In-store sales and online orders live in separate systems with separate customer lists and separate stock pools. The website happily sells the last unit that walked out the door an hour ago.",
      cost: "Overselling online what just sold in store turns revenue into refund emails.",
    },
    {
      id: "weak-retention",
      title: "Customers who buy once and vanish",
      detail:
        "Most transactions close without capturing a name, a number, or consent to follow up, so the customer is a stranger the moment the receipt prints. There is no welcome, no reason to return, and no way to notice when a regular goes quiet.",
      cost: "Every one-time buyer means paying full acquisition cost again for the next sale.",
    },
    {
      id: "inconsistent-reporting",
      title: "Store-level reporting that never adds up the same way twice",
      detail:
        "Each location's manager reports in a different format, on a different schedule, from a different system. Consolidating it means hours of spreadsheet work, and the result is a snapshot that was already stale when it was finished.",
      cost: "Decisions made on last month's hand-built numbers are made on a picture that has already changed.",
    },
    {
      id: "manual-workflows",
      title: "Staff hours consumed by manual routines",
      detail:
        "Orders re-keyed between systems, pickup texts typed by hand, transfer sheets passed around, closing checklists on paper. None of it is hard — it is just constant, and it happens at every location, every day.",
      cost: "An hour of floor staff re-keying orders is an hour not spent selling.",
    },
    {
      id: "product-visibility",
      title: "No clear picture of what's actually selling",
      detail:
        "Sales velocity by product, category, and location is technically in the POS somewhere, but nobody sees it week to week. Slow movers accumulate quietly and get discovered at year-end, when the only option left is a deep markdown.",
      cost: "Cash sitting in slow movers is cash you can't put into best-sellers.",
    },
    {
      id: "abandoned-carts",
      title: "Online carts abandoned in silence",
      detail:
        "A shopper loads a cart, hesitates at shipping or checkout, and leaves. Without a timed reminder the sale simply evaporates, and most stores never even measure how much abandoned-cart value walks away each month.",
      cost: "An abandoned $90 cart with no follow-up is a $90 decision made for you.",
    },
    {
      id: "limited-segmentation",
      title: "Everyone on the list gets the same email",
      detail:
        "Without segmentation by category, spend, or recency, the only available move is the blast — one message to the entire list. Blasts train customers to ignore you, and every irrelevant send burns unsubscribes you will want later.",
      cost: "Untargeted blasts spend the audience's attention on messages that were never meant for them.",
    },
    {
      id: "inconsistent-promotions",
      title: "Promotions that run differently at every location",
      detail:
        "One store honors a promotion another store never heard about; signage, pricing, and end dates drift by location. The register conversation that follows is awkward for staff and corrosive for customers.",
      cost: "A promotion honored inconsistently costs margin at one store and trust at another.",
    },
    {
      id: "no-unified-profile",
      title: "No single view of the customer",
      detail:
        "The person who shops your website and the person who walks into your store are the same customer stored as two unrelated records. Staff can't see purchase history at the register, and marketing can't see in-store behavior at all.",
      cost: "A VIP treated like a stranger at the register eventually stops behaving like a VIP.",
    },
    {
      id: "attribution-guesswork",
      title: "Marketing attribution by gut feel",
      detail:
        "Money goes to Meta, Google, and email every month, but nobody can say which channel produced which orders. Budgets get renewed by habit rather than evidence.",
      cost: "Spending on a channel you can't measure is a bet renewed monthly by default.",
    },
    {
      id: "slow-responses",
      title: "Customer questions that wait hours for an answer",
      detail:
        "Sizing questions, stock checks, and policy questions arrive by phone, DM, and email — usually during the exact hours the floor is busiest. By the time someone answers, the shopper has often already decided elsewhere.",
      cost: "A stock question answered tomorrow is usually answered for a competitor's benefit.",
    },
  ],

  workflow: {
    title: "The retail customer journey, stage by stage",
    intro:
      "Eleven stages from first discovery to the owner's report. Every stage has known failure modes, a named RSG system responsible for it, and numbers worth watching. This is the map we use during scoping.",
    stages: [
      {
        id: "customer-discovered",
        label: "Customer discovered",
        happens:
          "A shopper finds you through an ad, a search, a social post, a referral, or the storefront itself. Which channel produced them is knowable at this exact moment — and in most stores it is lost immediately.",
        failures: [
          "No tracking discipline, so most orders show up as \"direct\" with no source",
          "Ad budgets spread evenly across channels instead of weighted by performance",
          "Social DMs asking basic questions sit unanswered for hours",
          "No way to connect a walk-in to the campaign that produced the visit",
        ],
        system: "RSG Promotion & Campaign Automation System",
        automations: [
          "Source capture on every inbound order, call, and inquiry",
          "Campaign tracking links applied automatically to email, SMS, and ads",
          "New-inquiry alerts routed to the right staff member",
        ],
        kpis: [
          "Cost per acquired customer by channel",
          "Revenue attributed per campaign",
          "Share of orders with a known source",
        ],
        integrations: ["Meta", "Google Ads", "Klaviyo"],
      },
      {
        id: "product-viewed",
        label: "Product viewed",
        happens:
          "The shopper studies a product page, or picks the item up on the floor and has a question — sizing, availability, comparisons. How fast that question gets answered decides whether the visit continues.",
        failures: [
          "Sizing and stock questions sit in DMs and voicemail during floor rushes",
          "Product pages missing the one detail that would close the decision",
          "No record that interest ever existed if the shopper leaves",
          "Staff can't check another location's stock while the customer waits",
        ],
        system: "RSG Customer Service Assistant",
        automations: [
          "Instant answers to product, stock, hours, and policy questions from your own playbook",
          "Cross-location stock lookups surfaced to staff and customers",
          "Routing to a named staff member when the question needs a human",
        ],
        kpis: [
          "Median response time to product questions",
          "Product-page conversion rate",
          "Share of questions resolved without staff involvement",
        ],
        integrations: ["Shopify", "Gorgias", "Zendesk"],
      },
      {
        id: "cart-or-store-visit",
        label: "Cart or store visit",
        happens:
          "Online, the item goes into a cart; in store, the shopper is deciding at the rack. This is the highest-intent moment in the entire journey, and the one most retailers leave completely unmanaged.",
        failures: [
          "Carts abandoned at shipping cost or checkout friction with zero follow-up",
          "In-store shoppers who leave \"to think about it\" and are never contactable again",
          "Discount codes that fail silently at checkout and kill the sale",
          "No measurement of how much abandoned value walks away monthly",
        ],
        system: "RSG Ecommerce Recovery System",
        automations: [
          "Timed abandoned-cart reminders with live stock counts",
          "Hold-at-register offers for in-store deciders",
          "Checkout-error monitoring with same-day alerts",
        ],
        kpis: [
          "Cart abandonment rate",
          "Recovered-cart revenue",
          "Checkout completion rate",
        ],
        integrations: ["Shopify", "WooCommerce", "Klaviyo"],
      },
      {
        id: "purchase-completed",
        label: "Purchase completed",
        happens:
          "The sale closes at the register or online checkout. Payment, the order record, fulfillment, and the customer's history should all update from this one event. In most stores it updates one system and leaves the rest stale.",
        failures: [
          "Online and POS orders living in separate systems that reconcile monthly, if ever",
          "Order data re-keyed by hand into accounting",
          "Pickup orders coordinated by sticky note and shouted names",
          "Payment records that drift from the books until someone hunts the difference",
        ],
        system: "RSG Retail Operations Hub",
        automations: [
          "Order sync across POS, ecommerce, and accounting",
          "Pickup-ready notifications sent automatically",
          "Contact and consent capture at the moment of sale",
        ],
        kpis: [
          "Average order value by channel",
          "Orders per week by location",
          "Share of orders linked to a customer profile",
        ],
        integrations: ["Shopify POS", "Square", "Stripe"],
      },
      {
        id: "inventory-updated",
        label: "Inventory updated",
        happens:
          "Every sale, return, and transfer should adjust stock across every channel in near-real time. When it doesn't, the store sells what it doesn't have and hides what it does.",
        failures: [
          "The online store overselling units that just sold on the floor",
          "Reorder points nobody set and nobody reviews",
          "Slow movers accumulating for months with no flag",
          "Transfers between locations tracked in text threads",
        ],
        system: "RSG Inventory Intelligence System",
        automations: [
          "Low-stock alerts with draft purchase orders grouped by supplier",
          "Slow-mover and overstock flags with markdown suggestions",
          "Cross-location stock visibility for every staff member",
        ],
        kpis: [
          "Stockout frequency on top sellers",
          "Inventory turns by category",
          "Shrink and write-down value",
        ],
        integrations: ["Shopify", "Lightspeed", "ShipStation"],
      },
      {
        id: "customer-profile-created",
        label: "Customer profile created",
        happens:
          "The buyer becomes a record: contact, consent, purchase history, preferences, preferred channel. Done well this is a five-second capture at checkout. Skipped, the customer is anonymous forever.",
        failures: [
          "Cashiers skipping capture during rushes because it takes too long",
          "Online and in-store purchases creating duplicate, unlinked records",
          "Consent never recorded, making future marketing legally shaky",
          "Sizes and preferences living in one staff member's memory",
        ],
        system: "RSG Retail Operations Hub",
        automations: [
          "POS and checkout contact capture with explicit consent recorded",
          "Automatic merge of online and in-store records into one profile",
          "Preference and category tagging from purchase history",
        ],
        kpis: [
          "Contact-capture rate at checkout",
          "Duplicate-record rate",
          "Share of customers with recorded marketing consent",
        ],
        integrations: ["Shopify POS", "Square", "Klaviyo"],
      },
      {
        id: "post-purchase-communication",
        label: "Post-purchase communication",
        happens:
          "The hours and days after a purchase decide whether it was a transaction or the start of a relationship. Order confirmations, pickup notices, and a well-timed welcome do that work. Silence does the opposite.",
        failures: [
          "No welcome of any kind after a first purchase",
          "Shipping questions answered manually, one at a time",
          "Pickup orders sitting ready with no notification sent",
          "The receipt being the only post-purchase message a customer ever gets",
        ],
        system: "RSG Customer Loyalty & Retention Engine",
        automations: [
          "Welcome sequence within the hour of a first purchase",
          "Shipping and pickup status notifications",
          "Day-seven check-in tuned to what the customer actually bought",
        ],
        kpis: [
          "Welcome-sequence engagement rate",
          "Repeat-contact rate in the first 30 days",
          "Average pickup wait time",
        ],
        integrations: ["Klaviyo", "Mailchimp", "ShipStation"],
      },
      {
        id: "review-or-loyalty-invitation",
        label: "Review or loyalty invitation",
        happens:
          "A satisfied buyer will leave a review and join a loyalty program — if asked at the right moment, which is shortly after the purchase proved out, not months later. Most stores ask inconsistently or not at all.",
        failures: [
          "Review requests depending on staff remembering to ask",
          "Unhappy customers discovered in public reviews instead of private feedback",
          "A loyalty program that exists but is never offered at checkout",
          "Points and perks that nobody explains and nobody redeems",
        ],
        system: "RSG Customer Loyalty & Retention Engine",
        automations: [
          "Timed review requests that capture feedback privately first",
          "Loyalty enrollment offered from the welcome message",
          "Reward and tier-progress notifications",
        ],
        kpis: [
          "Reviews per 100 orders",
          "Average rating trend",
          "Loyalty enrollment rate at checkout",
        ],
        integrations: ["Klaviyo", "Mailchimp"],
      },
      {
        id: "personalized-promotion",
        label: "Personalized promotion",
        happens:
          "The customer's own history says what to offer and when: the candle buyer hears about the new candle collection, the top-decile spender gets early access. Generic blasts are what happens when this stage is skipped.",
        failures: [
          "One identical email to the entire list, every time",
          "Promotions untethered from stock — marketing what is nearly sold out",
          "No differentiated treatment for the customers who fund the business",
          "Discounts handed to customers who would have paid full price",
        ],
        system: "RSG Promotion & Campaign Automation System",
        automations: [
          "Segment-driven campaigns by category, spend, and recency",
          "VIP and early-access invitations for top customers",
          "Promotion-to-inventory checks before anything sends",
        ],
        kpis: [
          "Campaign-attributed revenue",
          "Open and click-through rates by segment",
          "Unsubscribe rate per send",
        ],
        integrations: ["Klaviyo", "Mailchimp", "Meta"],
      },
      {
        id: "repeat-purchase",
        label: "Repeat purchase",
        happens:
          "The second purchase is the hinge of retail economics: a customer who buys twice behaves differently from one who bought once. Getting there means noticing silence and acting on it before the customer lapses for good.",
        failures: [
          "Nobody noticing when a regular goes quiet",
          "Win-back attempts that are generic, late, or nonexistent",
          "At-risk customers receiving the same messaging as loyal ones",
          "Lapsed customers written off without a single attempt",
        ],
        system: "RSG Customer Loyalty & Retention Engine",
        automations: [
          "At-risk detection after a configurable quiet period",
          "30/60/90-day win-back sequences personalized by purchase history",
          "Birthday and milestone offers with redemption tracking",
        ],
        kpis: [
          "Repeat-purchase rate",
          "Time between first and second purchase",
          "Win-back conversion rate",
          "Customer lifetime value",
        ],
        integrations: ["Shopify", "Shopify POS", "Klaviyo"],
      },
      {
        id: "location-product-reporting",
        label: "Location & product reporting",
        happens:
          "The owner needs one answer to \"how did we do, where, and on what\" across every location and channel. In most multi-location retailers that answer is assembled by hand, differently every month, by someone who has better things to do.",
        failures: [
          "Each location reporting in its own format on its own schedule",
          "Hours of spreadsheet consolidation to produce a number nobody fully trusts",
          "Store-versus-online comparisons that never actually get made",
          "Product performance invisible until the accountant's month-end",
        ],
        system: "RSG Multi-Location Reporting Platform",
        automations: [
          "Daily owner summary across all locations and channels",
          "Automatic consolidation of POS, ecommerce, and accounting data",
          "Exception alerts when a location or product breaks its trend",
        ],
        kpis: [
          "Revenue by location and channel",
          "Sell-through rate by category",
          "Manual reporting hours per month",
          "Margin by product line",
        ],
        integrations: ["Shopify POS", "Lightspeed", "QuickBooks", "Xero"],
      },
    ],
  },

  demoSlug: "retail",
  demo: {
    title: "Walk through the Retail Growth System",
    description:
      "A hands-on simulation of the system running for Harbor & Pine Outfitters, a fictional coastal apparel and home-goods store with one storefront and an online shop. You can explore it as the owner, the store manager, or the sales floor — everything is clickable, and nothing in it is real.",
    highlights: [
      "A retention pipeline that tracks every customer from first purchase through VIP — and flags the ones going quiet",
      "The Harbor Club loyalty program with three tiers, a rewards catalog, and live member activity",
      "Inventory with reorder points, low-stock and slow-mover flags, and draft purchase orders grouped by supplier",
      "A conversation inbox spanning SMS, web chat, Instagram, and email — plus an AI store assistant that handles a missed Saturday-rush call end to end",
      "Active campaigns — welcome series, 30-day win-back, VIP early access, abandoned-cart recovery — each with sent, replied, and converted counts",
      "Review requests that ask for feedback privately first and route concerns to a manager instead of the public page",
      "A bulk and custom order quote builder for corporate gifts and team apparel",
      "Analytics comparing channels and sources, a shopper-to-repeat-customer funnel, and the daily owner summary",
    ],
    simulations: [
      "A customer making a purchase",
      "Inventory updating automatically",
      "Adding the customer to a loyalty segment",
      "Triggering a post-purchase message",
      "Recovering an abandoned cart",
      "Sending a personalized promotion",
      "Comparing performance across channels and locations",
    ],
    disclaimer:
      "The demo is a fully simulated environment populated entirely with fictional sample data — a made-up store, made-up customers, made-up numbers. It never touches real customer data, and nothing you do inside it affects any real system.",
  },

  systemsIntro:
    "Seven named systems, built and operated by RSG. Each one is responsible for a specific set of the failure points above; together they form the connected picture. Every engagement is scoped individually against your platforms, locations, and volume — there is no off-the-shelf bundle.",
  systems: [
    {
      id: "retail-operations-hub",
      name: "RSG Retail Operations Hub",
      outcome:
        "One connected record of every order, customer, and conversation across every location and channel.",
      capabilities: [
        "Unified customer profiles that merge POS and online purchase history into one record",
        "Order sync across POS, ecommerce, and accounting",
        "A single conversation inbox across SMS, email, and social with routing to staff",
        "Contact and consent capture built into every checkout",
        "Task and pickup coordination across locations",
        "A daily owner summary covering revenue, stock, reviews, and campaigns",
      ],
      timeline: "4–8 weeks",
      pricing: "Custom quote",
      integrations: ["Shopify", "Shopify POS", "Square", "Klaviyo", "QuickBooks", "Gorgias"],
      flagship: true,
    },
    {
      id: "inventory-intelligence",
      name: "RSG Inventory Intelligence System",
      outcome:
        "Stock levels you can trust, with reorders and markdowns flagged before they cost money.",
      capabilities: [
        "Stock synchronized across locations and sales channels",
        "Reorder-point alerts with draft purchase orders grouped by supplier",
        "Slow-mover and overstock flags with suggested markdown depth",
        "Velocity reporting by SKU, category, and location",
        "Shrink and discrepancy tracking between counts",
      ],
      timeline: "3–6 weeks",
      pricing: "Custom quote",
      integrations: ["Shopify", "Lightspeed", "Square", "ShipStation", "QuickBooks"],
    },
    {
      id: "loyalty-retention",
      name: "RSG Customer Loyalty & Retention Engine",
      outcome:
        "One-time buyers systematically turned into repeat customers through loyalty tiers, timed follow-up, and win-backs.",
      capabilities: [
        "Points, tiers, and rewards tied to the unified customer profile",
        "Welcome sequences that start within the hour of a first purchase",
        "At-risk detection with 30/60/90-day win-back campaigns",
        "Birthday and milestone offers with redemption tracking",
        "Review requests that capture feedback privately before asking publicly",
      ],
      timeline: "3–6 weeks",
      pricing: "Custom quote",
      integrations: ["Shopify POS", "Square", "Klaviyo", "Mailchimp"],
    },
    {
      id: "ecommerce-recovery",
      name: "RSG Ecommerce Recovery System",
      outcome:
        "Abandoned carts, stalled checkouts, and unanswered product questions recovered instead of written off.",
      capabilities: [
        "Timed abandoned-cart sequences with live stock counts in the message",
        "Browse-abandonment follow-up for identified visitors",
        "Checkout-error monitoring and same-day alerts",
        "Back-in-stock notifications tied to real inventory",
        "Recovered-revenue attribution so you know what the system paid back",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["Shopify", "WooCommerce", "Klaviyo", "Stripe"],
    },
    {
      id: "multi-location-reporting",
      name: "RSG Multi-Location Reporting Platform",
      outcome:
        "Every location's revenue, inventory, and customer numbers consolidated automatically into one consistent picture.",
      capabilities: [
        "Automatic consolidation of POS, ecommerce, and accounting data",
        "Location and channel comparison dashboards",
        "Product and category sell-through reporting",
        "Exception alerts when a location or product breaks its trend",
        "Scheduled summaries for owners and store managers",
      ],
      timeline: "3–6 weeks",
      pricing: "Custom quote",
      integrations: ["Shopify POS", "Lightspeed", "Clover", "QuickBooks", "Xero"],
    },
    {
      id: "customer-service-assistant",
      name: "RSG Customer Service Assistant",
      outcome:
        "Product, stock, order, and policy questions answered in seconds across phone, web, and social — with a clean handoff to staff when it matters.",
      capabilities: [
        "Instant answers to sizing, stock, hours, and policy questions from your own playbook",
        "Missed-call text-back so busy-hour calls become conversations instead of losses",
        "Order-status and pickup lookups without staff involvement",
        "Hold-at-register and reserve offers that convert questions into sales",
        "Routing to the right staff member with the full conversation attached",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["Gorgias", "Zendesk", "Shopify", "Meta"],
    },
    {
      id: "promotion-automation",
      name: "RSG Promotion & Campaign Automation System",
      outcome:
        "Segmented campaigns that run identically across every location and report the revenue they actually produced.",
      capabilities: [
        "Segment-driven email and SMS campaigns by category, spend, and recency",
        "Consistent promotion execution and end dates across all locations",
        "Promotion-to-inventory checks before a campaign sends",
        "VIP and early-access programs for top customers",
        "Per-campaign revenue attribution",
      ],
      timeline: "3–5 weeks",
      pricing: "Custom quote",
      integrations: ["Klaviyo", "Mailchimp", "Meta", "Google Ads"],
    },
  ],

  integrations: {
    intro:
      "RSG systems connect to the platforms you already run rather than replacing them. These are the integrations we most commonly build against in retail engagements.",
    disclaimer:
      "Integration availability depends on each platform's API, plan tier, and account permissions, and is verified during scoping. RSG builds and maintains these connections on your behalf and does not claim official partnerships with any platform listed here.",
    items: [
      {
        name: "Shopify",
        category: "Ecommerce & POS",
        connects:
          "Syncs online orders, the product catalog, stock levels, and customer records into the unified profile and inventory picture.",
      },
      {
        name: "Shopify POS",
        category: "Ecommerce & POS",
        connects:
          "Brings in-store transactions, register-level contact capture, and per-location stock into the same records as online sales.",
      },
      {
        name: "Square",
        category: "Ecommerce & POS",
        connects:
          "Pulls in-store sales, item libraries, and customer directory entries into unified profiles and consolidated reporting.",
      },
      {
        name: "Lightspeed",
        category: "Ecommerce & POS",
        connects:
          "Feeds per-location inventory, sales, and supplier data into reorder alerts and multi-location reporting.",
      },
      {
        name: "Clover",
        category: "Ecommerce & POS",
        connects:
          "Brings register transactions and location-level sales into the consolidated reporting and customer records.",
      },
      {
        name: "WooCommerce",
        category: "Ecommerce & POS",
        connects:
          "Syncs online orders, carts, and customer accounts into recovery sequences and the unified customer profile.",
      },
      {
        name: "Stripe",
        category: "Payments & accounting",
        connects:
          "Ties payment events, refunds, and payout data to orders so revenue reporting and recovery attribution reconcile cleanly.",
      },
      {
        name: "QuickBooks",
        category: "Payments & accounting",
        connects:
          "Receives synced sales and fee data by location so the books match the registers without manual re-keying.",
      },
      {
        name: "Xero",
        category: "Payments & accounting",
        connects:
          "Consolidates per-location revenue and cost entries into accounting automatically for month-end reporting.",
      },
      {
        name: "Klaviyo",
        category: "Email & SMS marketing",
        connects:
          "Drives welcome, win-back, cart-recovery, and loyalty sequences using segments built from unified purchase history.",
      },
      {
        name: "Mailchimp",
        category: "Email & SMS marketing",
        connects:
          "Runs segmented campaigns and syncs engagement data back into customer profiles for retention scoring.",
      },
      {
        name: "Meta",
        category: "Advertising",
        connects:
          "Feeds Facebook and Instagram ad and DM activity into source attribution and routes shopping questions into the service inbox.",
      },
      {
        name: "Google Ads",
        category: "Advertising",
        connects:
          "Links ad clicks and conversions to actual orders so channel spend is judged on attributed revenue, not impressions.",
      },
      {
        name: "ShipStation",
        category: "Fulfillment",
        connects:
          "Pulls shipment status into post-purchase notifications and keeps fulfilled orders synced with inventory counts.",
      },
      {
        name: "Gorgias",
        category: "Customer service",
        connects:
          "Centralizes support tickets with order context attached, so service replies reference the customer's real purchase history.",
      },
      {
        name: "Zendesk",
        category: "Customer service",
        connects:
          "Routes escalated customer conversations to staff with the full profile and order history alongside the ticket.",
      },
    ],
  },

  roi: {
    title: "Estimate what the gaps are costing you",
    intro:
      "Enter your own numbers — revenue by channel, cart abandonment, repeat rate, locations — and see what abandoned carts, one-time buyers, inventory losses, and manual reporting add up to. Every assumption in the model is shown and can be questioned.",
    disclaimer:
      "All results are estimates calculated from the inputs you provide and the stated modeling assumptions. They illustrate potential opportunity — they are not guaranteed financial outcomes, and actual results depend on your business, your market, and how any system is implemented and operated.",
    inputs: [
      {
        id: "monthlyOnlineRevenue",
        label: "Monthly online revenue",
        min: 0,
        max: 500000,
        step: 1000,
        defaultValue: 25000,
        format: "currency",
        helper: "Completed online orders per month, before returns.",
      },
      {
        id: "monthlyStoreRevenue",
        label: "Monthly in-store revenue",
        min: 0,
        max: 1000000,
        step: 5000,
        defaultValue: 60000,
        format: "currency",
        helper: "Register sales across all locations combined.",
      },
      {
        id: "abandonedCartRate",
        label: "Abandoned-cart rate",
        min: 0,
        max: 90,
        step: 5,
        defaultValue: 65,
        format: "percent",
        helper: "Share of online checkouts that start but never complete.",
      },
      {
        id: "avgOrderValue",
        label: "Average order value",
        min: 10,
        max: 500,
        step: 5,
        defaultValue: 85,
        format: "currency",
        helper: "Across store and online orders.",
      },
      {
        id: "activeCustomers",
        label: "Active customers",
        min: 100,
        max: 50000,
        step: 100,
        defaultValue: 2500,
        format: "number",
        helper: "Customers who purchased at least once in the last 12 months.",
      },
      {
        id: "repeatPurchaseRate",
        label: "Repeat-purchase rate",
        min: 0,
        max: 90,
        step: 5,
        defaultValue: 25,
        format: "percent",
        helper: "Share of customers who have bought more than once.",
      },
      {
        id: "locations",
        label: "Number of locations",
        min: 1,
        max: 25,
        step: 1,
        defaultValue: 2,
        format: "number",
        helper: "Physical stores; an online store counts as a channel, not a location.",
      },
      {
        id: "inventoryLossRate",
        label: "Inventory loss rate",
        min: 0,
        max: 15,
        step: 1,
        defaultValue: 4,
        format: "percent",
        helper: "Revenue lost to stockouts, shrink, and write-downs, as a share of sales.",
      },
    ],
    assumptions: [
      {
        id: "cartRecoveryRate",
        label: "Cart recovery rate",
        value: 0.1,
        helper:
          "Share of abandoned-cart value assumed to complete after timed reminders. Deliberately conservative.",
      },
      {
        id: "repeatLift",
        label: "Repeat-purchase lift",
        value: 0.05,
        helper:
          "Share of currently one-time customers assumed to make one additional purchase per year with automated follow-up.",
      },
      {
        id: "loyaltyLift",
        label: "Loyalty-program lift",
        value: 0.04,
        helper:
          "Share of active customers assumed to add one order per year after joining a loyalty program.",
      },
      {
        id: "inventoryLossReduction",
        label: "Inventory-loss reduction",
        value: 0.25,
        helper:
          "Assumed reduction in stockout and shrink losses once low-stock alerts and reorder visibility are in place.",
      },
      {
        id: "reportingHoursPerLocation",
        label: "Reporting hours per location",
        value: 5,
        helper:
          "Hours per location per month typically spent consolidating reports by hand — replaced, not billed back.",
      },
    ],
    recommendedSystemId: "retail-operations-hub",
  },

  compliance: {
    title: "Compliance & risk, designed in from the start",
    intro:
      "Retail systems handle payment data, marketing consent, and employee access across multiple locations — each an area with real obligations. These are the controls we design into every retail engagement.",
    disclaimer:
      "RSG does not provide legal, medical, or regulatory advice. Compliance is a property of your complete implementation — the vendors you choose, the procedures you follow, and how you operate the system day to day — not of any single tool. Verify your specific obligations with qualified counsel.",
    items: [
      {
        title: "PCI DSS expectations for payment handling",
        detail:
          "PCI DSS — the card networks' security standard — applies to every business that accepts cards. We design so card data stays inside your payment processor's certified environment, keeping your own systems out of the most burdensome scope.",
      },
      {
        title: "Tokenized payment processing",
        detail:
          "Raw card numbers should never be stored on your systems, full stop. Processors such as Stripe and Square replace card numbers with reference tokens, and every integration we build works with tokens only.",
      },
      {
        title: "Marketing consent for email and SMS",
        detail:
          "Promotional texts and emails require documented opt-in, and SMS in particular carries strict consent rules. We build capture flows that record when and how consent was given, and unsubscribes take effect immediately across every sequence.",
      },
      {
        title: "State privacy rights",
        detail:
          "CCPA-style state laws give customers rights to know what data you hold and to have it deleted. A unified customer profile makes honoring those requests feasible; scattered records across five systems makes it guesswork.",
      },
      {
        title: "Employee access controls",
        detail:
          "Register staff do not need export access to the full customer database, and a departed employee should lose access the day they leave. Role-based permissions and access reviews are part of every implementation.",
      },
      {
        title: "Loyalty-program data handling",
        detail:
          "Points balances, birthdays, and purchase histories are personal data and deserve the same controls as everything else. Program terms should say plainly what is collected and how it is used.",
      },
      {
        title: "Human approval for returns and refunds",
        detail:
          "Automation can draft and route, but moving money back to a customer stays a human decision with an audit trail. No RSG system issues a refund on its own.",
      },
      {
        title: "Fraud monitoring",
        detail:
          "Card testing, refund abuse, and gift-card fraud follow recognizable patterns. We configure alerts for anomalies — refund spikes, repeated declined attempts, unusual redemption bursts — so a human looks before losses compound.",
      },
      {
        title: "Vendor and subprocessor records",
        detail:
          "Every platform that touches customer data should be on a written list stating what it holds and why. That record is what lets you answer a privacy request or a breach question with facts instead of hope.",
      },
      {
        title: "Data-retention controls",
        detail:
          "Customer data should be kept as long as it serves a purpose and no longer. We implement defined retention schedules so lapsed records age out deliberately rather than accumulating as liability.",
      },
    ],
  },

  caseStudy: {
    label: "Illustrative scenario — not a client result",
    businessType: "Specialty apparel and home-goods retailer",
    size: "Three storefronts plus an online store; roughly 20 staff",
    problem:
      "Three locations ran on registers that didn't share data with the online store. The owner rebuilt the numbers in a spreadsheet every Sunday, inventory counts disagreed between stores, the entire email list got one identical monthly blast, and abandoned online carts disappeared without a trace or a total.",
    currentStack: ["Shopify", "Square", "Mailchimp", "QuickBooks", "Google Sheets"],
    implementation: [
      "Deploy the RSG Retail Operations Hub to merge Shopify and Square order and customer records into one profile per customer, with contact and consent capture at every register.",
      "Layer the RSG Inventory Intelligence System across all three stores and the online catalog, with reorder points, low-stock alerts, and slow-mover flags.",
      "Stand up the RSG Ecommerce Recovery System for timed abandoned-cart and back-in-stock sequences.",
      "Launch the RSG Customer Loyalty & Retention Engine — tiers, a welcome series, and 30/60/90-day win-backs replacing the monthly blast.",
      "Replace the Sunday spreadsheet ritual with the RSG Multi-Location Reporting Platform's automated daily summary across locations and channels.",
    ],
    beforeWorkflow: [
      "A customer buys in store; the printed receipt is the last contact the business ever has with her.",
      "The same product oversells online because the floor sale never adjusted web stock.",
      "Abandoned carts expire silently; nobody knows what they were worth in any given month.",
      "Every address on the list gets the same monthly email, regardless of what anyone bought.",
      "The owner spends most of Sunday merging three registers' exports into one spreadsheet.",
      "Stockouts on best-sellers are discovered when a customer asks for one.",
    ],
    afterWorkflow: [
      "Checkout captures contact and consent in seconds; a welcome message with loyalty enrollment follows within the hour.",
      "Every sale adjusts stock across all three stores and the website; reorder alerts arrive with a draft purchase order.",
      "Abandoned carts get a timed reminder with live stock counts, and recovered orders are attributed and totaled.",
      "Campaigns go to segments built from purchase history — category, spend, recency — not to the whole list.",
      "A regular who goes quiet is flagged at 30 days and receives a personalized win-back instead of silence.",
      "The owner reads one daily summary: revenue by location and channel, top products, low stock, and review activity.",
    ],
    timeline:
      "8–12 weeks from scoping to full rollout, phased by location so every store keeps trading throughout.",
    kpis: [
      "Contact-capture rate at checkout",
      "Repeat-purchase rate",
      "Recovered abandoned-cart revenue",
      "Stockout frequency on top sellers",
      "Campaign-attributed revenue",
      "Owner reporting hours per month",
    ],
    projections: [
      {
        label: "Abandoned-cart recovery (modeled)",
        value:
          "Roughly 10% of abandoned checkout value recovered by timed reminders, per the calculator's stated assumption",
      },
      {
        label: "Repeat purchases (modeled)",
        value:
          "About 5% of currently one-time customers modeled as making one additional purchase per year with automated follow-up",
      },
      {
        label: "Inventory losses (modeled)",
        value:
          "Stockout and shrink losses modeled as falling by about a quarter once alerts and reorder visibility are in place",
      },
      {
        label: "Owner reporting time (modeled)",
        value:
          "Sunday consolidation replaced by an automated daily summary — on the order of 15 hours a month returned across three locations",
      },
    ],
    projectionNote:
      "These projections are modeled from the same assumptions used in the ROI calculator above — they are not measured results from a real engagement. They illustrate how the arithmetic works for a business of this shape and are not a promise or guarantee of any particular outcome.",
  },

  ctas: {
    primary: {
      label: "Assess Your Retail Operations and Customer Journey",
      href: "#assessment",
    },
    secondary: [
      { label: "Find Revenue and Inventory Gaps", href: "#roi" },
      { label: "Explore the Retail Operations Demo", href: "/demos/retail" },
      { label: "Build My Retail Growth System", href: "/book" },
    ],
  },

  assessment: {
    title: "Retail Operations & Customer Journey Assessment",
    intro:
      "Twelve questions, about three minutes. Your answers show where orders, stock, and customers are falling through the gaps between your systems — and which RSG system addresses the biggest gap first. No obligation follows.",
    questions: [
      {
        id: "retail-category",
        label: "What kind of retail business are you?",
        type: "select",
        options: [
          "Apparel & accessories",
          "Home goods & furniture",
          "Specialty food & beverage",
          "Gifts & lifestyle",
          "Sporting goods & outdoor",
          "Other specialty retail",
        ],
        required: true,
      },
      {
        id: "locations",
        label: "How many locations do you operate?",
        type: "select",
        options: ["1 location", "2–3 locations", "4–10 locations", "11+ locations", "Online only"],
        required: true,
      },
      {
        id: "ecommerce-platform",
        label: "Which ecommerce platform do you sell on?",
        type: "select",
        options: ["Shopify", "WooCommerce", "Square Online", "None — in-store only", "Other"],
        required: true,
      },
      {
        id: "pos-system",
        label: "Which POS system runs your registers?",
        type: "select",
        options: ["Shopify POS", "Square", "Lightspeed", "Clover", "Other"],
        required: true,
      },
      {
        id: "monthly-transactions",
        label: "Roughly how many orders per month, across all channels?",
        type: "number",
        placeholder: "e.g. 800",
        required: true,
      },
      {
        id: "average-order-value",
        label: "What is your average order value, in dollars?",
        type: "number",
        placeholder: "e.g. 85",
      },
      {
        id: "inventory-process",
        label: "How is inventory managed today?",
        type: "select",
        options: [
          "Spreadsheets and manual counts",
          "Each POS's own reports, per location",
          "Dedicated inventory software",
          "Mostly by walking the floor",
          "Honestly, not sure",
        ],
        required: true,
      },
      {
        id: "loyalty-program",
        label: "What does customer loyalty look like today?",
        type: "select",
        options: [
          "No program today",
          "Paper punch cards",
          "Points built into the POS",
          "A dedicated loyalty app",
          "We have one, but it's rarely used",
        ],
      },
      {
        id: "marketing-platforms",
        label: "Which marketing platforms do you actively use?",
        type: "select",
        options: [
          "Email only (Klaviyo or Mailchimp)",
          "Paid ads only (Meta or Google Ads)",
          "Email and paid ads together",
          "Social posting, no paid ads",
          "Nothing consistent right now",
        ],
      },
      {
        id: "customer-service-tools",
        label: "How do customer questions get handled?",
        type: "select",
        options: [
          "Shared email inbox",
          "Gorgias",
          "Zendesk",
          "Phone and walk-ins only",
          "Social DMs, handled ad hoc",
        ],
      },
      {
        id: "reporting-process",
        label: "How do you see performance across the business today?",
        type: "select",
        options: [
          "Spreadsheets consolidated by hand",
          "Each platform's own dashboard, separately",
          "Our accountant's monthly statements",
          "A BI or dashboard tool",
          "No regular reporting",
        ],
      },
      {
        id: "biggest-bottleneck",
        label: "What is the biggest operational bottleneck right now?",
        type: "select",
        options: [
          "Inventory accuracy & stockouts",
          "Abandoned carts & online conversion",
          "Customer retention & loyalty",
          "Multi-location reporting",
          "Customer-service response times",
          "Promotions & marketing consistency",
        ],
        required: true,
        helper: "This weighs most heavily in the recommendation.",
      },
    ],
    recommendations: [
      { keywords: ["inventory accuracy", "stockouts", "stockout"], systemId: "inventory-intelligence" },
      { keywords: ["abandoned carts", "online conversion", "abandoned cart"], systemId: "ecommerce-recovery" },
      { keywords: ["retention", "customer retention & loyalty"], systemId: "loyalty-retention" },
      { keywords: ["multi-location reporting", "multi-location"], systemId: "multi-location-reporting" },
      { keywords: ["response times", "customer-service response"], systemId: "customer-service-assistant" },
      { keywords: ["marketing consistency", "promotions &"], systemId: "promotion-automation" },
    ],
    fallbackSystemId: "retail-operations-hub",
  },

  faqs: [
    {
      q: "Do you replace our POS or ecommerce platform?",
      a: "No — RSG systems connect to what you already run: Shopify, Shopify POS, Square, Lightspeed, Clover, WooCommerce, and the platforms around them. Replacing a core platform is a large, disruptive project we would only recommend if scoping shows it is genuinely necessary, and the decision stays yours.",
    },
    {
      q: "Will this work with our existing Shopify or Square setup?",
      a: "In most configurations, yes. What each integration can do depends on the platform's API, your plan tier, and your account permissions, so we verify every connection against your actual accounts during scoping — before anything is built or billed.",
    },
    {
      q: "How long does implementation take?",
      a: "A single focused system, such as ecommerce recovery or the customer service assistant, typically takes 2–4 weeks. The full Retail Operations Hub runs 4–8 weeks, and multi-location rollouts are phased over 8–12 weeks so every store keeps trading throughout. You get a specific timeline with the scope.",
    },
    {
      q: "How does pricing work?",
      a: "Every engagement is a custom quote. Scope depends on your locations, platforms, transaction volume, and which systems you need, so we price after scoping — a fixed, written scope before any build starts. We don't publish flat prices because they would be wrong in one direction or the other for most businesses.",
    },
    {
      q: "How is our customer data handled?",
      a: "Your data stays in your accounts — your POS, your ecommerce platform, your marketing tools — with RSG systems connecting them under role-based access controls. Consent is recorded at capture, unsubscribes take effect immediately, retention schedules are defined up front, and your data is never sold or shared beyond the platforms you approve.",
    },
    {
      q: "Our locations run on different POS systems. Is that a problem?",
      a: "It's common, and it's exactly the situation the Multi-Location Reporting Platform and Operations Hub are built for: they normalize data across systems into one consistent picture. Consolidating onto a single POS sometimes makes sense long-term, but it is never a prerequisite for working with us.",
    },
  ],

  seo: {
    title: "Retail Inventory and Customer Automation | Redmont Strategies",
    description:
      "Inventory visibility, abandoned-cart recovery, loyalty, and multi-location retail reporting systems — scoped, built, and run for specialty retailers.",
  },
};
