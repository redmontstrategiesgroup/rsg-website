import type Anthropic from "@anthropic-ai/sdk";
import { AiError, generateStructured, streamText, type StructuredSchema } from "@/lib/ai/proxy";
import { isTenantOverAiCap, recordAiUsage } from "@/lib/ai/usage";

/**
 * App-facing AI helpers — the single entry point every mounted app route uses.
 * They wrap lib/ai/proxy with the two things a tenant-scoped app must never
 * forget: a monthly spend CAP check and per-tenant usage METERING. Going
 * through here means an individual route cannot accidentally ship an uncapped,
 * unmetered AI call.
 *
 * Pass the tenant's clientId (requirePortalContext().client.id) as `clientId`.
 */

async function assertUnderCap(clientId: string): Promise<void> {
  if (await isTenantOverAiCap(clientId)) {
    throw new AiError("rate_limited", "Monthly AI usage limit reached for this account.");
  }
}

export async function appGenerateStructured<T>(opts: {
  clientId: string;
  app: string;
  system: string;
  input: string | Anthropic.MessageParam[];
  schema: StructuredSchema;
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  await assertUnderCap(opts.clientId);
  return generateStructured<T>({
    tenantId: opts.clientId,
    app: opts.app,
    system: opts.system,
    input: opts.input,
    schema: opts.schema,
    model: opts.model,
    maxTokens: opts.maxTokens,
    onUsage: recordAiUsage,
  });
}

export async function appStreamText(opts: {
  clientId: string;
  app: string;
  system: string;
  messages: Anthropic.MessageParam[];
  model?: string;
  maxTokens?: number;
  tools?: Anthropic.Tool[];
  onTool?: (name: string, input: unknown) => Promise<string> | string;
  maxToolRounds?: number;
}): Promise<ReadableStream<Uint8Array>> {
  await assertUnderCap(opts.clientId);
  return streamText({
    tenantId: opts.clientId,
    app: opts.app,
    system: opts.system,
    messages: opts.messages,
    model: opts.model,
    maxTokens: opts.maxTokens,
    tools: opts.tools,
    onTool: opts.onTool,
    maxToolRounds: opts.maxToolRounds,
    onUsage: recordAiUsage,
  });
}
