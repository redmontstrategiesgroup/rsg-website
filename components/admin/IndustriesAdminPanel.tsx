"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { postJson, putJson } from "@/lib/api";
import { checkCompleteness } from "@/lib/industries/completeness";
import type {
  CompletenessReport,
  IndustryVertical,
  SecondaryIndustry,
} from "@/lib/industries/types";

/**
 * Admin management for the industry verticals: every section is editable,
 * a live completeness checklist gates publishing, and the secondary-
 * industries list is managed here too. Complex sections edit as validated
 * JSON; the server re-validates everything with zod on save.
 */

type VerticalRow = { vertical: IndustryVertical; completeness: CompletenessReport };

const SECTION_DEFS: { key: keyof IndustryVertical; label: string; hint: string }[] = [
  { key: "hero", label: "Hero", hint: "Headline, subheadline, CTAs, designed-for statement" },
  { key: "terminology", label: "Terminology", hint: "Industry words used in page copy" },
  { key: "audience", label: "Audience", hint: "Sub-segments listed in the hero" },
  { key: "problems", label: "Operational problems", hint: "Problem cards (unique per vertical)" },
  { key: "problemsIntro", label: "Problems intro", hint: "Paragraph above the problem cards" },
  { key: "workflow", label: "Workflow map", hint: "Stages with failures, systems, KPIs, integrations" },
  { key: "demo", label: "Demo section", hint: "Highlights, simulations, disclaimer" },
  { key: "systemsIntro", label: "Systems intro", hint: "Paragraph above the system cards" },
  { key: "systems", label: "Recommended systems", hint: "Named RSG systems with outcomes and pricing" },
  { key: "integrations", label: "Integrations", hint: "Items with connects-text plus the disclaimer" },
  { key: "roi", label: "ROI calculator", hint: "Inputs, assumption rates, disclaimer" },
  { key: "compliance", label: "Compliance", hint: "Industry-specific practices and disclaimer" },
  { key: "caseStudy", label: "Case study", hint: "Illustrative scenario (or verified results)" },
  { key: "ctas", label: "CTAs", hint: "Primary and secondary calls to action" },
  { key: "assessment", label: "Assessment", hint: "Questions and system recommendations" },
  { key: "faqs", label: "FAQs", hint: "Rendered on-page and in structured data" },
  { key: "seo", label: "SEO", hint: "Title and meta description" },
];

export function IndustriesAdminPanel() {
  const [rows, setRows] = useState<VerticalRow[]>([]);
  const [secondary, setSecondary] = useState<SecondaryIndustry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeSlug, setActiveSlug] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/industries");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { verticals: VerticalRow[]; secondary: SecondaryIndustry[] };
      setRows(data.verticals);
      setSecondary(data.secondary);
      setActiveSlug((prev) => prev || data.verticals[0]?.vertical.slug || "");
    } catch {
      setLoadError("Couldn't load industry content. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-16 text-sm text-white/50">
        <Loader2 size={16} className="animate-spin" /> Loading industry content…
      </div>
    );
  }
  if (loadError) {
    return <p className="py-16 text-sm text-crimson-light">{loadError}</p>;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => {
          const active = r.vertical.slug === activeSlug;
          return (
            <button
              key={r.vertical.slug}
              type="button"
              onClick={() => setActiveSlug(r.vertical.slug)}
              className={`inline-flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                active
                  ? "border-crimson/50 bg-crimson/[0.08] text-white"
                  : "border-white/10 bg-white/[0.02] text-white/55 hover:border-white/25"
              }`}
            >
              {r.vertical.shortName}
              <StatusChip vertical={r.vertical} completeness={r.completeness} />
            </button>
          );
        })}
      </div>

      {rows.map((r) =>
        r.vertical.slug === activeSlug ? (
          <VerticalEditor
            key={r.vertical.slug}
            initial={r.vertical}
            onSaved={(vertical, completeness) =>
              setRows((prev) =>
                prev.map((p) =>
                  p.vertical.slug === vertical.slug ? { vertical, completeness } : p
                )
              )
            }
          />
        ) : null
      )}

      <SecondaryEditor industries={secondary} onSaved={setSecondary} />
    </div>
  );
}

