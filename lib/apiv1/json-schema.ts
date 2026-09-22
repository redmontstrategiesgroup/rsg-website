// lib/apiv1/json-schema.ts
/**
 * zod → JSON Schema / OpenAPI parameter helpers used by `openapi.ts`.
 * Pure: no `@/` imports, no I/O, so it is unit-tested directly.
 */
import { z, type ZodType } from "zod";

export type JsonSchema = Record<string, unknown>;

export type OpenApiParameter =
  | { $ref: string }
  | { name: string; in: "query" | "path" | "header"; required: boolean; description?: string; schema: JsonSchema };

/** Query/list parameters every list endpoint shares; emitted once under `components.parameters`. */
export const SHARED_PARAMETERS: Record<string, { name: string; in: "query"; required: false; description: string; schema: JsonSchema }> = {
  limit: { name: "limit", in: "query", required: false, description: "Page size, 1–100 (default 25).", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
  cursor: { name: "cursor", in: "query", required: false, description: "Opaque cursor from the previous page's `meta.next_cursor`.", schema: { type: "string" } },
};

export const ENTITY_NAMES = ["actions", "opportunities", "risks", "ideas"] as const;

/**
 * `io: "input"` documents what a caller may send (fields with defaults are optional);
 * `io: "output"` documents what we return (defaults applied, so those fields are present).
 */
export function zodToSchema(schema: ZodType, io: "input" | "output" = "output"): JsonSchema {
  const out = z.toJSONSchema(schema, { unrepresentable: "any", io }) as JsonSchema;
  delete out.$schema;
  delete out.example; // examples live on the media type object, not inside the schema
  return out;
}

/** Whether `schema` is a `z.object` we can split into named query parameters. */
function shapeOf(schema: ZodType | undefined): Record<string, ZodType> | null {
  if (!schema) return null;
  const def = (schema as unknown as { _zod?: { def?: { type?: string; shape?: Record<string, ZodType> } } })._zod?.def;
  return def?.type === "object" && def.shape ? def.shape : null;
}

export function queryToParameters(schema: ZodType | undefined): OpenApiParameter[] {
  const shape = shapeOf(schema);
  if (!shape) return [];
  const json = zodToSchema(schema as ZodType, "input");
  const required = new Set((json.required as string[] | undefined) ?? []);
  const props = (json.properties as Record<string, JsonSchema> | undefined) ?? {};
  return Object.keys(shape).map((name) => {
    if (name in SHARED_PARAMETERS) return { $ref: `#/components/parameters/${name}` };
    const prop = { ...(props[name] ?? {}) };
    const description = typeof prop.description === "string" ? prop.description : undefined;
    delete prop.description;
    return { name, in: "query", required: required.has(name), ...(description ? { description } : {}), schema: prop };
  });
}

export function pathParameters(path: string): OpenApiParameter[] {
  const names = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  return names.map((name) => {
    if (name === "entity") {
      return { name, in: "path", required: true, description: "Dashboard entity collection.", schema: { type: "string", enum: [...ENTITY_NAMES] } };
    }
    return { name, in: "path", required: true, schema: { type: "string", format: "uuid" } };
  });
}

/** The `example` set via `.meta({ example })`, if any. */
export function exampleFor(schema: ZodType | undefined): unknown {
  if (!schema) return undefined;
  const meta = (schema as { meta?: () => Record<string, unknown> | undefined }).meta?.();
  return meta && "example" in meta ? meta.example : undefined;
}
