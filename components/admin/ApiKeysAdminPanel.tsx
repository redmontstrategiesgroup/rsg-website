"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Banner } from "@/components/portal/ui";
import { ApiKeysManager, type ApiKeysExtraColumn } from "@/components/shared/ApiKeysManager";
import { WebhooksManager, type WebhookEventOption } from "@/components/shared/WebhooksManager";
import { TabBar } from "@/components/portal/ui";
import type { EndpointDto } from "@/lib/webhooks/endpoints";
import { ADMIN_SCOPES } from "@/lib/apiv1/scopes";
import type { ApiKeyDto } from "@/lib/apiv1/key-store";

type AdminApiKeyDto = ApiKeyDto & { created_by: string; principal_id?: string };

/** Shortens a UUID-ish id for display in the "Owner" column. */
function shortenId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

/**
 * Admin console's "API keys" tab. Fetches `GET /api/admin/apikeys` on
 * mount — for `manage_team` admins this returns every admin key (each
 * carrying `principal_id` and `created_by`); otherwise just the caller's
 * own keys — and renders the shared ApiKeysManager (Task 18's table +
 * create/revoke modals, extracted for reuse here) with admin-only extra
 * columns and scope gating from `allowed_scopes`.
 */
export function ApiKeysAdminPanel() {
  const [keys, setKeys] = useState<AdminApiKeyDto[] | null>(null);
  const [tab, setTab] = useState<"keys" | "webhooks">("keys");
  const [hooks, setHooks] = useState<{ endpoints: EndpointDto[]; events: WebhookEventOption[] } | null>(null);
  const [hooksError, setHooksError] = useState<string | null>(null);

  // Webhooks load on first switch to that tab so the keys tab stays as fast as before.
  useEffect(() => {
    if (tab !== "webhooks" || hooks) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/webhooks");
        const data = (await res.json().catch(() => ({}))) as { endpoints?: EndpointDto[]; events?: WebhookEventOption[]; error?: string };
        if (cancelled) return;
        if (!res.ok) { setHooksError(data.error || "Couldn't load webhooks."); return; }
        setHooks({ endpoints: data.endpoints ?? [], events: data.events ?? [] });
      } catch {
        if (!cancelled) setHooksError("Couldn't load webhooks.");
      }
    })();
    return () => { cancelled = true; };
  }, [tab, hooks]);
  const [allowedScopes, setAllowedScopes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/apikeys");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          const err = data as { error?: string };
          setError(err.error || "Couldn't load API keys.");
          return;
        }
        const ok = data as { keys: AdminApiKeyDto[]; allowed_scopes: string[] };
        setKeys(ok.keys ?? []);
        setAllowedScopes(ok.allowed_scopes ?? []);
      } catch {
        if (!cancelled) setError("Network error while loading API keys.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <Banner tone="danger">{error}</Banner>;
  }

  if (!keys) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Loading API keys&hellip;
      </div>
    );
  }

  // Only show "Owner" when the listing actually spans multiple principals
  // (the manage_team view); a single-owner listing doesn't need it.
  const showOwner = keys.some(
    (k) => k.principal_id && k.principal_id !== keys[0]?.principal_id,
  );

  const extraColumns: ApiKeysExtraColumn[] = [
    {
      header: "Created by",
      render: (k) => <span>{String((k as AdminApiKeyDto).created_by ?? "—")}</span>,
    },
    ...(showOwner
      ? [
          {
            header: "Owner",
            render: (k) => {
              const id = (k as AdminApiKeyDto).principal_id;
              return <span className="font-mono text-xs">{id ? shortenId(id) : "—"}</span>;
            },
          } satisfies ApiKeysExtraColumn,
        ]
      : []),
  ];

  return (
    <div>
      <TabBar
        tabs={[{ id: "keys", label: "API keys", count: keys.length }, { id: "webhooks", label: "Webhooks", count: hooks?.endpoints.length }]}
        active={tab}
        onSelect={setTab}
      />
      {tab === "keys" ? (
        <ApiKeysManager
          endpoint="/api/admin/apikeys"
          scopes={[...ADMIN_SCOPES]}
          allowedScopes={allowedScopes}
          initialKeys={keys}
          extraColumns={extraColumns}
        />
      ) : hooksError ? (
        <div className="mt-6"><Banner tone="danger">{hooksError}</Banner></div>
      ) : !hooks ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-white/50">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Loading webhooks&hellip;
        </div>
      ) : (
        <WebhooksManager endpoint="/api/admin/webhooks" events={hooks.events} initialEndpoints={hooks.endpoints} />
      )}
    </div>
  );
}
