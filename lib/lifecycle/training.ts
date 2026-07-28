/**
 * Client Lifecycle Platform — training library.
 *
 * Server-only data access for training_items, training_assignments, and
 * training_completions. Content is generic to RSG-built systems: the seed
 * items below are real walkthrough copy shown in the client portal.
 */

import { requireSupabase, nowIso } from "@/lib/lifecycle/core";
import type {
  ClientUserRole,
  TrainingAssignment,
  TrainingCompletion,
  TrainingDifficulty,
  TrainingItem,
  TrainingKind,
} from "@/lib/lifecycle/types";

const UNIQUE_VIOLATION = "23505";

// ---------------------------------------------------------------------------
// Seed content
// ---------------------------------------------------------------------------

export type DefaultTrainingItem = Omit<TrainingItem, "id" | "created_at" | "updated_at">;

export const DEFAULT_TRAINING_ITEMS: DefaultTrainingItem[] = [
  {
    title: "Getting around your client portal",
    description:
      "A five-minute orientation to the portal: where your project lives, where files go, and where to get help.",
    kind: "walkthrough",
    system_tag: "portal",
    topic: "Getting started",
    difficulty: "beginner",
    audience_role: "all",
    url: null,
    storage_path: null,
    duration_minutes: 8,
    sort_order: 10,
    published: true,
    body: [
      "## What the portal is for",
      "",
      "Your client portal is the single place where everything about your engagement with Redmont Strategies Group lives: your project roadmap, files, approvals, training, support, and monthly reports. If you ever wonder \"where do I find that?\", the answer is almost always the portal.",
      "",
      "## The main areas",
      "",
      "- **Dashboard** — your current status at a glance: what we are working on, what is waiting on you, and any recent updates.",
      "- **Project** — the roadmap of milestones, what each one delivers, and who owns the next step. When a milestone changes status you will see it here first.",
      "- **Files** — everything shared in either direction, organized and versioned. Upload brand assets, content, and documents here rather than emailing them.",
      "- **Approvals** — items that need your sign-off before we proceed. Approving or requesting changes takes one click and keeps the project moving.",
      "- **Training** — this library. Guides are assigned when they become relevant to your system.",
      "- **Support** — open a ticket, track its status, and read the full history of past requests.",
      "- **Reports** — your monthly performance reports, kept permanently so you can see the trend over time.",
      "",
      "## Two habits that make everything smoother",
      "",
      "1. **Check the \"waiting on you\" items first.** Projects stall most often on a pending approval or a missing file. The dashboard always shows these at the top.",
      "2. **Keep conversations in the portal.** Messages attached to a project, request, or ticket keep the full history in one place, so nothing gets lost in an inbox.",
      "",
      "If anything in the portal is confusing, open a support ticket with the category \"Training request\" — improving these guides is part of our job.",
    ].join("\n"),
  },
  {
    title: "Using your CRM",
    description:
      "The core workflow of the CRM we built for you: contacts, pipelines, activity history, and daily habits that keep it accurate.",
    kind: "walkthrough",
    system_tag: "crm",
    topic: "Getting started",
    difficulty: "beginner",
    audience_role: "all",
    url: null,
    storage_path: null,
    duration_minutes: 15,
    sort_order: 20,
    published: true,
    body: [
      "## The one rule of CRM",
      "",
      "A CRM is only as useful as it is accurate. Every feature we built — pipelines, follow-up automation, reporting — depends on records being updated when reality changes. The system does most of that automatically; this guide covers the small part that stays human.",
      "",
      "## Core objects",
      "",
      "- **Contact** — a person: name, phone, email, and the full history of every call, message, and job connected to them.",
      "- **Company / household** — the account a contact belongs to, when that matters for your business.",
      "- **Deal (or job)** — a specific opportunity moving through your pipeline, with a value and a stage.",
      "",
      "## The pipeline view",
      "",
      "Your pipeline is a board of columns, one per stage. Each card is a deal. The stages were configured to match how your business actually sells, so moving a card to the next column is the single action that keeps everything else honest: follow-up automations, forecasting, and your reports all read from the stage.",
      "",
      "Move a card when the real-world event happens — quote sent, job scheduled, work completed — not at the end of the week from memory.",
      "",
      "## Logging activity",
      "",
      "Calls and emails that run through the system are logged automatically. For anything that happens outside it (a conversation at the counter, a handshake on site), add a short note on the contact: date, what was discussed, what happens next. Thirty seconds now saves a confused conversation later.",
      "",
      "## Daily rhythm that works",
      "",
      "1. Open the pipeline. Scan for cards that have not moved in a while — those are the ones leaking revenue.",
      "2. Work the task list. The system creates follow-up tasks; clear them or reschedule them, but never ignore them.",
      "3. Update stages as things happen during the day.",
      "",
      "## If something looks wrong",
      "",
      "Duplicate contacts, a deal in the wrong stage you cannot move, a field that does not fit your business — open a support ticket. Small CRM frictions compound, and most are quick for us to fix.",
    ].join("\n"),
  },
  {
    title: "Managing leads",
    description:
      "How new leads enter your system, how to respond fast, and how to keep the pipeline honest from first contact to won or lost.",
    kind: "walkthrough",
    system_tag: "crm",
    topic: "Daily use",
    difficulty: "beginner",
    audience_role: "all",
    url: null,
    storage_path: null,
    duration_minutes: 12,
    sort_order: 30,
    published: true,
    body: [
      "## Where leads come from",
      "",
      "Every lead source we connected — your website forms, phone calls, booking pages, and any advertising or referral channels — flows into one inbox in your system. Each lead arrives with its source attached, so you always know what generated it.",
      "",
      "## Speed is the whole game",
      "",
      "The single biggest factor in whether a lead converts is how fast someone responds. Your system helps two ways:",
      "",
      "- **Instant acknowledgment** — new leads get an automatic reply immediately, so they know they reached a real business (see the guide on automated follow-up).",
      "- **Notification to your team** — a new lead triggers an alert so a human can follow up while the interest is still warm.",
      "",
      "The automation buys you time; it does not replace the human call. Aim to make personal contact the same business day.",
      "",
      "## Working a new lead",
      "",
      "1. Open the lead and read what the system already captured: source, message, and any history if they have contacted you before.",
      "2. Make contact. Log the outcome — reached, left voicemail, bad number — with one click.",
      "3. Set the next step. Either move the lead forward in the pipeline or schedule a follow-up task. A lead should never sit with no next action.",
      "",
      "## Closing leads out honestly",
      "",
      "Mark leads **lost** when they are lost, and record why. This feels like admitting defeat; it is actually the most valuable reporting data you have. Knowing that a source produces lots of leads that never convert is worth more than a padded pipeline.",
      "",
      "## What to watch weekly",
      "",
      "- Leads with no activity in the last few days — the follow-up automation flags these, but review them yourself too.",
      "- Response times — your analytics show the time from lead arrival to first human contact. Keep the team aware of it.",
      "- Source quality — which channels produce leads that actually become customers.",
    ].join("\n"),
  },
  {
    title: "Updating your website",
    description:
      "The safe way to change text, images, hours, and offers on your site — and which changes should come to us instead.",
    kind: "guide",
    system_tag: "website",
    topic: "Daily use",
    difficulty: "beginner",
    audience_role: "all",
    url: null,
    storage_path: null,
    duration_minutes: 10,
    sort_order: 40,
    published: true,
    body: [
      "## What you can change yourself",
      "",
      "Your website was built so the content that changes often is editable without touching anything fragile:",
      "",
      "- Business hours, phone numbers, and service-area details",
      "- Text on service pages and about pages",
      "- Photos, team bios, and testimonials",
      "- Seasonal offers and announcement banners",
      "",
      "Where you make those edits depends on how your site was set up — your handoff notes name the exact editing tool and login. If you are unsure, ask us through a support ticket before guessing.",
      "",
      "## The safe editing workflow",
      "",
      "1. **Change one thing at a time.** If something looks wrong afterward, you know exactly what caused it.",
      "2. **Check the page after saving** on both a phone and a computer. Most of your visitors are on phones.",
      "3. **Keep the original text** somewhere (paste it in a note) before rewriting a page, so you can restore it if the new version underperforms.",
      "",
      "## Images: the two rules",
      "",
      "- Use real photos of your work and your team whenever possible. They outperform stock photography consistently.",
      "- Large image files slow the page down, and slow pages lose visitors. If a photo comes straight off a modern phone, it is probably too large — most editing tools resize on upload, but if a page suddenly feels slow after adding images, tell us.",
      "",
      "## What should come to us instead",
      "",
      "Some changes look small but touch things that affect your search ranking, your lead tracking, or the structure of the site:",
      "",
      "- Adding or removing whole pages",
      "- Changing page titles and headings that were written for search",
      "- Anything involving forms, buttons, or booking flows — these are wired into your CRM and analytics",
      "- Design and layout changes",
      "",
      "For these, open a request in the portal (category \"Website update\"). Small content-level updates of this kind are usually quick for us to turn around, and doing it on our side keeps your tracking intact.",
    ].join("\n"),
  },
  {
    title: "Reading your analytics",
    description:
      "What the numbers on your dashboard actually mean, which ones matter, and how to spot a real trend versus noise.",
    kind: "guide",
    system_tag: "analytics",
    topic: "Reporting",
    difficulty: "beginner",
    audience_role: "all",
    url: null,
    storage_path: null,
    duration_minutes: 12,
    sort_order: 50,
    published: true,
    body: [
      "## The point of the dashboard",
      "",
      "Your analytics exist to answer three questions: Where do customers come from? What does each channel cost or earn? Where does the process leak? Everything on the dashboard rolls up to one of those.",
      "",
      "## The metrics that matter",
      "",
      "- **Leads by source** — how many inquiries each channel produced. This is volume, not quality.",
      "- **Conversion rate** — of the leads that arrived, how many became customers. This is where quality shows up. A source with fewer leads but a higher conversion rate is often your best channel.",
      "- **Response time** — how quickly your team makes first contact with new leads. This is the metric you control most directly, and it moves conversion more than almost anything else.",
      "- **Revenue by source** (where your system tracks job values) — the closest thing to a straight answer on what is working.",
      "",
      "## The metrics that mislead",
      "",
      "- **Website visits** on their own. Traffic that does not inquire is trivia. Watch visits only alongside leads.",
      "- **Any single week.** Small businesses have lumpy weeks. One quiet week is noise; four declining weeks is a trend.",
      "",
      "## How to read a trend honestly",
      "",
      "Compare like periods: this month against the same month last year beats this month against last month, especially in seasonal businesses. Your dashboard defaults show both where enough history exists.",
      "",
      "When a number moves sharply, look for the boring explanation first — a holiday, a weather event, a campaign that started or ended — before concluding something is broken or brilliant.",
      "",
      "## What we do with the same numbers",
      "",
      "Your monthly report (in the Reports section of the portal) is our read of this same data: what improved, what we changed, and what we recommend next. If the dashboard ever seems to disagree with the report, ask — the discrepancy usually has a specific, explainable cause, and we would rather explain it than have you distrust the numbers.",
    ].join("\n"),
  },
  {
    title: "How automated follow-up works",
    description:
      "What your follow-up automation does on its own, when it stops, and how it decides — so it never surprises you or a customer.",
    kind: "guide",
    system_tag: "automation",
    topic: "How your system works",
    difficulty: "beginner",
    audience_role: "all",
    url: null,
    storage_path: null,
    duration_minutes: 10,
    sort_order: 60,
    published: true,
    body: [
      "## The problem it solves",
      "",
      "Most lost leads are not lost to a competitor — they are lost to silence. Somebody inquired, the first reply came late or never, and the moment passed. Your follow-up automation exists to make silence impossible.",
      "",
      "## What actually happens when a lead arrives",
      "",
      "1. **Immediate acknowledgment.** Within moments of a new inquiry, the lead receives a reply confirming you got their message and setting an expectation for when a human will be in touch. This message was written with you during setup — it sounds like your business, not a robot.",
      "2. **Team notification.** Your team is alerted so a real person can respond quickly.",
      "3. **Scheduled follow-ups.** If there is no reply or logged contact after a set interval, the system sends a follow-up. The sequence continues on a schedule you approved — typically a few touches over one to two weeks, each one easy to opt out of.",
      "",
      "## When the automation stops",
      "",
      "This is the most important part. The sequence stops automatically the moment any of these happens:",
      "",
      "- The lead replies through any connected channel",
      "- Someone on your team logs a call or message with them",
      "- The lead is moved forward in the pipeline, or marked lost",
      "- The lead opts out",
      "",
      "The automation never talks over a live conversation. If a customer says \"I keep getting messages,\" it means one of the stop conditions was missed — usually a phone call that never got logged. Log the contact and the sequence ends.",
      "",
      "## What it will never do",
      "",
      "The automation sends the messages you approved, on the schedule you approved, and nothing else. It does not improvise offers, quote prices, or make commitments. Anything requiring judgment is routed to a human — see the guide on approving AI actions if your system includes AI-drafted replies.",
      "",
      "## Changing the messages or timing",
      "",
      "Wording, timing, and the number of touches are all adjustable. Open a request in the portal describing what you want changed, and we will update the sequence — you approve the final copy before it goes live.",
    ].join("\n"),
  },
  {
    title: "Approving AI actions",
    description:
      "How the human-approval queue works: what the AI drafts on its own, what it is never allowed to do, and how to review well.",
    kind: "walkthrough",
    system_tag: "ai",
    topic: "Daily use",
    difficulty: "intermediate",
    audience_role: "all",
    url: null,
    storage_path: null,
    duration_minutes: 8,
    sort_order: 70,
    published: true,
    body: [
      "## The design principle",
      "",
      "Where your system uses AI — drafting replies, summarizing calls, suggesting next steps — it runs on a simple rule: **the AI drafts, a human decides.** Anything that would be sent to a customer or would commit your business to something waits in an approval queue until someone on your team says yes.",
      "",
      "## The approval queue",
      "",
      "Pending items appear in your system's approval area, each showing:",
      "",
      "- What the AI wants to do (for example, send a specific reply to a specific customer)",
      "- The full text or action, exactly as it would execute",
      "- The context it used — the conversation or record it was working from",
      "",
      "You have three choices per item: **approve** (it executes as shown), **edit then approve** (your edited version executes), or **reject** (nothing happens, and the item is logged as rejected).",
      "",
      "## How to review well",
      "",
      "- **Read the customer's message first, then the draft.** You are checking that the draft actually answers what was asked, not just that it sounds polite.",
      "- **Check facts, prices, and promises.** The AI is instructed not to invent commitments, but the review exists precisely because instructions are not guarantees. If a draft names a price, a date, or a promise, verify it before approving.",
      "- **Edit freely.** Approving a mediocre draft trains nobody. Your edits also show us where the drafting instructions need improvement — we review rejection and edit patterns during your check-ins.",
      "",
      "## What the AI is never allowed to do",
      "",
      "These are enforced by how the system is built, not by trust:",
      "",
      "- Send anything externally without approval, unless you have explicitly moved a specific message type to auto-send",
      "- Take payments, issue refunds, or change prices",
      "- Delete records",
      "",
      "## Graduating to auto-send",
      "",
      "Some clients eventually let routine message types (appointment confirmations, for instance) send without review, once weeks of approvals show the drafts are consistently right. That change only happens when you request it, one message type at a time, and it is reversible instantly. Tell us when you feel ready — or never do, which is also fine.",
    ].join("\n"),
  },
  {
    title: "Managing team members",
    description:
      "Adding and removing portal users, choosing roles, and keeping access aligned with who actually works for you.",
    kind: "guide",
    system_tag: "portal",
    topic: "Administration",
    difficulty: "intermediate",
    audience_role: "owner",
    url: null,
    storage_path: null,
    duration_minutes: 6,
    sort_order: 80,
    published: true,
    body: [
      "## Who should have access",
      "",
      "Anyone who regularly needs to see project status, upload files, approve work, or open support tickets should have their own login. Shared logins feel convenient and cost you the two things access control exists for: knowing who did what, and being able to remove one person without disrupting everyone.",
      "",
      "## Roles",
      "",
      "- **Owner** — full access, including managing the team itself and anything involving billing. There should be at least one owner; most businesses need exactly one or two.",
      "- **Admin** — full working access to projects, files, approvals, and support, without team management.",
      "- **Member** — day-to-day access: view project status, use training, upload files, and open tickets. Right for most staff.",
      "",
      "Choose the smallest role that lets the person do their job. You can always raise it later; walking access back is the awkward direction.",
      "",
      "## Inviting someone",
      "",
      "From the team section of your portal, enter their name and work email and pick a role. They receive an invitation link to set their own password. Invitation links expire after a few days — if one lapses, just send a fresh invite.",
      "",
      "## When someone leaves",
      "",
      "Deactivate their portal account the same day their employment ends — it takes one click and is immediately reversible if you ever need to restore it. Then check the same for the other systems we built you (CRM, website editor); the security best-practices guide includes a full offboarding checklist.",
      "",
      "## If you get locked out",
      "",
      "If the only owner leaves or loses access, contact us through any channel and we will verify identity and restore owner access. This is exactly the situation to avoid by having a second owner.",
    ].join("\n"),
  },
  {
    title: "Exporting reports",
    description:
      "Getting your data out of the system — report downloads, CRM exports, and what each format is good for.",
    kind: "guide",
    system_tag: "reporting",
    topic: "Reporting",
    difficulty: "beginner",
    audience_role: "all",
    url: null,
    storage_path: null,
    duration_minutes: 5,
    sort_order: 90,
    published: true,
    body: [
      "## Your data is yours",
      "",
      "Everything your system collects — contacts, jobs, lead history, performance numbers — belongs to you, and getting it out is a supported feature, not a workaround. You do not need our permission or help for routine exports, though we are glad to help with unusual ones.",
      "",
      "## Monthly reports",
      "",
      "Your monthly performance reports live in the Reports section of the portal permanently. Each can be viewed on any device or saved for printing and sharing — useful for partners, lenders, or your accountant.",
      "",
      "## CRM and lead data",
      "",
      "Your CRM can export contacts, deals, and activity as spreadsheet files (CSV). A CSV opens in Excel or Google Sheets and is the right format for:",
      "",
      "- Sharing a filtered list (for example, all customers from a specific town or a specific year)",
      "- Giving your accountant job and revenue data",
      "- Keeping your own periodic backup",
      "",
      "Export the filtered view you actually need rather than the entire database — smaller files are easier to work with and safer to share.",
      "",
      "## Analytics data",
      "",
      "Dashboard views can be exported for the date range on screen. When comparing periods, export each period with the same columns so the spreadsheets line up.",
      "",
      "## Two cautions",
      "",
      "1. **An export is a snapshot.** The moment it is downloaded it starts going stale. Treat the live system as the source of truth and exports as disposable copies.",
      "2. **Exports contain customer personal data.** Store them like you would store paper customer files — not in a shared folder anyone can reach, and deleted when no longer needed. More in the security guide.",
      "",
      "If you need an export the system does not offer directly — a custom combination of fields, or data formatted for a specific piece of software — open a support ticket and describe the end use; we can usually produce it.",
    ].join("\n"),
  },
  {
    title: "Opening support tickets",
    description:
      "How to report an issue so it gets fixed fast: what to include, how priorities work, and what happens after you submit.",
    kind: "walkthrough",
    system_tag: "support",
    topic: "Support",
    difficulty: "beginner",
    audience_role: "all",
    url: null,
    storage_path: null,
    duration_minutes: 5,
    sort_order: 100,
    published: true,
    body: [
      "## When to open a ticket",
      "",
      "Any time something in a system we built is broken, confusing, or behaving unexpectedly. There is no issue too small — a five-minute fix reported today beats a workaround your team quietly suffers with for a year. For new features or scope changes, use a project request instead; the portal will guide you to the right form either way.",
      "",
      "## Writing a ticket that gets solved fast",
      "",
      "The speed of a fix is mostly determined by how reproducible the report is. Include:",
      "",
      "1. **What you were doing** — the exact page or screen, and the steps you took.",
      "2. **What happened** — the error message word-for-word, or a description of the wrong behavior. A screenshot is worth all of the above; you can attach files to any ticket.",
      "3. **What you expected** — sometimes the system is working as designed and the design is what needs the conversation.",
      "4. **When it started and whether it happens every time** — \"since yesterday, every time\" and \"once, last Tuesday\" lead to very different investigations.",
      "",
      "## Choosing a priority",
      "",
      "- **Critical / urgent** — the system is down or your business is actively losing money or customers right now.",
      "- **High** — a core function is broken but you have a workaround.",
      "- **Normal** — something is wrong but daily work continues. Most tickets are normal, and that is fine.",
      "- **Low** — cosmetic issues and minor annoyances.",
      "",
      "Honest priorities help everyone: marking routine items urgent slows down response to the genuinely urgent ones — including yours.",
      "",
      "## What happens after you submit",
      "",
      "Your ticket gets a number and appears in the Support section with its live status. You will see when it is acknowledged, when it is being worked on, and when we need something from you — replies happen right on the ticket thread, keeping the whole history in one place. When we mark a ticket resolved, you get the final word: confirm it is fixed, or reopen it if it is not.",
    ].join("\n"),
  },
  {
    title: "Requesting changes the right way",
    description:
      "The difference between a support ticket, a change request, and a scope change — and how to phrase requests so you get what you pictured.",
    kind: "guide",
    system_tag: "portal",
    topic: "Support",
    difficulty: "beginner",
    audience_role: "all",
    url: null,
    storage_path: null,
    duration_minutes: 6,
    sort_order: 110,
    published: true,
    body: [
      "## Three kinds of ask",
      "",
      "- **Something is broken** → support ticket. It was working, now it is not, or it never worked as designed.",
      "- **Change something that exists** → change request. New wording, a different photo, an adjusted automation message, a tweak to a report.",
      "- **Build something new** → this may be a scope conversation. Adding a capability the system does not have is worth pricing and planning properly rather than squeezing into a request queue.",
      "",
      "You do not need to classify perfectly — submit through the portal and we will route it. But knowing the difference sets accurate expectations about timing.",
      "",
      "## Describing what you want",
      "",
      "The most common source of revision cycles is a request that describes a solution without the underlying goal. Compare:",
      "",
      "- \"Make the phone number bigger\" — we can do this, but if the real problem is that calls dropped, the better fix might be elsewhere on the page.",
      "- \"We're getting fewer calls from the website than last quarter — can we make it easier to call us?\" — now the goal is on the table and we can bring options.",
      "",
      "State the outcome you want, then any specific ideas you have. You get better work and usually fewer rounds of revision.",
      "",
      "## Batching beats trickling",
      "",
      "Five small website edits submitted together get done in one pass, tested once, and reviewed once. The same five edits across five separate days each carry their own overhead. When changes are not urgent, collect them — a running note works well — and submit weekly.",
      "",
      "## When we say \"that's a scope change\"",
      "",
      "Occasionally you will ask for something and we will respond that it needs a change order — a priced, scheduled piece of work rather than a routine request. This is not upselling; it protects both sides. Work done informally on the side of a project is work that is unplanned, untested, and unaccounted for. The change-order conversation is short, and you will always see cost and timeline before deciding.",
    ].join("\n"),
  },
  {
    title: "Security best practices for your team",
    description:
      "Practical security for a small business: passwords, phishing, access hygiene, and what to do the day someone leaves.",
    kind: "guide",
    system_tag: "security",
    topic: "Security",
    difficulty: "beginner",
    audience_role: "all",
    url: null,
    storage_path: null,
    duration_minutes: 10,
    sort_order: 120,
    published: true,
    body: [
      "## Why this matters for a business your size",
      "",
      "Small businesses are attacked more than most owners assume, precisely because attackers expect weaker defenses than at a bank. The good news: the handful of habits below stop the overwhelming majority of real-world attacks, and none of them require technical skill.",
      "",
      "## Passwords",
      "",
      "- **One account, one person, one password.** No shared logins — every person who needs access gets their own account (see the team-management guide).",
      "- **Different passwords for different systems.** The most common breach path is a password stolen from one leaked website being tried on everything else you use. A password manager makes unique passwords effortless; the built-in ones in modern browsers and phones are fine to start.",
      "- **Length beats cleverness.** A phrase of several random words is stronger and easier to remember than something short with symbols.",
      "- **Turn on two-factor authentication** everywhere it is offered, starting with email — because whoever controls your email can reset every other password you have.",
      "",
      "## Phishing: the attack you will actually face",
      "",
      "Nearly every small-business compromise starts with a message that creates urgency and asks for a click or a credential — a fake invoice, a \"your account will be suspended\" notice, a text that appears to be from the owner asking staff to buy gift cards.",
      "",
      "Team rules that work:",
      "",
      "1. **Urgency is the tell.** Real institutions rarely demand action within the hour. Pressure to act fast is the strongest signal a message is fake.",
      "2. **Go to the site yourself.** Never log in through a link in an email or text. Open the browser and type the address, or use your bookmark.",
      "3. **Verify money moves on a second channel.** Any request to pay, change bank details, or buy gift cards gets confirmed by phone or in person with the actual person — even (especially) when the request appears to come from the boss.",
      "4. **No blame for asking.** Staff who forward suspicious messages for a second opinion are doing security, not wasting time. The one culture rule that matters: nobody ever gets criticized for verifying.",
      "",
      "## Access hygiene",
      "",
      "- Review who has access to your systems every few months. People accumulate access; nobody accumulates less by accident.",
      "- When someone leaves, deactivate their accounts the same day — portal, CRM, email, website editor, social media. Keep a written offboarding checklist so nothing is missed in the moment.",
      "- Exported customer data (spreadsheets, reports) deserves the same care as the systems themselves: store it privately, share it deliberately, delete it when done.",
      "",
      "## If something feels wrong",
      "",
      "Clicked a bad link, typed a password somewhere you should not have, or seeing logins you do not recognize? Change the affected password immediately, then open a **security** ticket in the portal right away — mark it urgent. Fast response turns most incidents into non-events, and you will never hear a lecture from us for reporting one.",
    ].join("\n"),
  },
];

