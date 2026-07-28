"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Bell, ClipboardList, Minus, Plus, Tag } from "lucide-react";
import { uid } from "../engine";
import type { Product, ProductStatus } from "../types";
import { EmptyState, PanelHeading, SampleDataTag, StatusPill } from "./primitives";
import { SmallButton } from "./fields";
import { applyNow, type ViewProps } from "./shared";

const STATUS_META: Record<ProductStatus, { label: string; tone: "green" | "amber" | "red" | "gray" | "crimson" }> = {
  "in-stock": { label: "In stock", tone: "green" },
  "low-stock": { label: "Low stock", tone: "amber" },
  reorder: { label: "Reorder recommended", tone: "crimson" },
  overstocked: { label: "Overstocked", tone: "gray" },
  "out-of-stock": { label: "Out of stock", tone: "red" },
  "slow-moving": { label: "Slow moving", tone: "gray" },
};

/** Deterministic accent block used as the product-image placeholder. */
function ProductSwatch({ name }: { name: string }) {
  const hues = ["#b3243a", "#2563eb", "#0d9488", "#7c3aed", "#b45309", "#475569"];
  const hue = hues[name.length % hues.length];
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/10 text-[0.62rem] font-medium text-white/80"
      style={{ backgroundColor: `${hue}22`, borderColor: `${hue}44` }}
      aria-hidden
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/**
 * Inventory module. Rendered only for industries whose config provides
 * `inventory` (e.g. retail). Stock changes, purchase orders, and markdown
 * campaigns are simulated inside the visitor's isolated session.
 */
export function InventoryView(props: ViewProps) {
  const { state, config, dispatch, track, openRequest } = props;
  const inv = config.inventory;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const categories = useMemo(() => [...new Set(state.products.map((p) => p.category))], [state.products]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.products.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q)) &&
        (!category || p.category === category) &&
        (!status || p.status === status),
    );
  }, [state.products, query, category, status]);

  if (!inv) return <EmptyState text="This demo doesn't include inventory." />;

  const needsReorder = state.products.filter((p) => ["low-stock", "reorder", "out-of-stock"].includes(p.status));
  const slowMovers = state.products.filter((p) => ["slow-moving", "overstocked"].includes(p.status));

  const adjustStock = (p: Product, delta: number) => {
    applyNow(dispatch, [{ kind: "stock", productId: p.id, delta }]);
    track("updated inventory stock");
  };

  const purchaseOrder = () => {
    if (needsReorder.length === 0) return;
    const lines = needsReorder.map((p) => `${p.name} ×${Math.max(p.reorderPoint * 2 - p.stock, 1)}`).join(", ");
    applyNow(dispatch, [
      {
        kind: "workflowRun",
        run: {
          id: uid("run"),
          automationId: "inventory-po",
          name: "Purchase order draft",
          detail: `Simulated PO drafted for ${needsReorder.length} products: ${lines.slice(0, 140)}${lines.length > 140 ? "…" : ""}`,
          time: "Just now",
          simulated: true,
        },
      },
      {
        kind: "task",
        task: {
          id: uid("t"),
          title: `Review draft purchase order — ${needsReorder.length} products at or below reorder point`,
          assignee: state.settings.staff[0]?.name ?? "Owner",
          due: "Today",
          priority: "high",
          auto: true,
        },
      },
      {
        kind: "activity",
        item: { id: uid("act"), icon: "automation", text: `Draft purchase order generated for ${needsReorder.length} products (grouped by supplier). Simulated.`, time: "Just now" },
      },
      {
        kind: "notify",
        notification: { id: uid("n"), title: "Purchase order drafted", body: `${needsReorder.length} products grouped by supplier and ready for review. Simulated.`, tone: "success" },
      },
    ]);
    track("generated a purchase order");
  };

  const markdownCampaign = () => {
    if (slowMovers.length === 0) return;
    applyNow(dispatch, [
      {
        kind: "workflowRun",
        run: {
          id: uid("run"),
          automationId: "inventory-markdown",
          name: "Slow-mover markdown campaign",
          detail: `Simulated markdown campaign drafted for ${slowMovers.length} slow/overstocked products, targeted to customers who bought the category before.`,
          time: "Just now",
          simulated: true,
        },
      },
      {
        kind: "activity",
        item: { id: uid("act"), icon: "campaign", text: `Markdown campaign drafted for ${slowMovers.length} slow movers — segmented to past category buyers. Simulated.`, time: "Just now" },
      },
      {
        kind: "notify",
        notification: { id: uid("n"), title: "Markdown campaign drafted", body: "Review copy and discount depth in Campaigns before it ever sends. Simulated.", tone: "success" },
      },
    ]);
    track("created a markdown campaign for slow movers");
  };

  const previewAlert = () => {
    const item = needsReorder[0] ?? state.products[0];
    applyNow(dispatch, [
      {
        kind: "notify",
        notification: {
          id: uid("n"),
          title: `Low-stock alert: ${item.name}`,
          body: `${item.stock} left (reorder point ${item.reorderPoint}) · selling ~${item.velocity}/week · supplier ${item.supplier}.`,
          tone: "alert",
        },
      },
    ]);
    track("previewed a low-stock alert");
  };

  return (
    <div className="space-y-4">
      {/* Summary + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/40">
          {needsReorder.length} at or below reorder point · {slowMovers.length} slow or overstocked ·{" "}
          {state.products.length} SKUs tracked
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SmallButton onClick={previewAlert}>
            <Bell size={10} aria-hidden /> Preview low-stock alert
          </SmallButton>
          <SmallButton onClick={markdownCampaign} disabled={slowMovers.length === 0}>
            <Tag size={10} aria-hidden /> Markdown slow movers
          </SmallButton>
          <SmallButton tone="primary" onClick={purchaseOrder} disabled={needsReorder.length === 0}>
            <ClipboardList size={10} aria-hidden /> Generate purchase order
          </SmallButton>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
        <PanelHeading title={inv.title} right={<SampleDataTag className="hidden lg:inline-flex" />} />
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              track("searched inventory");
            }}
            placeholder="Search products, SKUs, suppliers…"
            aria-label="Search inventory"
            className="min-w-[11rem] flex-1 rounded border border-white/10 bg-base-900 px-3 py-1.5 text-xs text-white/80 placeholder:text-white/25 focus:border-crimson/60 focus:outline-none focus:ring-1 focus:ring-crimson/40"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="rounded border border-white/10 bg-base-900 px-2 py-1.5 text-[0.68rem] text-white/70 focus:border-crimson/60 focus:outline-none focus:ring-1 focus:ring-crimson/40"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
            className="rounded border border-white/10 bg-base-900 px-2 py-1.5 text-[0.68rem] text-white/70 focus:border-crimson/60 focus:outline-none focus:ring-1 focus:ring-crimson/40"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_META).map(([id, m]) => (
              <option key={id} value={id}>{m.label}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState text="No products match — adjust the search or filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  {["Product", "SKU", "Category", "Price", "Stock", "Reorder at", "Velocity", "Status", "Supplier"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-white/35">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filtered.map((p) => {
                  const meta = STATUS_META[p.status];
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <ProductSwatch name={p.name} />
                          <span className="text-xs font-medium text-white/85">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[0.66rem] text-white/40">{p.sku}</td>
                      <td className="px-4 py-2.5 text-xs text-white/55">{p.category}</td>
                      <td className="px-4 py-2.5 text-xs tabular-nums text-white/70">${p.price.toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <SmallButton onClick={() => adjustStock(p, -1)} disabled={p.stock === 0} ariaLabel={`Remove one ${p.name} from stock`}>
                            <Minus size={10} aria-hidden />
                          </SmallButton>
                          <span className="w-8 text-center text-xs tabular-nums text-white/80">{p.stock}</span>
                          <SmallButton onClick={() => adjustStock(p, 1)} ariaLabel={`Add one ${p.name} to stock`}>
                            <Plus size={10} aria-hidden />
                          </SmallButton>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs tabular-nums text-white/45">{p.reorderPoint}</td>
                      <td className="px-4 py-2.5 text-xs tabular-nums text-white/45">{p.velocity}/wk</td>
                      <td className="px-4 py-2.5"><StatusPill tone={meta.tone}>{meta.label}</StatusPill></td>
                      <td className="px-4 py-2.5 text-xs text-white/45">
                        {p.supplier}
                        <span className="block text-[0.6rem] text-white/25">Last reorder {p.lastReorder}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-crimson/20 bg-crimson/[0.05] px-4 py-3">
        <p className="text-xs text-white/65">{inv.description}</p>
        <button
          type="button"
          onClick={() => openRequest({ feature: "Inventory & owner dashboard", source: "inventory_view" })}
          className="inline-flex shrink-0 items-center gap-1.5 text-[0.68rem] font-medium text-crimson-light transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
        >
          Get this visibility for my business
          <ArrowRight size={11} aria-hidden />
        </button>
      </div>
    </div>
  );
}
