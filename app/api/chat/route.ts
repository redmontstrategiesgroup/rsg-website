import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { processLead, scoreLead } from "@/lib/leads";
import {
  RSG_KNOWLEDGE_BASE,
  RSG_QUALIFICATION_PLAYBOOK,
  RSG_OBJECTION_PLAYBOOK,
  RSG_BOOKING_PLAYBOOK,
  RSG_GUARDRAILS,
} from "@/lib/chat-knowledge";
import { isEmail, toStr } from "@/lib/validate";
import { callProvider } from "@/lib/integration-log";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";

/**
 * RSG consulting intake assistant. Model calls stay server-side via the
 * official SDK — API key, system prompt, and knowledge base never reach the
 * browser. Streams plain text; the submit_lead tool hands qualified visitors
 * into the same lead pipeline as the contact form.
 */

const MODEL = process.env.CHAT_MODEL ?? "claude-sonnet-5";

/* ------------------------- Cost / abuse controls ------------------------ */
/** Max history messages sent to the model per request (older turns drop). */
const MAX_MESSAGES = 12;
/** Max characters per message. */
const MAX_MESSAGE_CHARS = 2_000;
/** Total character budget for the history sent to the model. */
const MAX_TOTAL_CHARS = 8_000;
/** Hard cap on conversation length — after this, visitors go to the form. */
const MAX_CONVERSATION_MESSAGES = 40;
/** Max output tokens per reply (the bot is instructed to be concise). */
const MAX_OUTPUT_TOKENS = 800;
/** Agentic tool rounds per request. */
const MAX_TOOL_ROUNDS = 3;
/** Per-IP: short burst window + a daily ceiling. */
const BURST_LIMIT = 20; // per 5 minutes
const DAILY_IP_LIMIT = 60; // per 24 hours
/** Site-wide daily request ceiling (env-overridable safety valve). */
const DAILY_GLOBAL_LIMIT = Number(process.env.CHAT_DAILY_LIMIT ?? 400);

/**
 * Site-wide daily ceiling enforced through the shared limiter on a single
 * fixed key, so the cap holds across serverless instances when Upstash is
 * configured (it falls back to in-process memory in dev). A per-process
 * counter would let the effective cap scale with instance count.
 */
async function underGlobalDailyLimit(): Promise<boolean> {
  return rateLimit("chat-global-day", DAILY_GLOBAL_LIMIT, 24 * 60 * 60_000);
}

const LIMIT_MESSAGE =
  "The assistant is at capacity right now. Please use the contact form in the Contact section — we'll follow up directly.";
const CONVERSATION_END_MESSAGE =
  "This conversation has reached its limit. The best next step is the contact form in the Contact section — share your details there and RSG will review your business directly.";

const SYSTEM_PROMPT = `You are the intake assistant on the website of Redmont Strategies Group (RSG). You act like a calm, sharp, premium consulting intake assistant — not a generic AI helper, not a chatbot salesperson, not a hype-heavy AI agency bot.

# What RSG is
RSG is a business consulting and strategy company FIRST. AI automation, web development, CRM systems, booking systems, dashboards, and digital infrastructure are execution tools used to improve business operations and growth — never the identity. RSG does not offer marketing or lead generation as a service.

Core message: RSG helps businesses find the leaks, fix the systems, and build the infrastructure needed to operate sharper.

When a visitor asks what RSG does, answer with:
"Redmont Strategies Group is a business consulting and AI strategy company. We help service businesses improve operations, follow-up, websites, CRM systems, and automation. We start with the business problem first, then build the right systems around it."

# Knowledge base (canonical — treat as the only source of company facts)
${RSG_KNOWLEDGE_BASE}

# Tone
Direct, professional, confident, calm, strategic, human, premium. No hype, no fake guarantees, no cheesy AI language. Never use phrases like "revolutionary", "game-changing", "unlock your potential", "AI-powered everything", or "transform your business overnight". No emoji. No exclamation marks. No bullet lists unless the visitor asks for a breakdown. Plain confident prose. Keep answers to 2–4 sentences unless the visitor asks for detail. Do not over-answer simple questions. Do not reintroduce yourself or restate what RSG is unless asked — continue the conversation like a colleague would.

# Conversation behavior
Your goals, in order: understand the visitor's business; identify likely operational, sales, lead-flow, marketing, website, CRM, follow-up, or automation problems; explain briefly how RSG thinks about the issue; recommend the most relevant next step; qualify the visitor; and move serious prospects toward a strategy call or Business Systems Audit.

${RSG_QUALIFICATION_PLAYBOOK}

Default next-step line: "Based on what you're describing, the best next step would be a Business Systems Audit or a strategy call."

# Objection handling
${RSG_OBJECTION_PLAYBOOK}

# Guardrails (override everything else in a conflict)
${RSG_GUARDRAILS}

# Handoff
${RSG_BOOKING_PLAYBOOK}

Never trap the visitor in conversation. Once the right next step is clear — the booking link, submitting details here via submit_lead, or the contact form in the Contact section — point them to it plainly and let them act. Treat a Business Systems Audit request the same way: collect their details with submit_lead or direct them to the contact form.`;