// ---------------------------------------------------------------------------
// Library management
// ---------------------------------------------------------------------------

/** Seeds the default library only when training_items is empty. Returns rows inserted. */
export async function ensureDefaultTraining(): Promise<number> {
  const sb = requireSupabase();

  const { count, error: countError } = await sb
    .from("training_items")
    .select("id", { count: "exact", head: true });
  if (countError) {
    throw new Error(`Failed to check training library: ${countError.message}`);
  }
  if ((count ?? 0) > 0) return 0;

  const now = nowIso();
  const rows = DEFAULT_TRAINING_ITEMS.map((item) => ({ ...item, updated_at: now }));
  const { data, error } = await sb.from("training_items").insert(rows).select("id");
  if (error) {
    throw new Error(`Failed to seed default training items: ${error.message}`);
  }
  return (data ?? []).length;
}

export async function listTrainingItems(
  opts: {
    publishedOnly?: boolean;
    system?: string;
    topic?: string;
    limit?: number;
  } = {},
): Promise<TrainingItem[]> {
  const sb = requireSupabase();
  let query = sb
    .from("training_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (opts.publishedOnly) query = query.eq("published", true);
  if (opts.system) query = query.eq("system_tag", opts.system);
  if (opts.topic) query = query.eq("topic", opts.topic);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list training items: ${error.message}`);
  return (data ?? []) as TrainingItem[];
}

export async function getTrainingItem(id: string): Promise<TrainingItem | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("training_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load training item ${id}: ${error.message}`);
  return (data as TrainingItem) ?? null;
}

