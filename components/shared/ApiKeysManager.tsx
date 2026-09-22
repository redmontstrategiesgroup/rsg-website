"use client";

import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Banner, Button, EmptyState, Modal, SectionCard, StatusPill } from "@/components/portal/ui";
import { getCsrfToken } from "@/lib/api";
import { ApiKeyCreateModal } from "@/components/shared/ApiKeyCreateModal";
import type { ApiKeyDto } from "@/lib/apiv1/key-store";

export type { ApiKeyDto };

export type ApiKeysExtraColumn = {
  header: string;
  render: (k: ApiKeyDto & Record<string, unknown>) => ReactNode;
};

/** Coarse relative time; exact-enough for "last used" without a date library. */
function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

/**
 * Owns the table + create/revoke modals for a principal's API keys. Shared
 * by the client portal (Task 18's `ApiKeysView`, a thin wrapper around this)
 * and the admin console (Task 19's `ApiKeysAdminPanel`), which differ only
 * in `endpoint`, `scopes`, `allowedScopes`, and `extraColumns`.
 */
export function ApiKeysManager({
  endpoint,
  scopes,
  allowedScopes,
  extraColumns = [],
  initialKeys = [],
}: {
  endpoint: string;
  scopes: string[];
  /** Scopes the caller's role may grant; other scopes render disabled in create. */
  allowedScopes?: string[];
  extraColumns?: ApiKeysExtraColumn[];
  initialKeys?: ApiKeyDto[];
}) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyDto | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function revoke(id: string) {
    setBusy(true);
    setRevokeError(null);
    try {
      const res = await fetch(`${endpoint}/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
      });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        setRevokeTarget(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        const err = data as { error?: string };
        setRevokeError(err.error || "Couldn't revoke the key.");
      }
    } catch {
      setRevokeError("Couldn't revoke the key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/50">
          {keys.length} active key{keys.length === 1 ? "" : "s"}
        </p>
        <Button onClick={() => setCreating(true)}>Create key</Button>
      </div>

      <SectionCard title="API keys" padded={false}>
        {keys.length === 0 ? (
          <EmptyState
            icon={<KeyRound size={28} aria-hidden />}
            title="No API keys yet."
            description="Create a key to connect your own tools to this workspace."
            action={<Button onClick={() => setCreating(true)}>Create key</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-label text-white/40">
                  <th scope="col" className="px-5 py-3 font-normal">Name</th>
                  <th scope="col" className="px-5 py-3 font-normal">Prefix</th>
                  <th scope="col" className="px-5 py-3 font-normal">Scopes</th>
                  <th scope="col" className="px-5 py-3 font-normal">Last used</th>
                  <th scope="col" className="px-5 py-3 font-normal">Requests (30d)</th>
                  {extraColumns.map((col) => (
                    <th key={col.header} scope="col" className="px-5 py-3 font-normal">
                      {col.header}
                    </th>
                  ))}
                  <th scope="col" className="px-5 py-3 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="px-5 py-4 text-white/85">{k.name}</td>
                    <td className="px-5 py-4 font-mono text-xs text-white/60">
                      rsg_live_{k.key_prefix}&hellip;
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {k.scopes.map((s) => (
                          <StatusPill key={s} status={s} tone="neutral" label={s} />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-white/55">
                      {relativeTime(k.last_used_at)}
                    </td>
                    <td className="px-5 py-4 text-white/55">{k.requests_30d}</td>
                    {extraColumns.map((col) => (
                      <td key={col.header} className="px-5 py-4 text-white/55">
                        {col.render(k)}
                      </td>
                    ))}
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="danger"
                        onClick={() => setRevokeTarget(k)}
                        aria-label={`Revoke ${k.name}`}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <ApiKeyCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        scopes={scopes}
        allowedScopes={allowedScopes}
        endpoint={endpoint}
        onCreated={(key) => {
          setKeys((prev) => [key, ...prev]);
          router.refresh();
        }}
      />

      <Modal
        open={!!revokeTarget}
        onClose={() => {
          setRevokeTarget(null);
          setRevokeError(null);
        }}
        title="Revoke this key?"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setRevokeTarget(null);
                setRevokeError(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => revokeTarget && void revoke(revokeTarget.id)}
              busy={busy}
            >
              Revoke key
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-white/70">
            {revokeTarget?.name} will stop working immediately. Anything using this key will fail
            until you issue a new one.
          </p>
          {revokeError && <Banner tone="danger">{revokeError}</Banner>}
        </div>
      </Modal>
    </div>
  );
}
