// ============================================================================
// THE FORGE // db.js — Supabase-backed specs, revisions and exports.
//
// An ES module, matching the rest of THE FORGE's js/. It reads the shared
// client off `window` because rsg-supabase.js is a classic script (house
// pattern, same as claude-bridge.js):
//
//   <script src="../shared/rsg-supabase.js"></script>
//   <script type="module" src="js/main.js"></script>
//
// Replaces the localStorage half of claude.js's getSettings()/saveSettings().
// The API KEY does not come with it: it moves into Supabase secrets behind the
// `ai` edge function, and there is no api_key column to put it in.
// ============================================================================

const SB = () => window.RSGSupabase;

function client() {
  const sb = SB();
  if (!sb || !sb.configured()) throw new Error("Supabase is not configured");
  return sb;
}

export function available() {
  const sb = SB();
  return !!(sb && sb.configured() && sb.userId());
}

/* ------------------------------------------------------------------ specs */

export function listSpecs() {
  const sb = client();
  // Omits `spec`: the picker needs names and dates, not every design document.
  return sb.from("forge_specs")
    .select("id,name,tagline,mode,rev,mcu,layout_style,updated_at")
    .eq("user_id", sb.userId()).eq("archived", false)
    .order("updated_at", { ascending: false });
}

export function loadSpec(id) {
  const sb = client();
  return sb.from("forge_specs").select("*")
    .eq("id", id).eq("user_id", sb.userId()).single()
    .then((row) => (row ? inflate(row) : null));
}

function inflate(row) {
  return {
    ...(row.spec || {}),
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    mode: row.mode,
    rev: row.rev,
    mcu: row.mcu,
    layoutStyle: row.layout_style,
    printerBedMM: row.printer_bed_mm,
    budgetUSD: row.budget_usd,
  };
}

function deflate(spec, userId) {
  const {
    id, name, tagline, mode, rev, mcu, layoutStyle, printerBedMM, budgetUSD, ...rest
  } = spec;
  return {
    ...(id ? { id } : {}),
    user_id: userId,
    name: name || "Untitled",
    tagline: tagline || "",
    mode: mode || "product",
    rev: rev || 1,
    mcu: mcu ?? null,
    layout_style: layoutStyle || "arc",
    // null, not 0 — "not asked yet" is not "a zero-size bed" (see 0003_forge.sql).
    printer_bed_mm: printerBedMM ?? null,
    budget_usd: budgetUSD ?? null,
    spec: rest,
    updated_at: new Date().toISOString(),
  };
}

export function saveSpec(spec) {
  const sb = client();
  return sb.from("forge_specs")
    .upsert(deflate(spec, sb.userId()), { onConflict: "id" }).single()
    .then((row) => inflate(row));
}

/* -------------------------------------------------------------- revisions */

// Called when a revision is cut. `snapshot` is the whole spec at that rev, so
// a design's history stays reconstructable rather than being a growing array
// nested inside the current document.
export function saveRevision(specId, rev, findings, snapshot) {
  const sb = client();
  return sb.from("forge_revisions").upsert({
    user_id: sb.userId(), spec_id: specId, rev,
    findings: findings || [], snapshot: snapshot || {},
  }, { onConflict: "spec_id,rev" });
}

export function listRevisions(specId) {
  const sb = client();
  return sb.from("forge_revisions").select("id,rev,findings,created_at")
    .eq("spec_id", specId).eq("user_id", sb.userId())
    .order("rev", { ascending: false });
}

/* ---------------------------------------------------------------- exports */

/**
 * Record a generated artefact and the verdict of the geometry checks.
 *
 * `validation` should be the result object from validation.js. Pass `valid`
 * explicitly; leaving it undefined stores NULL, which means UNVALIDATED and
 * must never be rendered as a pass. An export that was never checked and an
 * export that passed are different facts, and a model that renders correctly
 * on screen can still be non-manifold and unmanufacturable.
 */
export function recordExport({ specId, rev, kind, filename, byteSize, checksum, valid, validation }) {
  const sb = client();
  return sb.from("forge_exports").insert({
    user_id: sb.userId(),
    spec_id: specId,
    rev: rev || 1,
    kind,
    filename: filename || "",
    byte_size: byteSize ?? null,
    checksum: checksum ?? null,
    valid: valid === undefined ? null : !!valid,
    validation: validation || {},
  });
}

export function listExports(specId) {
  const sb = client();
  return sb.from("forge_exports").select("*")
    .eq("spec_id", specId).eq("user_id", sb.userId())
    .order("created_at", { ascending: false });
}

/* --------------------------------------------------------------- settings */

export function loadSettings() {
  const sb = client();
  return sb.from("forge_settings").select("*").eq("user_id", sb.userId()).limit(1)
    .then((rows) => {
      const r = (rows || [])[0];
      // No apiKey field — by design. The key lives in Supabase secrets.
      return { model: r?.model || "claude-fable-5", ...(r?.data || {}) };
    });
}

export function saveSettings(s) {
  const sb = client();
  const { model, ...rest } = s || {};
  return sb.from("forge_settings").upsert({
    user_id: sb.userId(),
    model: model || "claude-fable-5",
    data: rest,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
}

/* --------------------------------------------------------------------- AI */

// Replaces the direct api.anthropic.com call in claude.js. Same argument shape;
// the key now stays server-side and the call is metered against the spend cap.
export function callAI({ system, messages, schema, maxTokens = 4096, model }) {
  const sb = client();
  return sb.invoke("ai", {
    model: model || "claude-fable-5",
    system, messages, schema, max_tokens: maxTokens,
  });
}