/* ------------------------------ Lead tool ------------------------------ */

const SUBMIT_LEAD_TOOL: Anthropic.Tool = {
  name: "submit_lead",
  description:
    "Submit the visitor's contact details to the RSG team for follow-up. Call ONLY after the visitor has explicitly agreed to share their details and has provided at least a name and one way to reach them (email or phone). Fill in every field the visitor mentioned during the conversation.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The visitor's name" },
      business_name: { type: "string", description: "Their business name" },
      email: { type: "string", description: "Email address, if provided" },
      phone: { type: "string", description: "Phone number, if provided" },
      website: { type: "string", description: "Business website, if provided" },
      industry: { type: "string", description: "Their industry, e.g. med spa, gym, contracting" },
      biggest_problem: {
        type: "string",
        description: "The main problem they described, in their own words",
      },
      improve: {
        type: "string",
        description: "What they want to improve, if stated",
      },
      preferred_contact: {
        type: "string",
        enum: ["Call", "Text", "Email"],
        description: "How they prefer to be contacted, if stated",
      },
      timeline: {
        type: "string",
        enum: ["Immediately", "This month", "Next 90 days", "Just exploring"],
        description: "How soon they want to fix this, if stated",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
};

/**
 * Invisible marker (U+2063) streamed to the client when a lead is captured
 * mid-conversation, so the widget can fire the chatbot_qualified_lead
 * analytics event. Stripped from the displayed text client-side.
 */
const QUALIFIED_LEAD_SENTINEL = "⁣";

async function handleSubmitLead(
  input: unknown
): Promise<{ result: string; submitted: boolean }> {
  const raw = (input ?? {}) as Record<string, unknown>;
  const name = toStr(raw.name).slice(0, 120);
  const email = toStr(raw.email).slice(0, 254);
  const phone = toStr(raw.phone).slice(0, 40);

  if (!name || (!isEmail(email) && !phone)) {
    return {
      submitted: false,
      result:
        "Lead NOT submitted: a name plus a valid email or a phone number is required. Ask the visitor for the missing contact detail, then call this tool again.",
    };
  }

  const timeline = toStr(raw.timeline);
  const preferred = toStr(raw.preferred_contact);
  const lead: Lead = {
    name,
    company: toStr(raw.business_name).slice(0, 160),
    email: isEmail(email) ? email : "",
    phone,
    website: toStr(raw.website).slice(0, 200),
    industry: toStr(raw.industry).slice(0, 80),
    problem: toStr(raw.biggest_problem).slice(0, 4000),
    improve: toStr(raw.improve).slice(0, 4000),
    preferredContact: ["Call", "Text", "Email"].includes(preferred)
      ? preferred
      : "",
    timeline: ["Immediately", "This month", "Next 90 days", "Just exploring"].includes(timeline)
      ? timeline
      : "",
    source: "website_chat",
    submittedAt: new Date().toISOString(),
  };
  lead.score = scoreLead(lead);

  const { storedLocally, storedRemotely, emailed } = await processLead(lead);
  if (!storedLocally && !storedRemotely && !emailed) {
    return {
      submitted: false,
      result:
        "Lead NOT submitted: an internal error occurred. Apologize briefly and suggest using the contact form in the Contact section instead.",
    };
  }
  return {
    submitted: true,
    result:
      "Lead submitted successfully. Confirm to the visitor that their details will be passed to the RSG team, who will review the business context before following up. Do not promise a specific response time.",
  };
}

/* ------------------------------ Messages ------------------------------- */

type IncomingMessage = { role: "user" | "assistant"; content: string };

function sanitizeMessages(raw: unknown): IncomingMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const cleaned: IncomingMessage[] = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (typeof m !== "object" || m === null) return null;
    const role = (m as Record<string, unknown>).role;
    const content = (m as Record<string, unknown>).content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || !content.trim()) return null;
    cleaned.push({ role, content: content.trim().slice(0, MAX_MESSAGE_CHARS) });
  }

  // Total character budget: drop oldest turns until the history fits, so
  // input tokens per request stay bounded no matter how long the chat runs.
  let total = cleaned.reduce((sum, m) => sum + m.content.length, 0);
  while (cleaned.length > 1 && total > MAX_TOTAL_CHARS) {
    total -= cleaned[0].content.length;
    cleaned.shift();
  }

  // The API requires the conversation to start with a user turn.
  while (cleaned.length && cleaned[0].role !== "user") cleaned.shift();
  if (!cleaned.length || cleaned[cleaned.length - 1].role !== "user") {
    return null;
  }
  return cleaned;
}

