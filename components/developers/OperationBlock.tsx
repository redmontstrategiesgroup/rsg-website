import type { JsonSchema, OpenApiParameter } from "@/lib/apiv1/json-schema";
import type { OpenApiDocument, OpenApiOperation } from "@/lib/apiv1/openapi";
import { CodeBlock } from "./CodeBlock";
import { SchemaView, typeLabel } from "./SchemaView";

const METHOD_TONE: Record<string, string> = {
  GET: "bg-sky-400/15 text-sky-200",
  POST: "bg-emerald-400/15 text-emerald-200",
  PATCH: "bg-amber-400/15 text-amber-200",
  PUT: "bg-amber-400/15 text-amber-200",
  DELETE: "bg-rose-400/15 text-rose-200",
};

const AUDIENCE_LABEL: Record<OpenApiOperation["x-audience"], string> = {
  client: "Client key",
  admin: "Admin key",
  any: "Client or admin key",
  public: "No key",
};

const EXAMPLE_UUID = "3f7c1a9e-2b4d-4e8f-9a1c-5d6e7f8a9b0c";

export function OperationBlock({ method, path, op, doc }: { method: string; path: string; op: OpenApiOperation; doc: OpenApiDocument }) {
  const components = doc.components.schemas;
  const params = op.parameters.map((p) => resolveParam(p, doc));
  const body = op.requestBody?.content["application/json"];
  // Concrete statuses (200/201/302/503…) in declaration order; 4XX/5XX are the shared Error envelope.
  const concrete = Object.entries(op.responses).filter(([status]) => /^\d{3}$/.test(status));
  const [primary, ...others] = concrete;
  const primaryContent = primary?.[1].content ? Object.entries(primary[1].content)[0] : undefined;

  return (
    <article id={`op-${op.operationId}`} className="scroll-mt-28 border-t border-white/10 py-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`rounded px-2 py-0.5 font-mono text-[0.68rem] font-semibold tracking-wide ${METHOD_TONE[method] ?? "bg-white/10 text-white/80"}`}>{method}</span>
        <code className="break-all font-mono text-sm text-white/90">{path}</code>
      </div>
      <h3 className="mt-3 text-base font-medium text-white">{op.summary}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <Chip>{AUDIENCE_LABEL[op["x-audience"]]}</Chip>
        {op["x-scopes"].map((s) => (
          <Chip key={s} mono>
            {s}
          </Chip>
        ))}
        {op["x-idempotent"] && <Chip>Idempotency-Key required</Chip>}
        {op["x-rate-limit"] && (
          <Chip>
            {op["x-rate-limit"].limit} / {formatWindow(op["x-rate-limit"].window_seconds)}
          </Chip>
        )}
      </div>

      {params.length > 0 && (
        <Section title="Parameters">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[0.8rem]">
              <thead>
                <tr className="text-[0.62rem] uppercase tracking-label text-white/35">
                  <th scope="col" className="py-1.5 pr-3 font-normal">Name</th>
                  <th scope="col" className="py-1.5 pr-3 font-normal">In</th>
                  <th scope="col" className="py-1.5 pr-3 font-normal">Type</th>
                  <th scope="col" className="py-1.5 font-normal">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {params.map((p) => (
                  <tr key={`${p.in}-${p.name}`}>
                    <td className="py-2 pr-3 align-top">
                      <code className="font-mono text-white/85">{p.name}</code>
                      {p.required && <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-label text-amber-300/70">required</span>}
                    </td>
                    <td className="py-2 pr-3 align-top text-white/50">{p.in}</td>
                    <td className="py-2 pr-3 align-top font-mono text-white/50">{typeLabel(p.schema, components)}</td>
                    <td className="py-2 align-top text-white/50">{p.description ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {body && (
        <Section title="Request body">
          <SchemaView schema={body.schema} components={components} />
        </Section>
      )}

      <Section title="Example request">
        <CodeBlock code={curlFor(method, path, op, doc, params)} label="curl" />
      </Section>

      {primaryContent && (
        <Section title={`Response · ${primary?.[0]} · ${primaryContent[0]}`}>
          {primary?.[0].startsWith("3") && (
            <p className="mb-2 text-[0.8rem] text-white/50">Redirects via the <code className="font-mono">Location</code> header; the same details are also returned in the body.</p>
          )}
          <SchemaView schema={primaryContent[1].schema} components={components} />
        </Section>
      )}
      {others.length > 0 && (
        <Section title="Also returns">
          <ul className="space-y-1 text-[0.8rem] text-white/50">
            {others.map(([status, r]) => (
              <li key={status}>
                <code className="font-mono text-white/80">{status}</code> — {r.description} (same body)
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="font-mono text-[0.62rem] uppercase tracking-label text-white/35">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Chip({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span className={`rounded-full border border-white/10 px-2.5 py-0.5 text-[0.68rem] text-white/60 ${mono ? "font-mono" : ""}`}>{children}</span>
  );
}

type ResolvedParam = { name: string; in: string; required: boolean; description?: string; schema: JsonSchema };

function resolveParam(p: OpenApiParameter, doc: OpenApiDocument): ResolvedParam {
  if ("$ref" in p) {
    const key = p.$ref.split("/").pop() ?? "";
    return (doc.components.parameters[key] as ResolvedParam | undefined) ?? { name: key, in: "query", required: false, schema: {} };
  }
  return p;
}

function formatWindow(seconds: number): string {
  if (seconds % 3600 === 0) return seconds === 3600 ? "hour" : `${seconds / 3600} h`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} s`;
}

export function curlFor(method: string, path: string, op: OpenApiOperation, doc: OpenApiDocument, params: ResolvedParam[]): string {
  const url = `${doc.servers[0]?.url ?? ""}${path.replace(/\{[^}]+\}/g, (m) => (m === "{entity}" ? "actions" : EXAMPLE_UUID))}`;
  const query = params.filter((p) => p.in === "query" && p.name !== "cursor").slice(0, 2);
  const qs = query.length ? "?" + query.map((p) => `${p.name}=${sampleFor(p.schema)}`).join("&") : "";
  const lines = [`curl ${method === "GET" ? "" : `-X ${method} `}"${url}${qs}"`];
  if (op.security?.length) lines.push(`-H "Authorization: Bearer rsg_live_…"`);
  if (op["x-idempotent"]) lines.push(`-H "Idempotency-Key: ${EXAMPLE_UUID}"`);
  const body = op.requestBody?.content["application/json"];
  if (body) {
    lines.push(`-H "Content-Type: application/json"`);
    const example = body.example !== undefined ? body.example : skeleton(body.schema);
    // A single quote inside the JSON would end the shell string; '\'' is the POSIX escape.
    lines.push(`-d '${JSON.stringify(example).replace(/'/g, "'\\''")}'`);
  }
  return lines.join(" \\\n  ");
}

function sampleFor(schema: JsonSchema): string {
  if (Array.isArray(schema.enum) && schema.enum.length) return String(schema.enum[0]);
  if (schema.default !== undefined) return String(schema.default);
  if (schema.type === "integer" || schema.type === "number") return "25";
  return "…";
}

/** A minimal placeholder body when a request schema has no `.meta({ example })`. */
function skeleton(schema: JsonSchema): unknown {
  const props = schema.properties as Record<string, JsonSchema> | undefined;
  if (schema.type !== "object" || !props) return {};
  const required = new Set((schema.required as string[] | undefined) ?? []);
  return Object.fromEntries(
    Object.entries(props)
      .filter(([k]) => required.has(k))
      .map(([k, v]) => [k, Array.isArray(v.enum) ? v.enum[0] : v.type === "number" || v.type === "integer" ? 0 : v.type === "boolean" ? true : v.type === "array" ? [] : "…"]),
  );
}
