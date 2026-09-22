"use client";

import { useEffect, useState } from "react";
import { Banner, Button, Modal, StatusPill } from "@/components/portal/ui";
import { getCsrfToken } from "@/lib/api";
import type { DeliveryDto } from "@/lib/webhooks/endpoints";

/**
 * Recent deliveries for one endpoint, with cursor "Load more" and a Replay
 * action on failed / dead-lettered rows. Reads `${endpoint}/${id}/deliveries`
 * and posts to `.../deliveries/${did}/replay` on the cookie routes.
 */
export function WebhookDeliveries({
  endpoint,
  endpointId,
  url,
  onClose,
}: {
  endpoint: string;
  endpointId: string;
  url: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<DeliveryDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replaying, setReplaying] = useState<string | null>(null);

  async function load(next: string | null, append: boolean) {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "25" });
      if (next) qs.set("cursor", next);
      const res = await fetch(`${endpoint}/${endpointId}/deliveries?${qs}`);
      const data = (await res.json().catch(() => ({}))) as { data?: DeliveryDto[]; meta?: { next_cursor: string | null }; error?: string };
      if (!res.ok) {
        setError(data.error || "Couldn't load deliveries.");
        return;
      }
      setRows((prev) => (append ? [...prev, ...(data.data ?? [])] : (data.data ?? [])));
      setCursor(data.meta?.next_cursor ?? null);
    } catch {
      setError("Couldn't load deliveries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointId]);

  async function replay(did: string) {
    setReplaying(did);
    setError(null);
    try {
      const res = await fetch(`${endpoint}/${endpointId}/deliveries/${did}/replay`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrfToken(), "idempotency-key": `ui-replay-${did}-${Date.now()}` },
      });
      const data = (await res.json().catch(() => ({}))) as { delivery?: DeliveryDto; error?: string };
      if (!res.ok || !data.delivery) {
        setError(data.error || "Couldn't replay that delivery.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === did ? data.delivery! : r)));
    } catch {
      setError("Couldn't replay that delivery.");
    } finally {
      setReplaying(null);
    }
  }

  const tone = (status: string) =>
    status === "delivered" ? "success" : status === "dead" || status === "failed" ? "danger" : "neutral";

  return (
    <Modal open onClose={onClose} title="Recent deliveries" wide footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      <p className="mb-4 truncate font-mono text-xs text-white/50" title={url}>{url}</p>
      {error && <Banner tone="danger">{error}</Banner>}
      {rows.length === 0 && !loading ? (
        <p className="text-sm text-white/50">Nothing has been sent to this endpoint yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-label text-white/40">
                <th scope="col" className="px-3 py-2 font-normal">Event</th>
                <th scope="col" className="px-3 py-2 font-normal">Status</th>
                <th scope="col" className="px-3 py-2 font-normal">Attempts</th>
                <th scope="col" className="px-3 py-2 font-normal">Last error</th>
                <th scope="col" className="px-3 py-2 font-normal">When</th>
                <th scope="col" className="px-3 py-2 font-normal"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-white/5">
                  <td className="px-3 py-3 font-mono text-xs text-white/70">{d.event_type}</td>
                  <td className="px-3 py-3"><StatusPill status={d.status} tone={tone(d.status)} label={d.status} /></td>
                  <td className="px-3 py-3 text-white/55">{d.attempts}/{d.max_attempts}</td>
                  <td className="max-w-[220px] truncate px-3 py-3 text-white/45" title={d.last_error ?? undefined}>
                    {d.last_error ?? (d.response_status ? `HTTP ${d.response_status}` : "—")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-white/55">{new Date(d.created_at).toLocaleString()}</td>
                  <td className="px-3 py-3 text-right">
                    {(d.status === "dead" || d.status === "failed") && (
                      <Button variant="ghost" busy={replaying === d.id} disabled={!!replaying} onClick={() => void replay(d.id)} aria-label={`Replay ${d.event_type} delivery`}>
                        Replay
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && (
        <div className="mt-4">
          <Button variant="ghost" busy={loading} onClick={() => void load(cursor, true)}>Load more</Button>
        </div>
      )}
    </Modal>
  );
}
