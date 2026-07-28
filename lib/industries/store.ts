/**
 * Industry vertical storage (server-only).
 *
 * Authored defaults live in lib/industries/content/*. Admin edits are stored
 * as full-object overrides — Supabase when configured, JSON file fallback in
 * dev (same pattern as lib/connect.ts). Reads always section-merge the
 * override over the authored default so schema additions never leave a page
 * half-empty.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { getSupabase } from "../supabase";
import { DEFAULT_VERTICALS, DEFAULT_SECONDARY_INDUSTRIES } from "./content";
import type {
  IndustryVertical,
  SecondaryIndustry,
  VerticalSlug,
} from "./types";
import { VERTICAL_SLUGS } from "./types";

const DATA_DIR =
  process.env.DATA_DIR ??
  (process.env.NODE_ENV === "production"
    ? path.join(os.tmpdir(), "rsg-data")
    : path.join(process.cwd(), "data"));

const VERTICALS_FILE = path.join(DATA_DIR, "industry-verticals.json");

const SECONDARY_KEY = "additional-industries";

type StoredOverrides = Partial<Record<string, unknown>>;

async function writeJson(file: string, data: unknown): Promise<boolean> {
  if (process.env.NODE_ENV === "production") {
    console.error(
      `[industries] refusing file write in production (${path.basename(file)}). Configure Supabase.`
    );
    return false;
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Override wins per top-level section; the authored default fills anything
 * the override doesn't carry (e.g. sections added after the override was
 * saved). Slug and demoSlug are pinned to the default's vertical identity.
 */
function mergeVertical(
  defaults: IndustryVertical,
  override: Partial<IndustryVertical> | null | undefined
): IndustryVertical {
  if (!override || typeof override !== "object") return defaults;
  const merged = { ...defaults } as Record<string, unknown>;
  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined && value !== null && key in defaults) {
      merged[key] = value;
    }
  }
  merged.slug = defaults.slug;
  return merged as unknown as IndustryVertical;
}

async function readOverridesFromSupabase(): Promise<Map<string, unknown> | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("industry_verticals")
      .select("slug, content");
    if (error) throw error;
    const map = new Map<string, unknown>();
    for (const row of (data ?? []) as { slug: string; content: unknown }[]) {
      map.set(row.slug, row.content);
    }
    return map;
  } catch (err) {
    console.warn("[industries] Supabase read failed — using file/defaults.", err);
    return null;
  }
}

async function readOverrides(): Promise<Map<string, unknown>> {
  const remote = await readOverridesFromSupabase();
  if (remote) return remote;
  const file = await readJson<StoredOverrides>(VERTICALS_FILE, {});
  return new Map(Object.entries(file));
}

export async function getVerticals(): Promise<IndustryVertical[]> {
  const overrides = await readOverrides();
  return VERTICAL_SLUGS.map((slug) =>
    mergeVertical(
      DEFAULT_VERTICALS[slug],
      overrides.get(slug) as Partial<IndustryVertical> | undefined
    )
  );
}

export async function getVertical(slug: VerticalSlug): Promise<IndustryVertical> {
  const overrides = await readOverrides();
  return mergeVertical(
    DEFAULT_VERTICALS[slug],
    overrides.get(slug) as Partial<IndustryVertical> | undefined
  );
}

export async function saveVertical(
  vertical: IndustryVertical,
  updatedBy?: string
): Promise<IndustryVertical> {
  const merged = mergeVertical(DEFAULT_VERTICALS[vertical.slug], vertical);
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from("industry_verticals").upsert({
        slug: merged.slug,
        content: merged,
        status: merged.status,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy ?? null,
      });
      if (error) throw error;
    } catch (err) {
      console.warn("[industries] Supabase write failed.", err);
    }
  }
  const file = await readJson<StoredOverrides>(VERTICALS_FILE, {});
  file[merged.slug] = merged;
  await writeJson(VERTICALS_FILE, file);
  return merged;
}

/** Remove the stored override so the vertical returns to authored defaults. */
export async function resetVertical(slug: VerticalSlug): Promise<IndustryVertical> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from("industry_verticals").delete().eq("slug", slug);
    } catch (err) {
      console.warn("[industries] Supabase reset failed.", err);
    }
  }
  const file = await readJson<StoredOverrides>(VERTICALS_FILE, {});
  delete file[slug];
  await writeJson(VERTICALS_FILE, file);
  return DEFAULT_VERTICALS[slug];
}

export async function getSecondaryIndustries(): Promise<SecondaryIndustry[]> {
  const overrides = await readOverrides();
  const stored = overrides.get(SECONDARY_KEY) as
    | { industries?: SecondaryIndustry[] }
    | undefined;
  const items = stored?.industries;
  if (Array.isArray(items) && items.length > 0) {
    return items.filter((i) => i && typeof i.name === "string" && i.name.trim());
  }
  return DEFAULT_SECONDARY_INDUSTRIES;
}

export async function saveSecondaryIndustries(
  industries: SecondaryIndustry[],
  updatedBy?: string
): Promise<SecondaryIndustry[]> {
  const content = { industries };
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from("industry_verticals").upsert({
        slug: SECONDARY_KEY,
        content,
        status: "published",
        updated_at: new Date().toISOString(),
        updated_by: updatedBy ?? null,
      });
      if (error) throw error;
    } catch (err) {
      console.warn("[industries] Supabase write failed.", err);
    }
  }
  const file = await readJson<StoredOverrides>(VERTICALS_FILE, {});
  file[SECONDARY_KEY] = content;
  await writeJson(VERTICALS_FILE, file);
  return industries;
}