export type CreateTrainingItemInput = {
  title: string;
  description?: string;
  kind?: TrainingKind;
  systemTag?: string;
  topic?: string;
  difficulty?: TrainingDifficulty;
  audienceRole?: "all" | ClientUserRole;
  url?: string | null;
  storagePath?: string | null;
  body?: string;
  durationMinutes?: number | null;
  sortOrder?: number;
  published?: boolean;
};

export async function createTrainingItem(
  input: CreateTrainingItemInput,
): Promise<TrainingItem> {
  const sb = requireSupabase();
  const now = nowIso();
  const { data, error } = await sb
    .from("training_items")
    .insert({
      title: input.title,
      description: input.description ?? "",
      kind: input.kind ?? "guide",
      system_tag: input.systemTag ?? "",
      topic: input.topic ?? "",
      difficulty: input.difficulty ?? "beginner",
      audience_role: input.audienceRole ?? "all",
      url: input.url ?? null,
      storage_path: input.storagePath ?? null,
      body: input.body ?? "",
      duration_minutes: input.durationMinutes ?? null,
      sort_order: input.sortOrder ?? 0,
      published: input.published ?? true,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create training item: ${error.message}`);
  return data as TrainingItem;
}

export type UpdateTrainingItemPatch = Partial<CreateTrainingItemInput>;

export async function updateTrainingItem(
  id: string,
  patch: UpdateTrainingItemPatch,
): Promise<TrainingItem> {
  const sb = requireSupabase();
  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.systemTag !== undefined) update.system_tag = patch.systemTag;
  if (patch.topic !== undefined) update.topic = patch.topic;
  if (patch.difficulty !== undefined) update.difficulty = patch.difficulty;
  if (patch.audienceRole !== undefined) update.audience_role = patch.audienceRole;
  if (patch.url !== undefined) update.url = patch.url;
  if (patch.storagePath !== undefined) update.storage_path = patch.storagePath;
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.durationMinutes !== undefined) update.duration_minutes = patch.durationMinutes;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.published !== undefined) update.published = patch.published;

  const { data, error } = await sb
    .from("training_items")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update training item ${id}: ${error.message}`);
  return data as TrainingItem;
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export type AssignTrainingInput = {
  trainingItemId: string;
  clientId: string;
  clientUserId?: string | null;
  projectId?: string | null;
  required?: boolean;
  dueAt?: string | null;
  assignedBy?: string | null;
};

async function findAssignment(
  trainingItemId: string,
  clientId: string,
  clientUserId: string | null,
): Promise<TrainingAssignment | null> {
  const sb = requireSupabase();
  let query = sb
    .from("training_assignments")
    .select("*")
    .eq("training_item_id", trainingItemId)
    .eq("client_id", clientId);
  query = clientUserId
    ? query.eq("client_user_id", clientUserId)
    : query.is("client_user_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Failed to look up training assignment: ${error.message}`);
  return (data as TrainingAssignment) ?? null;
}

/**
 * Assigns a training item to a client (or a specific client user).
 * Upsert-safe: a duplicate assignment returns the existing row unchanged.
 */
export async function assignTraining(
  input: AssignTrainingInput,
): Promise<TrainingAssignment> {
  const sb = requireSupabase();
  const clientUserId = input.clientUserId ?? null;

  const existing = await findAssignment(input.trainingItemId, input.clientId, clientUserId);
  if (existing) return existing;

  const { data, error } = await sb
    .from("training_assignments")
    .insert({
      training_item_id: input.trainingItemId,
      client_id: input.clientId,
      client_user_id: clientUserId,
      project_id: input.projectId ?? null,
      required: input.required ?? false,
      due_at: input.dueAt ?? null,
      assigned_by: input.assignedBy ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      // Lost a race with a concurrent identical assignment — return theirs.
      const raced = await findAssignment(input.trainingItemId, input.clientId, clientUserId);
      if (raced) return raced;
    }
    throw new Error(`Failed to assign training: ${error.message}`);
  }
  return data as TrainingAssignment;
}

export async function listAssignmentsForClient(
  clientId: string,
): Promise<TrainingAssignment[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("training_assignments")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`Failed to list training assignments for client ${clientId}: ${error.message}`);
  }
  return (data ?? []) as TrainingAssignment[];
}

export async function removeAssignment(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("training_assignments").delete().eq("id", id);
  if (error) throw new Error(`Failed to remove training assignment ${id}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Completions
// ---------------------------------------------------------------------------

async function findCompletion(
  trainingItemId: string,
  clientUserId: string | null,
): Promise<TrainingCompletion | null> {
  const sb = requireSupabase();
  let query = sb
    .from("training_completions")
    .select("*")
    .eq("training_item_id", trainingItemId);
  query = clientUserId
    ? query.eq("client_user_id", clientUserId)
    : query.is("client_user_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Failed to look up training completion: ${error.message}`);
  return (data as TrainingCompletion) ?? null;
}

/** Records a completion. Idempotent: completing twice keeps the original record. */
export async function markTrainingComplete(input: {
  trainingItemId: string;
  clientId: string;
  /** Null for legacy owner accounts that have no client_users seat. */
  clientUserId: string | null;
}): Promise<TrainingCompletion> {
  const sb = requireSupabase();

  const existing = await findCompletion(input.trainingItemId, input.clientUserId);
  if (existing) return existing;

  const { data, error } = await sb
    .from("training_completions")
    .insert({
      training_item_id: input.trainingItemId,
      client_id: input.clientId,
      client_user_id: input.clientUserId,
      completed_at: nowIso(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const raced = await findCompletion(input.trainingItemId, input.clientUserId);
      if (raced) return raced;
    }
    throw new Error(`Failed to mark training complete: ${error.message}`);
  }
  return data as TrainingCompletion;
}

// ---------------------------------------------------------------------------
// Portal views & stats
// ---------------------------------------------------------------------------

export type ClientTrainingEntry = {
  item: TrainingItem;
  assignment: TrainingAssignment | null;
  required: boolean;
  completed: boolean;
  dueAt: string | null;
};

/**
 * The training library as one client user sees it: published items for their
 * role, with assignment (user-specific wins over client-wide) and completion
 * state. Required-but-incomplete items sort first, then library sort_order.
 */
export async function getClientTrainingView(
  clientId: string,
  clientUserId: string,
  role: ClientUserRole,
): Promise<ClientTrainingEntry[]> {
  const sb = requireSupabase();

  const [itemsRes, assignmentsRes, completionsRes] = await Promise.all([
    sb
      .from("training_items")
      .select("*")
      .eq("published", true)
      .in("audience_role", ["all", role])
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true }),
    sb
      .from("training_assignments")
      .select("*")
      .eq("client_id", clientId)
      .or(`client_user_id.is.null,client_user_id.eq.${clientUserId}`),
    sb
      .from("training_completions")
      .select("*")
      .eq("client_id", clientId)
      .eq("client_user_id", clientUserId),
  ]);

  if (itemsRes.error) {
    throw new Error(`Failed to load training items: ${itemsRes.error.message}`);
  }
  if (assignmentsRes.error) {
    throw new Error(`Failed to load training assignments: ${assignmentsRes.error.message}`);
  }
  if (completionsRes.error) {
    throw new Error(`Failed to load training completions: ${completionsRes.error.message}`);
  }

  const items = (itemsRes.data ?? []) as TrainingItem[];
  const assignments = (assignmentsRes.data ?? []) as TrainingAssignment[];
  const completions = (completionsRes.data ?? []) as TrainingCompletion[];

  const assignmentByItem = new Map<string, TrainingAssignment>();
  for (const assignment of assignments) {
    const current = assignmentByItem.get(assignment.training_item_id);
    // A user-specific assignment overrides a client-wide one.
    if (!current || (assignment.client_user_id && !current.client_user_id)) {
      assignmentByItem.set(assignment.training_item_id, assignment);
    }
  }
  const completedItemIds = new Set(completions.map((c) => c.training_item_id));

  const entries: ClientTrainingEntry[] = items.map((item) => {
    const assignment = assignmentByItem.get(item.id) ?? null;
    return {
      item,
      assignment,
      required: assignment?.required ?? false,
      completed: completedItemIds.has(item.id),
      dueAt: assignment?.due_at ?? null,
    };
  });

  entries.sort((a, b) => {
    const aUrgent = a.required && !a.completed ? 0 : 1;
    const bUrgent = b.required && !b.completed ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;
    return a.item.sort_order - b.item.sort_order;
  });

  return entries;
}