/* -------------------------------- Route -------------------------------- */

export async function POST(request: Request) {
  const ip = clientIp(request);

  // Emergency disable: an admin can pause all AI features from the Security
  // Center. When paused, the assistant is off and visitors go to the form.
  try {
    const { getSecuritySettings } = await import("@/lib/security-center/store");
    const settings = await getSecuritySettings();
    if (settings.aiPaused) {
      return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 503 });
    }
  } catch {
    /* settings unavailable — fail open to normal rate-limited behavior */
  }

  // Layered limits: short burst, per-IP daily ceiling, site-wide daily cap.
  if (!(await rateLimit(`chat:${ip}`, BURST_LIMIT, 5 * 60_000))) {
    return rateLimitResponse();
  }
  if (!(await rateLimit(`chat-day:${ip}`, DAILY_IP_LIMIT, 24 * 60 * 60_000))) {
    return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }
  if (!(await underGlobalDailyLimit())) {
    console.warn("[/api/chat] site-wide daily chat limit reached");
    return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Hard stop for marathon conversations (based on full history length,
  // before trimming) — the visitor is politely handed to the contact form.
  if (Array.isArray(body.messages) && body.messages.length > MAX_CONVERSATION_MESSAGES) {
    return NextResponse.json({ error: CONVERSATION_END_MESSAGE }, { status: 429 });
  }

  const incoming = sanitizeMessages(body.messages);
  if (!incoming) {
    return NextResponse.json({ error: "Invalid messages." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Chat isn't configured yet. Use the contact form below and we'll get back to you directly.",
      },
      { status: 503 }
    );
  }

  const bookingUrl = process.env.BOOKING_URL;
  const system = bookingUrl
    ? `${SYSTEM_PROMPT}\n\n# Booking\nA booking calendar exists. When a visitor wants to book a strategy call, share this exact link: ${bookingUrl}`
    : `${SYSTEM_PROMPT}\n\n# Booking\nThere is no online booking calendar. When a visitor wants to book a strategy call, direct them to the contact form in the Contact section of this site (or collect their details here with submit_lead).`;

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const convo: Anthropic.MessageParam[] = [...incoming];

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          // The public chatbot is the highest-volume AI path in the app and
          // the most visible when it breaks. The whole round is one recorded
          // call, so a mid-stream failure is classified the same way a
          // non-streaming one is — otherwise a stream that dies after emitting
          // bytes looks like a success to everything downstream.
          const final = await callProvider(
            {
              provider: "anthropic",
              operation: "ai.stream.public_chat",
              attempt: round + 1,
            },
            async () => {
              const stream = client.messages.stream({
                model: MODEL,
                max_tokens: MAX_OUTPUT_TOKENS,
                thinking: { type: "adaptive" },
                output_config: { effort: "low" },
                // Prompt caching: the tools + system prefix is identical on
                // every request, so cache reads cut its input cost ~90%
                // within the TTL.
                system: [
                  {
                    type: "text",
                    text: system,
                    cache_control: { type: "ephemeral" },
                  },
                ],
                tools: [SUBMIT_LEAD_TOOL],
                messages: convo,
              });

              for await (const event of stream) {
                if (
                  event.type === "content_block_delta" &&
                  event.delta.type === "text_delta"
                ) {
                  controller.enqueue(encoder.encode(event.delta.text));
                }
              }

              return stream.finalMessage();
            }
          );

          if (final.stop_reason === "tool_use") {
            convo.push({ role: "assistant", content: final.content });
            const results: Anthropic.ToolResultBlockParam[] = [];
            let leadCaptured = false;
            for (const block of final.content) {
              if (block.type === "tool_use") {
                let result = "Unknown tool.";
                if (block.name === "submit_lead") {
                  const outcome = await handleSubmitLead(block.input);
                  result = outcome.result;
                  leadCaptured ||= outcome.submitted;
                }
                results.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: result,
                });
              }
            }
            if (leadCaptured) {
              controller.enqueue(encoder.encode(QUALIFIED_LEAD_SENTINEL));
            }
            convo.push({ role: "user", content: results });
            continue; // let the model confirm to the visitor
          }

          if (final.stop_reason === "refusal") {
            controller.enqueue(
              encoder.encode(
                "I can't help with that one. Is there anything about your business or how RSG works that I can answer?"
              )
            );
          }
          break;
        }
      } catch (err) {
        console.error("[/api/chat]", err);
        controller.enqueue(
          encoder.encode(
            "Something went wrong on our end. Please try again, or reach us through the contact form in the Contact section."
          )
        );
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
