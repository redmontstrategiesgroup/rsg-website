import test from "node:test";
import assert from "node:assert/strict";
import {
  canStartProcessing,
  cleanStringList,
  formatDuration,
  MAX_AUDIO_BYTES,
  PROCESSING_STALE_MS,
  validateAudioUpload,
} from "../lib/pocket/rules.ts";

test("validateAudioUpload accepts recorder exports", () => {
  for (const [name, mimeType] of [
    ["call.mp3", "audio/mpeg"],
    ["memo.m4a", "audio/x-m4a"],
    ["visit.WAV", "audio/wav"],
    ["export.m4a", ""],
    ["export.mp3", "application/octet-stream"],
    ["clip.mp4", "video/mp4"],
  ]) {
    assert.deepEqual(validateAudioUpload({ name, sizeBytes: 1000, mimeType }), { ok: true }, name);
  }
});

test("validateAudioUpload rejects non-audio, empty and oversized files", () => {
  assert.equal(validateAudioUpload({ name: "notes.pdf", sizeBytes: 10, mimeType: "application/pdf" }).ok, false);
  assert.equal(validateAudioUpload({ name: "noext", sizeBytes: 10, mimeType: "audio/mpeg" }).ok, false);
  assert.equal(validateAudioUpload({ name: "a.mp3", sizeBytes: 0, mimeType: "audio/mpeg" }).ok, false);
  assert.equal(
    validateAudioUpload({ name: "a.mp3", sizeBytes: MAX_AUDIO_BYTES + 1, mimeType: "audio/mpeg" }).ok,
    false,
  );
  // Renamed file whose reported type gives it away.
  assert.equal(validateAudioUpload({ name: "a.mp3", sizeBytes: 10, mimeType: "text/html" }).ok, false);
});

test("canStartProcessing blocks a live run but allows a stale one or a retry", () => {
  const now = Date.parse("2026-09-29T12:00:00Z");
  const recent = new Date(now - 30_000).toISOString();
  const stale = new Date(now - PROCESSING_STALE_MS - 1).toISOString();
  assert.equal(canStartProcessing({ status: "processing", updatedAt: recent }, now), false);
  assert.equal(canStartProcessing({ status: "processing", updatedAt: stale }, now), true);
  assert.equal(canStartProcessing({ status: "failed", updatedAt: recent }, now), true);
  assert.equal(canStartProcessing({ status: "awaiting_upload", updatedAt: recent }, now), true);
});

test("formatDuration", () => {
  assert.equal(formatDuration(null), "");
  assert.equal(formatDuration(9), "0:09");
  assert.equal(formatDuration(249.4), "4:09");
  assert.equal(formatDuration(3725), "1:02:05");
});

test("cleanStringList keeps only trimmed non-empty strings", () => {
  assert.deepEqual(cleanStringList([" a ", "", 3, null, "b"]), ["a", "b"]);
  assert.deepEqual(cleanStringList("nope"), []);
  assert.equal(cleanStringList(Array(50).fill("x")).length, 20);
});
