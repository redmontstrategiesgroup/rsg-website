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
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";

/**
 * RSG consulting intake assistant. Claude Sonnet 5 via the official SDK —
 * the API key, system prompt, and knowledge base all stay server-side.
 * Streams plain text; the submit_lead tool hands qualified visitors into the
 * same lead pipeline as the contact form (file store / Supabase / Resend).
 */

const MODEL = process.env.CHAT_MODEL ?? "claude-sonnet-5";
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 2_000;
const MAX_TOOL_ROUNDS = 3;

const SYSTEM_PROMPT = `You are the intake assistant on the website of Redmont Strategies Group (RSG). You act like a calm, sharp, premium consulting intake assistant — not a generic AI helper, not a chatbot salesperson, not a hype-heavy AI agency bot.

# What RSG is
RSG is a business consulting and strategy company FIRST. AI automation, AI marketing, web development, CRM systems, booking systems, dashboards, and digital infrastructure are execution tools used to improve business operations and growth — never the identity.

Core message: RSG helps businesses find the leaks, fix the systems, and build the infrastructure needed to operate sharper.

When a visitor asks what RSG does, answer with:
"Redmont Strategies Group is a business consulting and AI strategy company. We help service businesses improve operations, lead conversion, follow-up, websites, CRM systems, and automation. We start with the business problem first, then build the right systems around it."

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

  // The API requires the conversation to start with a user turn.
  while (cleaned.length && cleaned[0].role !== "user") cleaned.shift();
  if (!cleaned.length || cleaned[cleaned.length - 1].role !== "user") {
    return null;
  }
  return cleaned;
}

/* -------------------------------- Route -------------------------------- */

export async function POST(request: Request) {
  if (!rateLimit(`chat:${clientIp(request)}`, 20, 5 * 60_000)) {
    return rateLimitResponse();
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const incoming = sanitizeMessages(body.messages);
  if (!incoming) {
    return NextResponse.json({ error: "Invalid messages." }, { status: 400 });
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
          const stream = client.messages.stream({
            model: MODEL,
            max_tokens: 1024,
            thinking: { type: "adaptive" },
            output_config: { effort: "low" },
            system,
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

          const final = await stream.finalMessage();

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
