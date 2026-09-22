"use client";

import { useState } from "react";
import { Webhook } from "lucide-react";
import { Banner, Button, EmptyState, Modal, SectionCard, StatusPill } from "@/components/portal/ui";
import { Field, inputClass } from "@/components/booking/ui";
import { getCsrfToken, patchJson, postJson } from "@/lib/api";
import type { EndpointDto } from "@/lib/webhooks/endpoints";
import { WebhookDeliveries } from "@/components/shared/WebhookDeliveries";

export type WebhookEventOption = { type: string; description: string };

/**
 * Owns the endpoint table plus the create/edit, secret-reveal, delete and
 * deliveries modals. Shared by the portal Developers page and the admin
 * API-keys panel; the cookie `endpoint` decides whose endpoints it manages.
 */
export function WebhooksManager({
  endpoint,
  events,
  initialEndpoints = [],
}: {
  endpoint: string;
  events: WebhookEventOption[];
  initialEndpoints?: EndpointDto[];
}) {
  const [items, setItems] = useState(initialEndpoints);
  const [editing, setEditing] = useState<EndpointDto | "new" | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EndpointDto | null>(null);
  const [rotateTarget, setRotateTarget] = useState<EndpointDto | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<EndpointDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function mutate(run: () => Promise<Response>, onOk: (data: Record<string, unknown>) => void, failMsg: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await run();
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) || failMsg);
        return false;
      }
      onOk(data);
      return true;
    } catch {
      setError(failMsg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const upsert = (ep: EndpointDto) => setItems((prev) => (prev.some((p) => p.id === ep.id) ? prev.map((p) => (p.id === ep.id ? ep : p)) : [...prev, ep]));

  function statusOf(ep: EndpointDto): { label: string; tone: "success" | "neutral" | "danger" } {
    if (ep.disabled_at) return { label: "auto-disabled", tone: "danger" };
    return ep.enabled ? { label: "enabled", tone: "success" } : { label: "disabled", tone: "neutral" };
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/50">{items.length} endpoint{items.length === 1 ? "" : "s"}</p>
        <Button onClick={() => { setEditing("new"); setError(null); }}>Add endpoint</Button>
      </div>
      {notice && <Banner tone="info">{notice}</Banner>}

      <SectionCard title="Webhook endpoints" padded={false}>
        {items.length === 0 ? (
          <EmptyState
            icon={<Webhook size={28} aria-hidden />}
            title="No webhook endpoints yet."
            description="Add an HTTPS URL to receive signed events as they happen."
            action={<Button onClick={() => setEditing("new")}>Add endpoint</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-label text-white/40">
                  <th scope="col" className="px-5 py-3 font-normal">URL</th>
                  <th scope="col" className="px-5 py-3 font-normal">Events</th>
                  <th scope="col" className="px-5 py-3 font-normal">Status</th>
                  <th scope="col" className="px-5 py-3 font-normal">Failures</th>
                  <th scope="col" className="px-5 py-3 font-normal"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((ep) => {
                  const st = statusOf(ep);
                  return (
                    <tr key={ep.id} className="border-b border-white/5">
                      <td className="max-w-[320px] px-5 py-4">
                        <p className="truncate font-mono text-xs text-white/70" title={ep.url}>{ep.url}</p>
                        {ep.description && <p className="mt-1 truncate text-xs text-white/40">{ep.description}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {ep.events.slice(0, 3).map((e) => <StatusPill key={e} status={e} tone="neutral" label={e} />)}
                          {ep.events.length > 3 && <StatusPill status="more" tone="neutral" label={`+${ep.events.length - 3}`} />}
                        </div>
                      </td>
                      <td className="px-5 py-4"><StatusPill status={st.label} tone={st.tone} label={st.label} /></td>
                      <td className="px-5 py-4 text-white/55">{ep.failure_count}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button variant="ghost" onClick={() => { setEditing(ep); setError(null); }} aria-label={`Edit ${ep.url}`}>Edit</Button>
                          <Button variant="ghost" onClick={() => setDeliveriesFor(ep)} aria-label={`Deliveries for ${ep.url}`}>Deliveries</Button>
                          <Button
                            variant="ghost"
                            busy={busy}
                            aria-label={`Send a test event to ${ep.url}`}
                            onClick={() => void mutate(
                              () => postJson(`${endpoint}/${ep.id}/test`),
                              () => setNotice("Test event queued. It will be delivered on the next cron run."),
                              "Couldn't queue a test event.",
                            )}
                          >
                            Test
                          </Button>
                          <Button variant="ghost" onClick={() => setRotateTarget(ep)} aria-label={`Rotate secret for ${ep.url}`}>Rotate</Button>
                          <Button variant="danger" onClick={() => setDeleteTarget(ep)} aria-label={`Delete ${ep.url}`}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {error && !editing && !deleteTarget && !rotateTarget && <div className="p-5"><Banner tone="danger">{error}</Banner></div>}
      </SectionCard>

      {editing && (
        <EndpointForm
          endpoint={endpoint}
          events={events}
          existing={editing === "new" ? null : editing}
          busy={busy}
          error={error}
          onCancel={() => { setEditing(null); setError(null); }}
          onSave={async (body) => {
            const isNew = editing === "new";
            const ok = await mutate(
              () => (isNew ? postJson(endpoint, body) : patchJson(`${endpoint}/${(editing as EndpointDto).id}`, body)),
              (data) => {
                upsert(data.endpoint as EndpointDto);
                if (isNew && typeof data.secret === "string") setSecret(data.secret);
              },
              "Couldn't save the endpoint.",
            );
            if (ok) setEditing(null);
          }}
        />
      )}

      <Modal
        open={!!secret}
        onClose={() => setSecret(null)}
        title="Copy your signing secret"
        footer={<Button onClick={() => setSecret(null)}>Done</Button>}
      >
        <p className="mb-3 text-sm text-white/70">Use it to verify the <code className="font-mono">x-rsg-signature</code> header. This is the only time we&rsquo;ll show it.</p>
        <div className="flex gap-2">
          <input readOnly value={secret ?? ""} aria-label="Signing secret" className={`${inputClass()} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
          <Button variant="ghost" onClick={() => { if (secret) void navigator.clipboard.writeText(secret); }} aria-label="Copy secret to clipboard">Copy</Button>
        </div>
      </Modal>

      <Modal
        open={!!rotateTarget}
        onClose={() => { setRotateTarget(null); setError(null); }}
        title="Rotate signing secret?"
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => { setRotateTarget(null); setError(null); }}>Cancel</Button>
            <Button
              busy={busy}
              onClick={() => rotateTarget && void mutate(
                () => postJson(`${endpoint}/${rotateTarget.id}/rotate`),
                (data) => { setRotateTarget(null); if (typeof data.secret === "string") setSecret(data.secret); },
                "Couldn't rotate the secret.",
              )}
            >
              Rotate
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/70">Deliveries signed with the old secret will stop verifying immediately. Update your receiver first.</p>
        {error && <Banner tone="danger">{error}</Banner>}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setError(null); }}
        title="Delete endpoint?"
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => { setDeleteTarget(null); setError(null); }}>Cancel</Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() => deleteTarget && void mutate(
                () => fetch(`${endpoint}/${deleteTarget.id}`, { method: "DELETE", headers: { "x-csrf-token": getCsrfToken() } }),
                () => { setItems((prev) => prev.filter((p) => p.id !== deleteTarget.id)); setDeleteTarget(null); },
                "Couldn't delete the endpoint.",
              )}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/70">{deleteTarget?.url} will stop receiving events and its delivery history will be removed.</p>
        {error && <Banner tone="danger">{error}</Banner>}
      </Modal>

      {deliveriesFor && (
        <WebhookDeliveries endpoint={endpoint} endpointId={deliveriesFor.id} url={deliveriesFor.url} onClose={() => setDeliveriesFor(null)} />
      )}
    </div>
  );
}

function EndpointForm({
  events,
  existing,
  busy,
  error,
  onCancel,
  onSave,
}: {
  endpoint: string;
  events: WebhookEventOption[];
  existing: EndpointDto | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (body: { url: string; events: string[]; description?: string; enabled?: boolean }) => Promise<void>;
}) {
  const [url, setUrl] = useState(existing?.url ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(existing?.events ?? []));
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);

  const groups = Array.from(
    events.reduce((m, e) => {
      const g = e.type.split(".")[0] ?? e.type;
      m.set(g, [...(m.get(g) ?? []), e]);
      return m;
    }, new Map<string, WebhookEventOption[]>()),
  );

  return (
    <Modal
      open
      onClose={onCancel}
      title={existing ? "Edit endpoint" : "Add endpoint"}
      wide
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button
            busy={busy}
            disabled={!url || selected.size === 0}
            onClick={() => void onSave({
              url: url.trim(),
              events: Array.from(selected),
              description: description.trim() || undefined,
              ...(existing ? { enabled } : {}),
            })}
          >
            {existing ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Endpoint URL" hint="HTTPS only. We POST a signed JSON body for every subscribed event.">
          {(p) => <input {...p} type="url" value={url} maxLength={2048} onChange={(e) => setUrl(e.target.value)} className={inputClass()} placeholder="https://hooks.example.com/rsg" />}
        </Field>
        <Field label="Description" optional>
          {(p) => <input {...p} type="text" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} className={inputClass()} />}
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm text-white/70">Events</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map(([group, list]) => (
              <div key={group} className="rounded-lg border border-white/10 p-3">
                <p className="mb-2 font-mono text-[0.6rem] uppercase tracking-label text-white/40">{group}</p>
                {list.map((e) => (
                  <label key={e.type} className="flex min-h-[44px] cursor-pointer items-start gap-2 py-1 text-sm text-white/80">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(e.type)}
                      onChange={(ev) => setSelected((prev) => { const n = new Set(prev); if (ev.target.checked) n.add(e.type); else n.delete(e.type); return n; })}
                    />
                    <span>
                      <span className="font-mono text-xs">{e.type}</span>
                      <span className="block text-xs text-white/45">{e.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </fieldset>
        {existing && (
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled{existing.disabled_at ? " (re-enabling clears the auto-disable)" : ""}
          </label>
        )}
        {error && <Banner tone="danger">{error}</Banner>}
      </div>
    </Modal>
  );
}
