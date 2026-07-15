import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAdminContext, requireAdmin } from "@/lib/admin-auth";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { toStr } from "@/lib/validate";

export const runtime = "nodejs";
// Agent runs can take a few minutes (web research in its environment).
export const maxDuration = 300;

/**
 * Internal pre-call research tool (admin only). Runs the RSG Managed Agent
 * against a lead's website and streams back a Business Systems Audit brief.
 * The agent runs in an isolated cloud environment; nothing here is reachable
 * by site visitors.
 */

const AGENT_ID =
  process.env.RSG_BRIEF_AGENT_ID ?? "agent_012rPRSdqbK3yfwUW52iJZvP";
const ENVIRONMENT_ID =
  process.env.RSG_BRIEF_ENV_ID ?? "env_01H6mxmz5kwPedwkdEmsMv21";

function kickoff(url: string, business: string, notes: string): string {
  return `You are preparing an INTERNAL pre-call brief for Redmont Strategies Group (RSG), a business consulting and AI strategy firm that helps service businesses fix lead flow, follow-up, website conversion, CRM, and operations.

Research this prospective client's website: ${url}
${business ? `Business name: ${business}\n` : ""}${notes ? `Context from the lead: ${notes}\n` : ""}
Visit the website (and search for the business if useful). Then write a "Business Systems Audit Brief" in markdown with exactly these sections:

## Snapshot
What the business is, what it sells, location/market — two or three sentences.

## Lead Capture Review
What exists on the site today: phone number placement, contact forms, booking/scheduling, chat, hours, response expectations. Note what is missing.

## Conversion & Follow-Up Risks
Where this business is most likely losing leads or revenue, based only on what you observed. Be specific.

## Quick Wins
Three to five concrete improvements RSG could implement, ordered by likely impact.

## Talking Points
Three or four questions or observations for the strategy call.

Rules: only state what you can verify from the website or search results — mark anything uncertain as "could not verify". No fabricated metrics, competitors, or claims. Keep the whole brief under 600 words. Output only the brief itself.`;
}

/** Minimal structural view of session events (avoids deep SDK type coupling). */
type SessionEvent = {
  type: string;
  content?: { type: string; text?: string }[];
  name?: string;
  stop_reason?: { type?: string };
  error?: { message?: string };
};

export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;

  if (!(await rateLimit(`brief:${clientIp(request)}`, 6, 10 * 60_000))) {
    return rateLimitResponse();
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY isn't configured — add it to the environment first." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const url = toStr(body.url).slice(0, 300);
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes(".")) {
      throw new Error("bad url");
    }
  } catch {
    return NextResponse.json(
      { error: "Enter a valid website URL (including https://)." },
      { status: 400 }
    );
  }
  const business = toStr(body.business).slice(0, 160);
  const notes = toStr(body.notes).slice(0, 1000);

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const say = (text: string) => controller.enqueue(encoder.encode(text));
      let sessionId: string | null = null;
      try {
        const session = await client.beta.sessions.create({
          agent: { type: "agent", id: AGENT_ID },
          environment_id: ENVIRONMENT_ID,
          title: `Audit brief: ${url}`,
        });
        sessionId = session.id;
        say(`Researching ${url} …\n\n`);

        // Stream-first, then send the kickoff (stream only delivers events
        // emitted after it opens).
        const stream = await client.beta.sessions.events.stream(session.id);
        await client.beta.sessions.events.send(session.id, {
          events: [
            {
              type: "user.message",
              content: [{ type: "text", text: kickoff(url, business, notes) }],
            },
          ],
        });

        for await (const raw of stream) {
          const event = raw as unknown as SessionEvent;

          if (event.type === "agent.message" && event.content) {
            for (const block of event.content) {
              if (block.type === "text" && block.text) say(block.text);
            }
          } else if (
            event.type === "agent.tool_use" ||
            event.type === "agent.mcp_tool_use"
          ) {
            say(`\n· ${event.name ?? "working"} …\n`);
          } else if (event.type === "session.error") {
            say(
              `\n\n[Agent error: ${event.error?.message ?? "unknown"} — try again.]`
            );
            break;
          } else if (event.type === "session.status_terminated") {
            say("\n\n[Session terminated unexpectedly — try again.]");
            break;
          } else if (event.type === "session.status_idle") {
            if (event.stop_reason?.type === "requires_action") {
              say(
                "\n\n[The agent paused for a tool confirmation. In the provider console, set the agent's tool permissions to always allow, then retry.]"
              );
            }
            break;
          }
        }
      } catch (err) {
        console.error("[/api/admin/brief]", err);
        say(
          "\n\n[Something went wrong generating the brief. Check the server logs and that the agent and environment IDs are valid.]"
        );
      } finally {
        // Sessions are per-run and disposable — archive to free resources.
        if (sessionId) {
          try {
            await client.beta.sessions.archive(sessionId);
          } catch {
            /* best effort */
          }
        }
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
