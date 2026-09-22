import type { OpenApiDocument, OpenApiOperation } from "@/lib/apiv1/openapi";
import type { ProseSection } from "@/lib/developers/content";
import { CodeBlock } from "./CodeBlock";
import { OperationBlock } from "./OperationBlock";
import { SchemaView } from "./SchemaView";

type Entry = { method: string; path: string; op: OpenApiOperation };

function slug(tag: string): string {
  return `tag-${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function groupByTag(doc: OpenApiDocument): { tag: string; entries: Entry[] }[] {
  const byTag = new Map<string, Entry[]>();
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (!op) continue;
      const tag = op.tags[0] ?? "Other";
      (byTag.get(tag) ?? byTag.set(tag, []).get(tag)!).push({ method: method.toUpperCase(), path, op });
    }
  }
  return doc.tags.map((t) => ({ tag: t.name, entries: byTag.get(t.name) ?? [] })).filter((g) => g.entries.length > 0);
}

export function DeveloperDocs({ doc, prose }: { doc: OpenApiDocument; prose: ProseSection[] }) {
  const groups = groupByTag(doc);
  const webhookEvents = Object.entries(doc.webhooks);
  const operationCount = groups.reduce((n, g) => n + g.entries.length, 0);

  return (
    <section className="container-px py-12 sm:py-24">
      <div className="max-w-3xl">
        <p className="label">Developers</p>
        <h1 className="display mt-6 text-3xl sm:text-4xl">API reference</h1>
        <p className="mt-3 font-mono text-[0.72rem] sm:text-[0.62rem] uppercase tracking-label text-white/35">
          v{doc.info.version} · {operationCount} operations · {webhookEvents.length} webhook events · OpenAPI 3.1
        </p>
        <p className="mt-6 text-sm leading-relaxed text-white/55">
          Everything on this page is generated from the same definitions that serve the API, so it cannot drift from what is deployed.
        </p>
        <a
          href="/api/v1/openapi.json"
          className="mt-4 inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
        >
          Download OpenAPI (JSON)
        </a>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="API reference" className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
          <p className="font-mono text-[0.62rem] uppercase tracking-label text-white/35">Guide</p>
          <ul className="mt-2 text-sm">
            {prose.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex min-h-11 items-center text-white/60 transition hover:text-white">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-8 font-mono text-[0.62rem] uppercase tracking-label text-white/35">Reference</p>
          <ul className="mt-2 text-sm">
            {groups.map((g) => (
              <li key={g.tag}>
                <a href={`#${slug(g.tag)}`} className="flex min-h-11 items-center text-white/60 transition hover:text-white">
                  {g.tag}
                </a>
              </li>
            ))}
            <li>
              <a href="#webhook-events" className="flex min-h-11 items-center text-white/60 transition hover:text-white">
                Webhook events
              </a>
            </li>
          </ul>
        </nav>

        <div className="min-w-0">
          <div className="space-y-12 text-sm leading-relaxed text-white/55">
            {prose.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <h2 className="text-lg font-medium text-white">{s.title}</h2>
                {s.paragraphs.map((p, i) => (
                  <p key={i} className="mt-3">
                    {p}
                  </p>
                ))}
                {s.code && <CodeBlock code={s.code.body} label={s.code.lang} />}
                {s.table && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-[0.8rem]">
                      <thead>
                        <tr className="text-[0.62rem] uppercase tracking-label text-white/35">
                          {s.table.head.map((h) => (
                            <th key={h} scope="col" className="py-1.5 pr-3 font-normal">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {s.table.rows.map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => (
                              <td key={j} className={`py-2 pr-3 align-top ${j === 0 ? "font-mono text-white/85" : "text-white/50"}`}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>

          {groups.map((g) => (
            <section key={g.tag} id={slug(g.tag)} className="mt-16 scroll-mt-28">
              <p className="label">{g.tag}</p>
              <div className="mt-4">
                {g.entries.map((e) => (
                  <OperationBlock key={e.op.operationId} method={e.method} path={e.path} op={e.op} doc={doc} />
                ))}
              </div>
            </section>
          ))}

          <section id="webhook-events" className="mt-16 scroll-mt-28">
            <p className="label">Webhook events</p>
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              Each event is delivered as a POST to your endpoint with the headers described under Webhooks. <code className="font-mono text-white/75">data</code> carries the same object the REST API returns for that resource.
            </p>
            <div className="mt-4">
              {webhookEvents.map(([type, { post }]) => (
                <article key={type} id={`event-${type.replace(/\./g, "-")}`} className="scroll-mt-28 border-t border-white/10 py-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <code className="font-mono text-sm text-white/90">{type}</code>
                    <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[0.68rem] text-white/60">
                      {post["x-audience"] === "any" ? "Client and admin endpoints" : post["x-audience"] === "admin" ? "Admin endpoints" : "Client endpoints"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/55">{post.summary}</p>
                  {post.requestBody && (
                    <div className="mt-3">
                      <SchemaView schema={post.requestBody.content["application/json"].schema} components={doc.components.schemas} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
