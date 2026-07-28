import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "@/lib/security";

/**
 * Shared server-side Anthropic proxy for the mounted apps (Observatory, Forge,
 * NEXUS, ...). Generalizes the pattern proven in app/api/chat: the API key,
 * system prompts, and tool schemas stay SERVER-SIDE and never reach the
 * browser — replacing each app's old browser-direct key.
 *
 * Callers pass a `tenantId` (from requirePortalContext().client.id) so usage is
 * attributed and rate-limited per tenant. Routes using this MUST set
 * `export const runtime = "nodejs"` (the SDK needs Node).
 *
 * Two shapes cover every app need:
 *   - generateStructured<T>() — non-streaming, forced-tool JSON (spec/scenario
 *     generation, NL parsing, briefs). The workhorse.
 *   - streamText()            — streaming plain text, optional agentic tool loop.
 *
 * Errors are typed (AiError) so routes map them to HTTP status without leaking
 * internals; use aiErrorResponse() for the default mapping.
 */

const DEFAULT_MODEL = process.env.AI_MODEL ?? "claude-sonnet-5";
const DEFAULT_MAX_TOKENS = 1024;

/**
 * Per-tenant request ceiling (a coarse abuse control). Token-level metering and
 * hard spend caps land separately with the ai_usage table; this bounds request
 * volume per tenant regardless of token size.
 */
const PER_TENANT_BURST = Number(process.env.AI_TENANT_BURST ?? 30);
const BURST_WINDOW_MS = 5 * 60_000;

export type AiFailureCode =
  | "not_configured" // no ANTHROPIC_API_KEY on the server
  | "paused" // admin kill-switch (Security Center)
  | "rate_limited" // per-tenant ceiling hit
  | "refused" // model declined the request
  | "upstream"; // Anthropic/network/tool-shape failure

export class AiError extends Error {
  readonly code: AiFailureCode;
  readonly status: number;
  constructor(code: AiFailureCode, message: string) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.status =
      code === "not_configured" || code === "paused"
        ? 503
        : code === "rate_limited"
          ? 429
          : code === "refused"
            ? 422
            : 502;
  }
}

/** Default AiError → Response mapping for route catch blocks. */
export function aiErrorResponse(err: unknown): Response {
  if (err instanceof AiError) {
    return Response.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error("[ai/proxy] unexpected error", err);
  return Response.json({ error: "AI request failed." }, { status: 500 });
}

/** Admin kill-switch (Security Center). A missing module → treated as not paused. */
async function aiPaused(): Promise<boolean> {
  try {
    const { getSecuritySettings } = await import("@/lib/security-center/store");
    const settings = await getSecuritySettings();
    return Boolean((settings as { aiPaused?: boolean }).aiPaused);
  } catch {
    return false;
  }
}

export type AiCallMeta = { tenantId: string; app: string };

/** Key present → not paused → under per-tenant rate limit. Throws AiError otherwise. */
async function preflight({ tenantId, app }: AiCallMeta): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiError("not_configured", "AI is not configured on this server.");
  }
  if (await aiPaused()) {
    throw new AiError("paused", "AI features are temporarily paused.");
  }
  if (!(await rateLimit(`ai:${app}:${tenantId}`, PER_TENANT_BURST, BURST_WINDOW_MS))) {
    throw new AiError("rate_limited", "AI request limit reached — try again shortly.");
  }
}

