"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  Plus,
  QrCode,
  Save,
  Trash2,
} from "lucide-react";
import type {
  ConnectAnalytics,
  ConnectLink,
  ConnectSettings,
} from "@/lib/connect-types";
import {
  defaultConnectLinks,
  defaultConnectSettings,
} from "@/lib/connect-defaults";
import { putJson } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

const inputClass =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 transition-colors focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20";

export function ConnectAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ConnectSettings>(defaultConnectSettings());
  const [links, setLinks] = useState<ConnectLink[]>(defaultConnectLinks());
  const [analytics, setAnalytics] = useState<ConnectAnalytics | null>(null);
  const [copied, setCopied] = useState(false);

  const publicUrl = `${SITE_URL}/connect`;
  const qrLanding = `${SITE_URL}/r/connect`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/connect");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? "Could not load Connect page.");
          return;
        }
        if (!cancelled) {
          setSettings(data.settings);
          setLinks(data.links);
          setAnalytics(data.analytics);
        }
      } catch {
        if (!cancelled) setError("Network error loading Connect page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(
    () => [...links].sort((a, b) => a.displayOrder - b.displayOrder),
    [links]
  );

  async function saveSecure() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await putJson("/api/admin/connect", { settings, links: sorted });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Save failed.");
        return;
      }
      setSettings(data.settings);
      setLinks(data.links);
      setMessage("Connect page published.");
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  function move(id: string, dir: -1 | 1) {
    const ordered = [...sorted];
    const idx = ordered.findIndex((l) => l.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= ordered.length) return;
    const tmp = ordered[idx];
    ordered[idx] = ordered[swap];
    ordered[swap] = tmp;
    setLinks(ordered.map((l, i) => ({ ...l, displayOrder: i })));
  }

  function updateLink(id: string, patch: Partial<ConnectLink>) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function addLink() {
    const id = `link-${crypto.randomUUID().slice(0, 8)}`;
    setLinks((prev) => [
      ...prev,
      {
        id,
        title: "New link",
        description: "",
        url: "/",
        icon: "link",
        badge: "",
        displayOrder: prev.length,
        featured: false,
        active: true,
        openNewTab: false,
        sources: [],
      },
    ]);
  }

  function removeLink(id: string) {
    setLinks((prev) =>
      prev.filter((l) => l.id !== id).map((l, i) => ({ ...l, displayOrder: i }))
    );
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy link.");
    }
  }

  function exportCsv() {
    if (!analytics) return;
    const rows = [
      ["metric", "value"],
      ["total_views", String(analytics.totalViews)],
      ["unique_visitors", String(analytics.uniqueVisitors)],
      ["link_clicks", String(analytics.linkClicks)],
      ["cta_clicks", String(analytics.ctaClicks)],
      ["form_completions", String(analytics.formCompletions)],
      ["qr_scans", String(analytics.qrScans)],
      ["ctr", analytics.clickThroughRate.toFixed(4)],
      ["conversion_rate", analytics.conversionRate.toFixed(4)],
      [],
      ["link_id", "title", "clicks"],
      ...analytics.byLink.map((l) => [l.id, l.title, String(l.clicks)]),
      [],
      ["source", "views", "clicks"],
      ...analytics.bySource.map((s) => [s.source, String(s.views), String(s.clicks)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rsg-connect-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/50">
        <Loader2 size={16} className="animate-spin" />
        Loading Connect page…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="display text-xl">Connect Page</h2>
          <p className="mt-1 text-sm text-white/45">
            Manage the official RSG link hub used on social, cards, and QR codes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyUrl}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white"
          >
            <Copy size={14} />
            {copied ? "Copied" : "Copy link"}
          </button>
          <a
            href="/api/admin/connect/qr?format=png"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white"
          >
            <QrCode size={14} />
            QR PNG
          </a>
          <a
            href="/api/admin/connect/qr?format=svg"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white"
          >
            <Download size={14} />
            QR SVG
          </a>
          <Link
            href="/connect"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white"
          >
            <Eye size={14} />
            Preview
          </Link>
          <button
            type="button"
            onClick={saveSecure}
            disabled={saving}
            className="btn-primary disabled:opacity-70"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Publish
          </button>
        </div>
      </div>

      {(error || message) && (
        <p
          role="status"
          className={`rounded-lg border px-3.5 py-2.5 text-sm ${
            error
              ? "border-crimson/30 bg-crimson-soft text-crimson-light"
              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          }`}
        >
          {error ?? message}
        </p>
      )}

      <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/55 sm:grid-cols-2">
        <p>
          Public URL:{" "}
          <a href={publicUrl} className="text-crimson-light hover:underline" target="_blank" rel="noreferrer">
            {publicUrl}
          </a>
        </p>
        <p>
          QR landing (stable):{" "}
          <span className="text-white/80">{qrLanding}</span>
        </p>
      </div>

      {analytics && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
              Analytics
            </h3>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Views", analytics.totalViews],
              ["Unique", analytics.uniqueVisitors],
              ["Clicks", analytics.linkClicks],
              ["Leads", analytics.formCompletions],
              ["CTA clicks", analytics.ctaClicks],
              ["QR scans", analytics.qrScans],
              ["CTR", `${Math.round(analytics.clickThroughRate * 1000) / 10}%`],
              ["Conv.", `${Math.round(analytics.conversionRate * 1000) / 10}%`],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="font-mono text-[0.52rem] uppercase tracking-label text-white/35">
                  {label}
                </p>
                <p className="mt-2 font-mono text-2xl text-white">{value}</p>
              </div>
            ))}
          </div>
          {analytics.byLink.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 font-mono text-[0.52rem] uppercase tracking-label text-white/35">
                    <th className="px-4 py-3 font-normal">Link</th>
                    <th className="px-4 py-3 font-normal">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.byLink.slice(0, 12).map((row) => (
                    <tr key={row.id} className="border-b border-white/[0.06]">
                      <td className="px-4 py-3 text-white/80">{row.title}</td>
                      <td className="px-4 py-3 font-mono text-white/55">{row.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-label text-white/40">
            Headline
          </span>
          <input
            className={inputClass}
            value={settings.headline}
            onChange={(e) => setSettings({ ...settings, headline: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-label text-white/40">
            Badge label
          </span>
          <input
            className={inputClass}
            value={settings.badgeLabel}
            onChange={(e) => setSettings({ ...settings, badgeLabel: e.target.value })}
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-label text-white/40">
            Description
          </span>
          <textarea
            rows={2}
            className={inputClass}
            value={settings.description}
            onChange={(e) => setSettings({ ...settings, description: e.target.value })}
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-white/60">
          <input
            type="checkbox"
            checked={settings.published}
            onChange={(e) => setSettings({ ...settings, published: e.target.checked })}
          />
          Published
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-crimson/25 bg-crimson/[0.04] p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[0.58rem] uppercase tracking-label text-crimson-light">
            Featured campaign
          </h3>
          <label className="inline-flex items-center gap-2 text-sm text-white/60">
            <input
              type="checkbox"
              checked={settings.campaignActive}
              onChange={(e) =>
                setSettings({ ...settings, campaignActive: e.target.checked })
              }
            />
            Active
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={inputClass}
            placeholder="Campaign title"
            value={settings.campaignTitle}
            onChange={(e) => setSettings({ ...settings, campaignTitle: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Badge"
            value={settings.campaignBadge}
            onChange={(e) => setSettings({ ...settings, campaignBadge: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="URL"
            value={settings.campaignUrl}
            onChange={(e) => setSettings({ ...settings, campaignUrl: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Description"
            value={settings.campaignDescription}
            onChange={(e) =>
              setSettings({ ...settings, campaignDescription: e.target.value })
            }
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["LinkedIn", "socialLinkedin"],
            ["Instagram", "socialInstagram"],
            ["Facebook", "socialFacebook"],
            ["Email", "socialEmail"],
          ] as const
        ).map(([label, key]) => (
          <label key={key} className="block">
            <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-label text-white/40">
              {label}
            </span>
            <input
              className={inputClass}
              value={settings[key]}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
            />
          </label>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
            Links
          </h3>
          <button
            type="button"
            onClick={addLink}
            className="inline-flex items-center gap-2 text-sm text-crimson-light hover:text-white"
          >
            <Plus size={14} /> Add link
          </button>
        </div>
        {sorted.map((link) => (
          <div
            key={link.id}
            className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => move(link.id, -1)} className="rounded border border-white/10 p-1.5 text-white/50 hover:text-white" aria-label="Move up">
                <ArrowUp size={14} />
              </button>
              <button type="button" onClick={() => move(link.id, 1)} className="rounded border border-white/10 p-1.5 text-white/50 hover:text-white" aria-label="Move down">
                <ArrowDown size={14} />
              </button>
              <span className="font-mono text-[0.52rem] text-white/30">{link.id}</span>
              <div className="ml-auto flex gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs text-white/50">
                  <input
                    type="checkbox"
                    checked={link.active}
                    onChange={(e) => updateLink(link.id, { active: e.target.checked })}
                  />
                  Active
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-white/50">
                  <input
                    type="checkbox"
                    checked={link.featured}
                    onChange={(e) => updateLink(link.id, { featured: e.target.checked })}
                  />
                  Featured
                </label>
                <button
                  type="button"
                  onClick={() => removeLink(link.id)}
                  className="rounded border border-white/10 p-1.5 text-white/40 hover:text-crimson-light"
                  aria-label="Delete link"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                value={link.title}
                onChange={(e) => updateLink(link.id, { title: e.target.value })}
                placeholder="Title"
              />
              <input
                className={inputClass}
                value={link.url}
                onChange={(e) => updateLink(link.id, { url: e.target.value })}
                placeholder="URL"
              />
              <input
                className={inputClass}
                value={link.description}
                onChange={(e) => updateLink(link.id, { description: e.target.value })}
                placeholder="Description"
              />
              <input
                className={inputClass}
                value={link.badge}
                onChange={(e) => updateLink(link.id, { badge: e.target.value })}
                placeholder="Badge (Featured / New / Popular)"
              />
              <input
                className={inputClass}
                value={link.icon}
                onChange={(e) => updateLink(link.id, { icon: e.target.value })}
                placeholder="Icon key"
              />
              <input
                className={inputClass}
                value={link.sources.join(",")}
                onChange={(e) =>
                  updateLink(link.id, {
                    sources: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Sources (instagram,linkedin) — empty = all"
              />
              <input
                className={inputClass}
                type="datetime-local"
                value={link.startsAt ? link.startsAt.slice(0, 16) : ""}
                onChange={(e) =>
                  updateLink(link.id, {
                    startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
              <input
                className={inputClass}
                type="datetime-local"
                value={link.expiresAt ? link.expiresAt.slice(0, 16) : ""}
                onChange={(e) =>
                  updateLink(link.id, {
                    expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-white/45">
              <input
                type="checkbox"
                checked={link.openNewTab}
                onChange={(e) => updateLink(link.id, { openNewTab: e.target.checked })}
              />
              Open in new tab <ExternalLink size={12} />
            </label>
          </div>
        ))}
      </section>
    </div>
  );
}