/**
 * Client-level completion stats. Counts are per distinct training item:
 * an item is "completed" when any user at the client has completed it.
 */
export async function trainingCompletionStats(clientId: string): Promise<{
  assigned: number;
  required: number;
  completedRequired: number;
  completedTotal: number;
}> {
  const sb = requireSupabase();

  const [assignmentsRes, completionsRes] = await Promise.all([
    sb
      .from("training_assignments")
      .select("training_item_id, required")
      .eq("client_id", clientId),
    sb
      .from("training_completions")
      .select("training_item_id")
      .eq("client_id", clientId),
  ]);

  if (assignmentsRes.error) {
    throw new Error(`Failed to load training assignments: ${assignmentsRes.error.message}`);
  }
  if (completionsRes.error) {
    throw new Error(`Failed to load training completions: ${completionsRes.error.message}`);
  }

  const assignments = (assignmentsRes.data ?? []) as Pick<
    TrainingAssignment,
    "training_item_id" | "required"
  >[];
  const completions = (completionsRes.data ?? []) as Pick<
    TrainingCompletion,
    "training_item_id"
  >[];

  const assignedItems = new Set<string>();
  const requiredItems = new Set<string>();
  for (const assignment of assignments) {
    assignedItems.add(assignment.training_item_id);
    if (assignment.required) requiredItems.add(assignment.training_item_id);
  }

  const completedItems = new Set(completions.map((c) => c.training_item_id));
  let completedRequired = 0;
  for (const itemId of requiredItems) {
    if (completedItems.has(itemId)) completedRequired += 1;
  }

  return {
    assigned: assignedItems.size,
    required: requiredItems.size,
    completedRequired,
    completedTotal: completedItems.size,
  };
}