export type UsageRecord = {
  tenantId: string;
  app: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Optional usage sink. Phase-1 metering wires a persistent recorder (ai_usage
 * table) here; until then a route may pass its own, or omit it. Failures in the
 * sink are swallowed so metering can never break a user-facing call.
 */
export type OnUsage = (u: UsageRecord) => void | Promise<void>;

async function reportUsage(onUsage: OnUsage | undefined, u: UsageRecord): Promise<void> {
  if (!onUsage) return;
  try {
    await onUsage(u);
  } catch (err) {
    console.error("[ai/proxy] usage sink failed", err);
  }
}

function toMessages(input: string | Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  return typeof input === "string" ? [{ role: "user", content: input }] : input;
}

export type StructuredSchema = {
  name: string;
  description: string;
  input_schema: Anthropic.Tool["input_schema"];
};

/**
 * Non-streaming structured output. Forces a single tool call whose input_schema
 * IS your result shape, and returns the parsed tool input as T.
 *
 * Throws AiError: "not_configured" | "paused" | "rate_limited" before any call;
 * "refused" if the model declines; "upstream" on API or tool-shape failure.
 */
export async function generateStructured<T>(opts: {
  tenantId: string;
  app: string;
  system: string;
  input: string | Anthropic.MessageParam[];
  schema: StructuredSchema;
  model?: string;
  maxTokens?: number;
  onUsage?: OnUsage;
}): Promise<T> {
  await preflight(opts);
  const model = opts.model ?? DEFAULT_MODEL;
  const client = new Anthropic();

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      tools: [
        {
          name: opts.schema.name,
          description: opts.schema.description,
          input_schema: opts.schema.input_schema,
        },
      ],
      tool_choice: { type: "tool", name: opts.schema.name },
      messages: toMessages(opts.input),
    });
  } catch (err) {
    throw new AiError("upstream", `AI request failed: ${(err as Error).message}`);
  }

  await reportUsage(opts.onUsage, {
    tenantId: opts.tenantId,
    app: opts.app,
    model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  });

  if (message.stop_reason === "refusal") {
    throw new AiError("refused", "The model declined this request.");
  }

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === opts.schema.name,
  );
  if (!toolUse) {
    throw new AiError("upstream", "AI did not return the expected structured output.");
  }
  return toolUse.input as T;
}

/** Dispatch a tool call to app code; returns the tool_result string for the model. */
export type ToolHandler = (name: string, input: unknown) => Promise<string> | string;

/**
 * Streaming plain-text reply, with an optional agentic tool loop. Returns a
 * ReadableStream of UTF-8 text chunks for a `text/plain` Response. Tool calls
 * are dispatched to onTool; up to maxToolRounds iterations (default 3 when tools
 * are supplied, else 1).
 *
 * Preflight AiErrors reject the promise BEFORE streaming starts, so a route can
 * map them to a status code. Errors mid-stream are surfaced as a short in-band
 * message (the response has already begun) and logged server-side.
 */
export async function streamText(opts: {
  tenantId: string;
  app: string;
  system: string;
  messages: Anthropic.MessageParam[];
  model?: string;
  maxTokens?: number;
  tools?: Anthropic.Tool[];
  onTool?: ToolHandler;
  maxToolRounds?: number;
  onUsage?: OnUsage;
}): Promise<ReadableStream<Uint8Array>> {
  await preflight(opts);
  const model = opts.model ?? DEFAULT_MODEL;
  const maxRounds = opts.maxToolRounds ?? (opts.tools?.length ? 3 : 1);
  const client = new Anthropic();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const convo: Anthropic.MessageParam[] = [...opts.messages];
        for (let round = 0; round < maxRounds; round++) {
          const stream = client.messages.stream({
            model,
            max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
            system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
            ...(opts.tools?.length ? { tools: opts.tools } : {}),
            messages: convo,
          });

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }

          const final = await stream.finalMessage();
          await reportUsage(opts.onUsage, {
            tenantId: opts.tenantId,
            app: opts.app,
            model,
            inputTokens: final.usage.input_tokens,
            outputTokens: final.usage.output_tokens,
          });

          if (final.stop_reason === "tool_use" && opts.onTool) {
            convo.push({ role: "assistant", content: final.content });
            const results: Anthropic.ToolResultBlockParam[] = [];
            for (const block of final.content) {
              if (block.type === "tool_use") {
                let result: string;
                try {
                  result = await opts.onTool(block.name, block.input);
                } catch (e) {
                  result = `Tool error: ${(e as Error).message}`;
                }
                results.push({ type: "tool_result", tool_use_id: block.id, content: result });
              }
            }
            convo.push({ role: "user", content: results });
            continue; // let the model use the tool results
          }

          if (final.stop_reason === "refusal") {
            controller.enqueue(encoder.encode("[The assistant declined to respond to that.]"));
          }
          break;
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode("The assistant hit an error. Please try again in a moment."),
        );
        console.error(`[ai/proxy:${opts.app}] stream error`, err);
      }
      controller.close();
    },
  });
}
