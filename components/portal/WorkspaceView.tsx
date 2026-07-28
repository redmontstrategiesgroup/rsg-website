"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientRequest, Message, StoredFile } from "@/lib/lifecycle/types";
import {
  REQUEST_CATEGORY_LABELS,
  type RequestCategory,
} from "@/lib/lifecycle/types";
import {
  Banner,
  Button,
  EmptyState,
  Modal,
  SectionCard,
  StatusPill,
  TabBar,
} from "@/components/portal/ui";
import { inputClass, Field } from "@/components/booking/ui";
import { postJson } from "@/lib/api";

const CATEGORY_OPTIONS = Object.entries(REQUEST_CATEGORY_LABELS) as [
  RequestCategory,
  string,
][];

/** Categories that may require a formal change order / added investment. */
const SCOPE_SENSITIVE: RequestCategory[] = ["new_feature", "scope_change"];

export function WorkspaceView({
  requests,
  threads,
  files,
  projects,
  userName,
}: {
  requests: ClientRequest[];
  threads: Record<string, Message[]>;
  files: StoredFile[];
  projects: { id: string; name: string }[];
  userName: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"requests" | "files">("requests");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // New request form
  const [category, setCategory] = useState<RequestCategory>("question");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [priority, setPriority] = useState("normal");
  const [reply, setReply] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter === "open" && ["resolved", "closed"].includes(r.status)) return false;
      if (statusFilter === "closed" && !["resolved", "closed"].includes(r.status)) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (threads[r.id] ?? []).some((m) => m.body.toLowerCase().includes(q))
      );
    });
  }, [requests, threads, search, statusFilter]);

  async function createRequest() {
    setError(null);
    if (title.trim().length < 3) {
      setError("Give your request a short title.");
      return;
    }
    setBusy(true);
    try {
      const res = await postJson("/api/portal/workspace", {
        action: "create_request",
        category,
        priority,
        title: title.trim(),
        description: description.trim(),
        projectId: projectId || undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't create the request.");
      setCreating(false);
      setTitle("");
      setDescription("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the request.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(requestId: string) {
    const body = (reply[requestId] ?? "").trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await postJson("/api/portal/workspace", {
        action: "message",
        requestId,
        body,
      });
      if (res.ok) {
        setReply((prev) => ({ ...prev, [requestId]: "" }));
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const res = await postJson("/api/portal/workspace", {
        action: "upload",
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type || "application/octet-stream",
        projectId: projects[0]?.id,
      });
      const data = (await res.json()) as { uploadUrl?: string; error?: string };
      if (!res.ok || !data.uploadUrl) throw new Error(data.error || "Upload rejected.");
      const put = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed — please try again.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function download(fileId: string) {
    const res = await postJson("/api/portal/workspace", { action: "download", fileId });
    const data = (await res.json()) as { url?: string };
    if (res.ok && data.url) window.open(data.url, "_blank", "noopener");
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabBar
          tabs={[
            { id: "requests" as const, label: "Requests", count: requests.filter((r) => !["resolved", "closed"].includes(r.status)).length },
            { id: "files" as const, label: "Files", count: files.length },
          ]}
          active={tab}
          onSelect={setTab}
        />
        {tab === "requests" ? (
          <Button onClick={() => setCreating(true)}>New request</Button>
        ) : (
          <>
            <Button onClick={() => fileInput.current?.click()} busy={busy}>
              Upload a file
            </Button>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      {tab === "requests" ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="search"
              className={`${inputClass(false)} max-w-xs !py-2.5 text-sm`}
              placeholder="Search requests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search requests"
            />
            <select
              className={`${inputClass(false)} w-auto !py-2.5 text-sm`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="closed">Resolved / closed</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="card">
              <EmptyState
                title={requests.length === 0 ? "No requests yet" : "Nothing matches"}
                description={
                  requests.length === 0
                    ? "Questions, content, revisions, new ideas — send anything here and it gets tracked to resolution."
                    : "Try a different search or filter."
                }
                action={
                  requests.length === 0 ? (
                    <Button onClick={() => setCreating(true)}>Make your first request</Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            filtered.map((r) => {
              const thread = threads[r.id] ?? [];
              const open = expanded === r.id;
              return (
                <div key={r.id} className="card">
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
                    onClick={() => setExpanded(open ? null : r.id)}
                    aria-expanded={open}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/90">
                        <span className="mr-2 font-mono text-[0.6rem] text-white/30">
                          #{r.number}
                        </span>
                        {r.title}
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        {REQUEST_CATEGORY_LABELS[r.category]} ·{" "}
                        {new Date(r.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                        {thread.length > 0 && ` · ${thread.length} message${thread.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.change_order_required && (
                        <StatusPill status="needs_change_order" label="May affect scope" />
                      )}
                      <StatusPill status={r.status} />
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-white/10 px-5 py-4">
                      {r.description && (
                        <p className="text-sm leading-relaxed text-white/65">{r.description}</p>
                      )}
                      {r.change_order_required && (
                        <p className="mt-3 border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-xs leading-relaxed text-amber-200/80">
                          This kind of request can change project scope. If it
                          does, we&rsquo;ll bring you a clear change order with
                          pricing before any work begins — nothing is ever
                          added silently.
                        </p>
                      )}
                      {r.resolution && (
                        <p className="mt-3 border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2 text-xs leading-relaxed text-emerald-200/80">
                          Resolution: {r.resolution}
                        </p>
                      )}
                      <div className="mt-4 space-y-3">
                        {thread.map((m) => (
                          <div
                            key={m.id}
                            className={`max-w-[85%] border px-3.5 py-2.5 ${
                              m.author_type === "client"
                                ? "ml-auto border-crimson/25 bg-crimson/[0.06]"
                                : "border-white/10 bg-white/[0.02]"
                            }`}
                          >
                            <p className="text-[0.65rem] text-white/35">
                              {m.author_type === "client" ? m.author_name || userName : "Redmont"}
                              {" · "}
                              {new Date(m.created_at).toLocaleString("en-US", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{m.body}</p>
                          </div>
                        ))}
                      </div>
                      {!["closed"].includes(r.status) && (
                        <div className="mt-4 flex gap-2">
                          <input
                            type="text"
                            className={`${inputClass(false)} !py-2.5 text-sm`}
                            placeholder="Write a reply…"
                            value={reply[r.id] ?? ""}
                            onChange={(e) =>
                              setReply((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void sendReply(r.id);
                              }
                            }}
                            aria-label="Reply"
                          />
                          <Button busy={busy} onClick={() => void sendReply(r.id)}>
                            Send
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="mt-6">
          <SectionCard padded={false}>
            {files.length === 0 ? (
              <EmptyState
                title="No files yet"
                description="Brand assets, documents, deliverables — everything shared in either direction is versioned and kept here."
              />
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {files.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white/85">{f.name}</p>
                      <p className="mt-0.5 text-[0.65rem] text-white/35">
                        {(f.size_bytes / 1024 / 1024).toFixed(1)} MB ·{" "}
                        {f.uploaded_by_type === "admin" ? "Redmont" : f.uploaded_by_name || "You"} ·{" "}
                        {new Date(f.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                        {f.current_version > 1 && ` · v${f.current_version}`}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => void download(f.id)}>
                      Download
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <p className="mt-4 text-[0.68rem] leading-relaxed text-white/30">
            Never share passwords through messages or file uploads. When we
            need access to a system, we&rsquo;ll send a secure credential
            request with instructions.
          </p>
        </div>
      )}

      {/* New request modal */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New request"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={createRequest} busy={busy}>
              Submit request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="What kind of request is this?">
            {(props) => (
              <select
                {...props}
                className={inputClass(false)}
                value={category}
                onChange={(e) => setCategory(e.target.value as RequestCategory)}
              >
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {SCOPE_SENSITIVE.includes(category) && (
            <p className="border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-xs leading-relaxed text-amber-200/80">
              New features and scope changes may require a formal change order
              with adjusted pricing — we&rsquo;ll always confirm with you first.
            </p>
          )}
          {category === "access_credentials" && (
            <p className="border border-sky-400/20 bg-sky-400/[0.05] px-3 py-2 text-xs leading-relaxed text-sky-200/80">
              Don&rsquo;t include any passwords here. Describe what access is
              needed and we&rsquo;ll follow up with a secure exchange method.
            </p>
          )}
          <Field label="Title">
            {(props) => (
              <input
                {...props}
                type="text"
                className={inputClass(false)}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A short summary"
              />
            )}
          </Field>
          <Field label="Details" optional>
            {(props) => (
              <textarea
                {...props}
                rows={4}
                className={inputClass(false)}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Anything that helps us act on this quickly."
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.length > 0 && (
              <Field label="Related project" optional>
                {(props) => (
                  <select
                    {...props}
                    className={inputClass(false)}
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  >
                    <option value="">Not project-specific</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
            <Field label="Priority">
              {(props) => (
                <select
                  {...props}
                  className={inputClass(false)}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">Low — whenever convenient</option>
                  <option value="normal">Normal</option>
                  <option value="high">High — this is blocking us</option>
                  <option value="urgent">Urgent</option>
                </select>
              )}
            </Field>
          </div>
          {error && (
            <p role="alert" className="text-xs text-crimson-light">{error}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
