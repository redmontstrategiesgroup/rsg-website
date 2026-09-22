import type { JsonSchema } from "@/lib/apiv1/json-schema";

/**
 * Renders a JSON Schema object as a nested definition list: name · type ·
 * required · description. Resolves `$ref`s against `components.schemas`.
 * Deliberately narrow — it covers what `z.toJSONSchema` emits for our DTOs
 * (objects, arrays, anyOf-with-null, enums, const) and falls back to a type
 * label for anything else.
 */
export function SchemaView({ schema, components, depth = 0 }: { schema: JsonSchema; components: Record<string, JsonSchema>; depth?: number }) {
  const s = resolve(schema, components);
  if (s.type === "object" && s.properties && typeof s.properties === "object") {
    const props = s.properties as Record<string, JsonSchema>;
    const required = new Set((s.required as string[] | undefined) ?? []);
    return (
      <dl className={depth === 0 ? "divide-y divide-white/5" : "mt-2 divide-y divide-white/5 border-l border-white/10 pl-3"}>
        {Object.entries(props).map(([name, prop]) => {
          const p = resolve(prop, components);
          const nested = nestedObject(p, components);
          return (
            <div key={name} className="py-2">
              <dt className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <code className="font-mono text-[0.78rem] text-white/85">{name}</code>
                <span className="font-mono text-[0.68rem] text-white/40">{typeLabel(p, components)}</span>
                {required.has(name) && <span className="font-mono text-[0.62rem] uppercase tracking-label text-amber-300/70">required</span>}
              </dt>
              {typeof p.description === "string" && <dd className="mt-0.5 text-[0.8rem] text-white/50">{p.description}</dd>}
              {nested && (
                <dd>
                  <SchemaView schema={nested} components={components} depth={depth + 1} />
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    );
  }
  return <p className="font-mono text-[0.78rem] text-white/60">{typeLabel(s, components)}</p>;
}

function resolve(schema: JsonSchema, components: Record<string, JsonSchema>): JsonSchema {
  const ref = schema.$ref;
  if (typeof ref === "string" && ref.startsWith("#/components/schemas/")) {
    return components[ref.slice("#/components/schemas/".length)] ?? schema;
  }
  return schema;
}

/** The object schema to render underneath a property, if it (or its array items / non-null branch) is one. */
function nestedObject(p: JsonSchema, components: Record<string, JsonSchema>): JsonSchema | null {
  const s = resolve(p, components);
  if (s.type === "object" && s.properties) return s;
  if (s.type === "array" && s.items && typeof s.items === "object") {
    const items = resolve(s.items as JsonSchema, components);
    return items.type === "object" && items.properties ? items : null;
  }
  const branch = nonNullBranch(s);
  return branch ? nestedObject(branch, components) : null;
}

function nonNullBranch(s: JsonSchema): JsonSchema | null {
  const anyOf = s.anyOf as JsonSchema[] | undefined;
  if (!anyOf) return null;
  const real = anyOf.filter((b) => b.type !== "null");
  return real.length === 1 ? real[0] : null;
}

export function typeLabel(p: JsonSchema, components: Record<string, JsonSchema>): string {
  const s = resolve(p, components);
  if (typeof s.$ref === "string") return s.$ref.split("/").pop() ?? "object";
  if (s.const !== undefined) return `"${String(s.const)}"`;
  if (Array.isArray(s.enum)) return (s.enum as unknown[]).map((v) => `"${String(v)}"`).join(" | ");
  const branch = nonNullBranch(s);
  if (branch) return `${typeLabel(branch, components)} | null`;
  if (s.type === "array") {
    const items = s.items && typeof s.items === "object" ? typeLabel(s.items as JsonSchema, components) : "any";
    return `${items}[]`;
  }
  if (typeof s.type === "string") {
    return s.format === "uuid" ? "uuid" : s.format === "date-time" ? "datetime" : s.format === "email" ? "email" : s.type;
  }
  if (Array.isArray(s.type)) return (s.type as string[]).join(" | ");
  return "any";
}
