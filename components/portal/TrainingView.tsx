"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TrainingItem } from "@/lib/lifecycle/types";
import {
  Button,
  EmptyState,
  Modal,
  ProgressBar,
  StatusPill,
} from "@/components/portal/ui";
import { postJson } from "@/lib/api";

type Entry = {
  item: TrainingItem;
  required: boolean;
  completed: boolean;
  dueAt: string | null;
};

export function TrainingView({
  entries,
  stats,
}: {
  entries: Entry[];
  stats: { assigned: number; required: number; completedRequired: number; completedTotal: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Entry | null>(null);
  const [system, setSystem] = useState("all");
  const [busy, setBusy] = useState(false);

  const systems = useMemo(
    () => [...new Set(entries.map((e) => e.item.system_tag).filter(Boolean))],
    [entries],
  );
  const filtered = entries.filter(
    (e) => system === "all" || e.item.system_tag === system,
  );
  const requiredPct =
    stats.required > 0 ? (stats.completedRequired / stats.required) * 100 : 100;

  async function markComplete(entry: Entry) {
    setBusy(true);
    try {
      const res = await postJson("/api/portal/training", {
        action: "complete",
        trainingItemId: entry.item.id,
      });
      if (res.ok) {
        setOpen(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {stats.required > 0 && (
        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-white/70">Required training progress</p>
            <p className="font-mono text-xs text-white/50">
              {stats.completedRequired}/{stats.required} complete
            </p>
          </div>
          <div className="mt-3">
            <ProgressBar value={requiredPct} ariaLabel="Required training progress" />
          </div>
        </div>
      )}

      {systems.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {["all", ...systems].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSystem(s)}
              className={`border px-3 py-1.5 text-xs transition ${
                system === s
                  ? "border-crimson/60 bg-crimson/[0.08] text-white"
                  : "border-white/10 text-white/50 hover:border-white/30"
              }`}
            >
              {s === "all" ? "All systems" : s}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Training arrives with your systems"
            description="As each system launches, its guides and walkthroughs appear here for your whole team."
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((entry) => (
            <button
              key={entry.item.id}
              type="button"
              onClick={() => setOpen(entry)}
              className="card px-5 py-5 text-left transition hover:border-white/20"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-white/90">{entry.item.title}</p>
                {entry.completed ? (
                  <StatusPill status="completed" />
                ) : entry.required ? (
                  <StatusPill status="pending" label="Required" />
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/45">
                {entry.item.description}
              </p>
              <p className="mt-3 font-mono text-[0.58rem] uppercase tracking-label text-white/30">
                {entry.item.kind}
                {entry.item.duration_minutes ? ` · ${entry.item.duration_minutes} min` : ""}
                {entry.item.difficulty !== "beginner" ? ` · ${entry.item.difficulty}` : ""}
                {entry.dueAt
                  ? ` · due ${new Date(entry.dueAt).toLocaleDateString("en-US", { dateStyle: "medium" })}`
                  : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.item.title ?? ""}
        wide
        footer={
          open && !open.completed ? (
            <Button busy={busy} onClick={() => void markComplete(open)}>
              Mark as complete
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Close
            </Button>
          )
        }
      >
        {open && (
          <div className="space-y-4">
            {open.item.url && (
              <a
                href={open.item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-ghost inline-flex !px-5 !py-2.5 text-sm"
              >
                Open {open.item.kind === "video" ? "video" : "resource"} ↗
              </a>
            )}
            <div className="space-y-3 text-sm leading-relaxed text-white/70">
              {open.item.body
                .split(/\n{2,}/)
                .filter(Boolean)
                .map((para, i) => {
                  if (para.startsWith("#")) {
                    return (
                      <h3 key={i} className="pt-2 font-display text-base font-medium text-white">
                        {para.replace(/^#+\s*/, "")}
                      </h3>
                    );
                  }
                  if (/^\s*[-*]\s/m.test(para)) {
                    return (
                      <ul key={i} className="space-y-1.5">
                        {para
                          .split("\n")
                          .filter((l) => l.trim())
                          .map((line, j) => (
                            <li key={j} className="flex gap-2.5">
                              <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-crimson-light" />
                              {line.replace(/^\s*[-*]\s*/, "").replace(/^\d+\.\s*/, "")}
                            </li>
                          ))}
                      </ul>
                    );
                  }
                  return <p key={i}>{para}</p>;
                })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