function StatusChip({
  vertical,
  completeness,
}: {
  vertical: IndustryVertical;
  completeness: CompletenessReport;
}) {
  const published = vertical.status === "published";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[0.52rem] uppercase tracking-label ${
        published
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          : "border-amber-400/30 bg-amber-400/10 text-amber-300"
      }`}
    >
      {published ? "Published" : completeness.complete ? "Draft — ready" : "Draft"}
    </span>
  );
}

function VerticalEditor({
  initial,
  onSaved,
}: {
  initial: IndustryVertical;
  onSaved: (v: IndustryVertical, c: CompletenessReport) => void;
}) {
  const [draft, setDraft] = useState<IndustryVertical>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const completeness = useMemo(() => checkCompleteness(draft), [draft]);

  const update = (patch: Partial<IndustryVertical>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setMessage(null);
  };

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await putJson("/api/admin/industries", { slug: draft.slug, content: draft });
      const data = (await res.json()) as {
        vertical?: IndustryVertical;
        completeness?: CompletenessReport;
        error?: string;
      };
      if (!res.ok || !data.vertical || !data.completeness) {
        setMessage({ tone: "error", text: data.error ?? "Save failed." });
        return;
      }
      setDraft(data.vertical);
      setDirty(false);
      setMessage({ tone: "ok", text: "Saved. Pages refresh within ~5 minutes." });
      onSaved(data.vertical, data.completeness);
    } catch {
      setMessage({ tone: "error", text: "Save failed — check your connection." });
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefaults() {
    if (!window.confirm(`Reset ${draft.shortName} to the authored defaults? Overrides are removed.`)) {
      return;
    }
    setResetting(true);
    setMessage(null);
    try {
      const res = await postJson("/api/admin/industries", { action: "reset", slug: draft.slug });
      const data = (await res.json()) as {
        vertical?: IndustryVertical;
        completeness?: CompletenessReport;
        error?: string;
      };
      if (!res.ok || !data.vertical || !data.completeness) {
        setMessage({ tone: "error", text: data.error ?? "Reset failed." });
        return;
      }
      setDraft(data.vertical);
      setDirty(false);
      setMessage({ tone: "ok", text: "Reset to authored defaults." });
      onSaved(data.vertical, data.completeness);
    } catch {
      setMessage({ tone: "error", text: "Reset failed — check your connection." });
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Editor column */}
      <div className="space-y-4 lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
          <div>
            <p className="font-display text-lg text-white">{draft.name}</p>
            <p className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-label text-white/35">
              /industries/{draft.slug} · demo /demos/{draft.demoSlug}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-white/55">
              Status
              <select
                value={draft.status}
                onChange={(e) => update({ status: e.target.value as IndustryVertical["status"] })}
                className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-white/85 focus:border-crimson/60 focus:outline-none"
              >
                <option value="draft">Draft (hidden, noindex)</option>
                <option value="published" disabled={!completeness.complete}>
                  Published{completeness.complete ? "" : " — blocked (incomplete)"}
                </option>
              </select>
            </label>
            <button
              type="button"
              onClick={resetToDefaults}
              disabled={resetting || saving}
              className="inline-flex items-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-sm text-white/55 transition-colors hover:border-white/30 hover:text-white disabled:opacity-40"
            >
              {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Reset
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving || resetting}
              className="btn-primary !px-4 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
              Save changes
            </button>
          </div>
        </div>

        {message && (
          <p
            role="status"
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.tone === "ok"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-crimson/40 bg-crimson/10 text-crimson-light"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="space-y-2.5">
          {SECTION_DEFS.map((def) => (
            <SectionEditor
              key={`${draft.slug}-${def.key}`}
              label={def.label}
              hint={def.hint}
              value={draft[def.key]}
              onApply={(next) => update({ [def.key]: next } as Partial<IndustryVertical>)}
            />
          ))}
        </div>
      </div>

      {/* Completeness column */}
      <div className="lg:col-span-4">
        <div className="sticky top-28 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/35">
              Content completeness
            </p>
            <span
              className={`font-mono text-[0.58rem] uppercase tracking-label ${
                completeness.complete ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {completeness.checks.filter((c) => c.ok).length}/{completeness.checks.length}
            </span>
          </div>
          <ul className="mt-5 space-y-2.5">
            {completeness.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    c.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-crimson/15 text-crimson-light"
                  }`}
                >
                  {c.ok ? <Check size={10} /> : <X size={10} />}
                </span>
                <div>
                  <p className={`text-[0.8rem] leading-snug ${c.ok ? "text-white/65" : "text-white"}`}>
                    {c.label}
                  </p>
                  {!c.ok && (
                    <p className="mt-0.5 text-[0.68rem] leading-relaxed text-white/40">{c.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!completeness.complete && (
            <p className="mt-5 flex items-start gap-2 border-t border-white/[0.08] pt-4 text-[0.72rem] leading-relaxed text-amber-300/80">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Publishing is blocked until every check passes — the page stays in draft (404 +
              noindex) meanwhile.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionEditor({
  label,
  hint,
  value,
  onApply,
}: {
  label: string;
  hint: string;
  value: unknown;
  onApply: (next: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [parseError, setParseError] = useState("");
  const isString = typeof value === "string";

  const openEditor = () => {
    setText(isString ? (value as string) : JSON.stringify(value, null, 2));
    setParseError("");
    setOpen(true);
  };

  const apply = () => {
    if (isString) {
      onApply(text);
      setOpen(false);
      return;
    }
    try {
      onApply(JSON.parse(text));
      setParseError("");
      setOpen(false);
    } catch {
      setParseError("Invalid JSON — fix the syntax and apply again.");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openEditor())}
        className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
        aria-expanded={open}
      >
        <span>
          <span className="text-sm font-medium text-white/80">{label}</span>
          <span className="ml-3 hidden text-[0.72rem] text-white/35 sm:inline">{hint}</span>
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-white/35 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-white/[0.08] p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={Math.min(24, Math.max(6, text.split("\n").length + 1))}
            className="w-full rounded-lg border border-white/12 bg-base/80 p-3 font-mono text-[0.72rem] leading-relaxed text-white/80 focus:border-crimson/60 focus:outline-none"
          />
          {parseError && <p className="mt-2 text-[0.72rem] text-crimson-light">{parseError}</p>}
          <div className="mt-3 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-white/45 transition-colors hover:text-white"
            >
              Cancel
            </button>
            <button type="button" onClick={apply} className="btn-primary !px-4 !py-2 text-sm">
              Apply to draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SecondaryEditor({
  industries,
  onSaved,
}: {
  industries: SecondaryIndustry[];
  onSaved: (items: SecondaryIndustry[]) => void;
}) {
  const [items, setItems] = useState<SecondaryIndustry[]>(industries);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setItems(industries);
  }, [industries]);

  const update = (i: number, patch: Partial<SecondaryIndustry>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    setDirty(true);
    setMessage("");
  };

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const cleaned = items.filter((i) => i.name.trim() && i.overlap.trim());
      const res = await postJson("/api/admin/industries", {
        action: "save_secondary",
        industries: cleaned,
      });
      const data = (await res.json()) as { secondary?: SecondaryIndustry[]; error?: string };
      if (!res.ok || !data.secondary) {
        setMessage(data.error ?? "Save failed.");
        return;
      }
      setItems(data.secondary);
      setDirty(false);
      setMessage("Saved.");
      onSaved(data.secondary);
    } catch {
      setMessage("Save failed — check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-lg text-white">Additional industries</p>
          <p className="mt-1 text-[0.78rem] text-white/40">
            Shown on /industries/additional — name plus the honest overlap with an existing system.
            No specialized claims.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setItems((prev) => [...prev, { name: "", overlap: "" }]);
              setDirty(true);
            }}
            className="rounded-lg border border-white/12 px-3 py-2 text-sm text-white/55 transition-colors hover:border-white/30 hover:text-white"
          >
            Add industry
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="btn-primary !px-4 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
            Save list
          </button>
        </div>
      </div>
      {message && <p className="mt-3 text-sm text-white/55">{message}</p>}
      <div className="mt-5 space-y-3">
        {items.map((item, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-12">
            <input
              value={item.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Industry name"
              maxLength={200}
              className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-white/85 placeholder:text-white/25 focus:border-crimson/60 focus:outline-none sm:col-span-3"
            />
            <input
              value={item.overlap}
              onChange={(e) => update(i, { overlap: e.target.value })}
              placeholder="Honest overlap with an existing RSG system"
              maxLength={600}
              className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-white/85 placeholder:text-white/25 focus:border-crimson/60 focus:outline-none sm:col-span-8"
            />
            <button
              type="button"
              onClick={() => {
                setItems((prev) => prev.filter((_, idx) => idx !== i));
                setDirty(true);
              }}
              aria-label={`Remove ${item.name || "row"}`}
              className="flex items-center justify-center rounded-lg border border-white/12 text-white/45 transition-colors hover:border-crimson/50 hover:text-crimson-light sm:col-span-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
