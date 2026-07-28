/**
 * Client Lifecycle Platform — secure files.
 *
 * Metadata rows in `files` / `file_versions`; binary content in the private
 * Supabase Storage bucket (FILES_BUCKET). Content is only ever reachable
 * through short-lived signed URLs — the bucket is never public.
 *
 * Server-only. Tables owned here: files, file_versions.
 */

import { randomUUID } from "node:crypto";
import { FILES_BUCKET, nowIso, requireSupabase } from "@/lib/lifecycle/core";
import type { FileCategory, FileVersion, StoredFile } from "@/lib/lifecycle/types";

// ---------------------------------------------------------------------------
// Upload rules
// ---------------------------------------------------------------------------

/** Common docs, images, media, design sources, and archives. */
export const ALLOWED_EXTENSIONS: string[] = [
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "md",
  "png", "jpg", "jpeg", "gif", "webp", "svg",
  "mp4", "mov", "mp3", "wav",
  "zip", "fig", "psd", "ai",
];

/** Executables and scripts are always rejected, even if renamed later. */
export const BLOCKED_EXTENSIONS: string[] = [
  "exe", "bat", "cmd", "sh", "ps1", "js", "msi", "dmg", "app", "com", "scr",
  "vbs", "jar",
];

export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_SET = new Set(ALLOWED_EXTENSIONS);
const BLOCKED_SET = new Set(BLOCKED_EXTENSIONS);
const DOWNLOAD_URL_TTL_SECONDS = 600;
const DEFAULT_LIST_LIMIT = 100;

/** Expected MIME types for extensions where browsers report reliably. */
const MIME_BY_EXTENSION: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  svg: ["image/svg+xml"],
  mp4: ["video/mp4"],
  mov: ["video/quicktime"],
  mp3: ["audio/mpeg", "audio/mp3"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

/** Drop ASCII control characters (0x00–0x1f, 0x7f) without regex escapes. */
function stripControlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code === 127) continue;
    out += ch;
  }
  return out;
}

/**
 * Strip directory components, control characters, traversal sequences, and
 * storage-hostile characters from a user-supplied file name.
 */
