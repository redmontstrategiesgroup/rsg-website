"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Banner, Button, Modal } from "@/components/portal/ui";
import { Field, inputClass } from "@/components/booking/ui";
import { postJson } from "@/lib/api";
import type { ApiKeyDto } from "@/lib/apiv1/key-store";

/** Groups scopes like "projects:read" / "projects:write" under "projects". */
function groupScopes(scopes: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const s of scopes) {
    const resource = s.split(":")[0] ?? s;
    groups.set(resource, [...(groups.get(resource) ?? []), s]);
  }
  return [...groups.entries()];
}

/**
 * Create-key flow: a name + grouped scope checkboxes, then (on success) a
 * one-time plaintext reveal. Shared between the portal (Task 18) and the
 * admin console (Task 19) via ApiKeysManager. Split out to keep both this
 * file and ApiKeysManager under the repo's ~250-line component guideline.
 */
export function ApiKeyCreateModal({
  open,
  onClose,
  scopes,
  allowedScopes,
  endpoint,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  scopes: string[];
  /** Scopes the caller's role may grant. When set, other scopes are shown but disabled. */
  allowedScopes?: string[];
  endpoint: string;
  onCreated: (key: ApiKeyDto) => void;
}) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const grouped = groupScopes(scopes);
  const isAllowed = (scope: string) => !allowedScopes || allowedScopes.includes(scope);

  function reset() {
    setName("");
    setSelectedScopes([]);
    setPlaintext(null);
    setCopied(false);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  function toggleScope(scope: string) {
    if (!isAllowed(scope)) return;
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function createKey() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Give the key a name.");
      return;
    }
    if (selectedScopes.length === 0) {
      setError("Choose at least one scope.");
      return;
    }
    setBusy(true);
    try {
      const res = await postJson(endpoint, { name: name.trim(), scopes: selectedScopes });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data as { error?: string };
        throw new Error(err.error || "Couldn't create the key.");
      }
      const ok = data as { key: ApiKeyDto; plaintext: string };
      onCreated(ok.key);
      setPlaintext(ok.plaintext);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the key.");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!plaintext) return;
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
    } catch {
      // Clipboard API unavailable (older browser, denied permission); the
      // key stays visible in the read-only field for manual copy.
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={plaintext ? "Copy your key" : "Create an API key"}
      footer={
        plaintext ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void createKey()} busy={busy}>
              Create key
            </Button>
          </>
        )
      }
    >
      {plaintext ? (
        <div className="space-y-4">
          <Banner tone="warning" title="This is the only time we&rsquo;ll show it.">
            Copy it now and store it somewhere safe, you won&rsquo;t be able to see it again.
          </Banner>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={plaintext}
              aria-label="Your new API key"
              className={`${inputClass(false)} font-mono text-xs`}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button variant="ghost" onClick={() => void copyKey()} aria-label="Copy key to clipboard">
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <Field label="Key name">
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={80}
                className={inputClass(false)}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zapier integration"
              />
            )}
          </Field>
          <fieldset>
            <legend className="mb-2 text-xs uppercase tracking-label text-white/40">Scopes</legend>
            <div className="space-y-3">
              {grouped.map(([resource, group]) => (
                <div key={resource}>
                  <p className="mb-1.5 text-xs font-medium capitalize text-white/60">{resource}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {group.map((scope) => {
                      const allowed = isAllowed(scope);
                      return (
                        <label
                          key={scope}
                          className={`flex min-h-11 items-center gap-2 text-sm ${
                            allowed ? "text-white/80" : "text-white/35"
                          }`}
                          title={allowed ? undefined : "Your role doesn't include this scope"}
                        >
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes(scope)}
                            disabled={!allowed}
                            onChange={() => toggleScope(scope)}
                            className="h-4 w-4 rounded border-white/30 bg-white/[0.03] text-crimson focus-visible:ring-2 focus-visible:ring-crimson/60 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          {scope}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
          {error && <Banner tone="danger">{error}</Banner>}
        </div>
      )}
    </Modal>
  );
}