export function sanitizeFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() || "";
  const cleaned = stripControlChars(base)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.{2,}/g, ".")
    .replace(/[^A-Za-z0-9._ ()-]/g, "_")
    .replace(/^[. ]+/, "")
    .slice(0, 180);
  return cleaned || "file";
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function validateUpload(input: {
  name: string;
  sizeBytes: number;
  mimeType: string;
}): { ok: true } | { ok: false; reason: string } {
  const safeName = sanitizeFileName(input.name);
  const ext = extensionOf(safeName);

  if (!ext) {
    return { ok: false, reason: "File must have an extension (e.g. .pdf, .png)." };
  }
  if (BLOCKED_SET.has(ext)) {
    return { ok: false, reason: `Files of type .${ext} are not accepted for security reasons.` };
  }
  if (!ALLOWED_SET.has(ext)) {
    return { ok: false, reason: `Files of type .${ext} are not supported.` };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, reason: "File size must be greater than zero." };
  }
  if (input.sizeBytes > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: `File exceeds the ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB limit.`,
    };
  }

  // Extension/MIME consistency for common types. Browsers sometimes report
  // application/octet-stream for anything unfamiliar, so that is tolerated.
  const reported = input.mimeType.toLowerCase().split(";")[0].trim();
  const expected = MIME_BY_EXTENSION[ext];
  if (reported && reported !== "application/octet-stream" && expected && !expected.includes(reported)) {
    return {
      ok: false,
      reason: `File content type "${reported}" does not match the .${ext} extension.`,
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// File records + signed upload URLs
// ---------------------------------------------------------------------------

/**
 * SECURITY: this module must never accept, store, or log credentials —
 * no passwords, API keys, tokens, or card data, whether as dedicated fields,
 * in `description`, or inside uploaded documents we generate. If access
 * details ever need to change hands, that happens through a human process
 * outside the file store. Do not add secret-bearing fields here.
 */
export async function createFileRecord(input: {
  clientId?: string | null;
  projectId?: string | null;
  milestoneId?: string | null;
  requestId?: string | null;
  ticketId?: string | null;
  questionnaireId?: string | null;
  assessmentId?: string | null;
  uploadedByType: StoredFile["uploaded_by_type"];
  uploadedById?: string | null;
  uploadedByName: string;
  name: string;
  description?: string;
  category?: FileCategory;
  sizeBytes: number;
  mimeType: string;
}): Promise<{ file: StoredFile; uploadUrl: string; uploadToken: string }> {
  const sb = requireSupabase();

  const verdict = validateUpload({
    name: input.name,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
  });
  if (!verdict.ok) throw new Error(`createFileRecord: ${verdict.reason}`);

  const fileId = randomUUID();
  const safeName = sanitizeFileName(input.name);
  const storagePath = `${input.clientId || "prospect"}/${fileId}/v1/${safeName}`;

  const { data: signed, error: signError } = await sb.storage
    .from(FILES_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (signError || !signed?.signedUrl || !signed.token) {
    throw new Error(
      `createFileRecord: could not create signed upload URL (${signError?.message || "no data returned"})`,
    );
  }

  const { data, error } = await sb
    .from("files")
    .insert({
      id: fileId,
      client_id: input.clientId ?? null,
      project_id: input.projectId ?? null,
      milestone_id: input.milestoneId ?? null,
      request_id: input.requestId ?? null,
      ticket_id: input.ticketId ?? null,
      questionnaire_id: input.questionnaireId ?? null,
      assessment_id: input.assessmentId ?? null,
      uploaded_by_type: input.uploadedByType,
      uploaded_by_id: input.uploadedById ?? null,
      uploaded_by_name: input.uploadedByName,
      name: safeName,
      description: input.description ?? "",
      category: input.category ?? "document",
      storage_path: storagePath,
      size_bytes: input.sizeBytes,
      mime_type: input.mimeType,
      current_version: 1,
      // "skipped" means the file passed extension/MIME allowlist screening;
      // this is labeled screening, not antivirus scanning.
      scan_status: "skipped",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`createFileRecord: ${error?.message || "insert returned no row"}`);
  }
  return { file: data as StoredFile, uploadUrl: signed.signedUrl, uploadToken: signed.token };
}

export async function addFileVersion(
  fileId: string,
  input: {
    sizeBytes: number;
    mimeType: string;
    uploadedByType: StoredFile["uploaded_by_type"];
    uploadedByName: string;
    note?: string;
  },
): Promise<{ file: StoredFile; uploadUrl: string; uploadToken: string }> {
  const sb = requireSupabase();

  const existing = await getFile(fileId);
  if (!existing) throw new Error("addFileVersion: file not found.");

  const verdict = validateUpload({
    name: existing.name,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
  });
  if (!verdict.ok) throw new Error(`addFileVersion: ${verdict.reason}`);

  // Lazily backfill a version row for the current version (v1 rows are not
  // written at createFileRecord time), so history stays complete.
  const { data: currentRow, error: currentError } = await sb
    .from("file_versions")
    .select("id")
    .eq("file_id", fileId)
    .eq("version", existing.current_version)
    .maybeSingle();
  if (currentError) throw new Error(`addFileVersion: ${currentError.message}`);
  if (!currentRow) {
    const { error: backfillError } = await sb.from("file_versions").insert({
      file_id: fileId,
      version: existing.current_version,
      storage_path: existing.storage_path,
      size_bytes: existing.size_bytes,
      uploaded_by_type: existing.uploaded_by_type,
      uploaded_by_name: existing.uploaded_by_name,
      note: "",
    });
    if (backfillError) throw new Error(`addFileVersion: ${backfillError.message}`);
  }

  const nextVersion = existing.current_version + 1;
  const nextPath = `${existing.client_id || "prospect"}/${fileId}/v${nextVersion}/${sanitizeFileName(existing.name)}`;

  const { data: signed, error: signError } = await sb.storage
    .from(FILES_BUCKET)
    .createSignedUploadUrl(nextPath);
  if (signError || !signed?.signedUrl || !signed.token) {
    throw new Error(
      `addFileVersion: could not create signed upload URL (${signError?.message || "no data returned"})`,
    );
  }

  const { error: versionError } = await sb.from("file_versions").insert({
    file_id: fileId,
    version: nextVersion,
    storage_path: nextPath,
    size_bytes: input.sizeBytes,
    uploaded_by_type: input.uploadedByType,
    uploaded_by_name: input.uploadedByName,
    note: input.note ?? "",
  });
  if (versionError) throw new Error(`addFileVersion: ${versionError.message}`);

  const { data, error } = await sb
    .from("files")
    .update({
      current_version: nextVersion,
      storage_path: nextPath,
      size_bytes: input.sizeBytes,
      mime_type: input.mimeType,
      updated_at: nowIso(),
    })
    .eq("id", fileId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`addFileVersion: ${error?.message || "update returned no row"}`);
  }
  return { file: data as StoredFile, uploadUrl: signed.signedUrl, uploadToken: signed.token };
}

// ---------------------------------------------------------------------------
// Reads + signed downloads
// ---------------------------------------------------------------------------

export async function getFile(id: string): Promise<StoredFile | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("files")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getFile: ${error.message}`);
  return (data as StoredFile) || null;
}

export async function getDownloadUrl(
  fileId: string,
  opts: { versionId?: string } = {},
): Promise<{ url: string; name: string; sizeBytes: number }> {
  const sb = requireSupabase();
  const file = await getFile(fileId);
  if (!file) throw new Error("getDownloadUrl: file not found.");

  let path = file.storage_path;
  let sizeBytes = file.size_bytes;
  if (opts.versionId) {
    const { data, error } = await sb
      .from("file_versions")
      .select("*")
      .eq("id", opts.versionId)
      .eq("file_id", fileId)
      .maybeSingle();
    if (error) throw new Error(`getDownloadUrl: ${error.message}`);
    if (!data) throw new Error("getDownloadUrl: version not found for this file.");
    const version = data as FileVersion;
    path = version.storage_path;
    sizeBytes = version.size_bytes;
  }

  const { data: signed, error: signError } = await sb.storage
    .from(FILES_BUCKET)
    .createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS);
  if (signError || !signed?.signedUrl) {
    throw new Error(
      `getDownloadUrl: could not create signed URL (${signError?.message || "no data returned"})`,
    );
  }
  return { url: signed.signedUrl, name: file.name, sizeBytes };
}

export type FileScope =
  | { clientId: string }
  | { projectId: string }
  | { requestId: string }
  | { ticketId: string }
  | { questionnaireId: string }
  | { assessmentId: string };

export async function listFilesFor(
  scope: FileScope,
  opts: { limit?: number } = {},
): Promise<StoredFile[]> {
  const sb = requireSupabase();
  let query = sb.from("files").select("*");
  if ("clientId" in scope) query = query.eq("client_id", scope.clientId);
  else if ("projectId" in scope) query = query.eq("project_id", scope.projectId);
  else if ("requestId" in scope) query = query.eq("request_id", scope.requestId);
  else if ("ticketId" in scope) query = query.eq("ticket_id", scope.ticketId);
  else if ("questionnaireId" in scope) query = query.eq("questionnaire_id", scope.questionnaireId);
  else query = query.eq("assessment_id", scope.assessmentId);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? DEFAULT_LIST_LIMIT);
  if (error) throw new Error(`listFilesFor: ${error.message}`);
  return (data || []) as StoredFile[];
}

export async function listVersions(fileId: string): Promise<FileVersion[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("file_versions")
    .select("*")
    .eq("file_id", fileId)
    .order("version", { ascending: false });
  if (error) throw new Error(`listVersions: ${error.message}`);
  return (data || []) as FileVersion[];
}

// ---------------------------------------------------------------------------
// Deletion (storage objects first, then the metadata row)
// ---------------------------------------------------------------------------

export async function deleteFile(id: string): Promise<void> {
  const sb = requireSupabase();
  const file = await getFile(id);
  if (!file) throw new Error("deleteFile: file not found.");

  const versions = await listVersions(id);
  const paths = new Set<string>(versions.map((v) => v.storage_path));
  paths.add(file.storage_path);

  const { error: removeError } = await sb.storage
    .from(FILES_BUCKET)
    .remove([...paths]);
  if (removeError) {
    throw new Error(`deleteFile: could not remove storage objects (${removeError.message})`);
  }

  // file_versions rows cascade with the files row.
  const { error } = await sb.from("files").delete().eq("id", id);
  if (error) throw new Error(`deleteFile: ${error.message}`);
}
