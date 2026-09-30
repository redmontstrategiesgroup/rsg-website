import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import {
  createRecording,
  deleteRecording,
  listRecordings,
  PocketInputError,
  updateRecording,
} from "@/lib/pocket/recordings";
import { pocketConfigured } from "@/lib/pocket/client";

export const runtime = "nodejs";

/** Pocket: recordings from the clip-on recorder (admin only). */

export async function GET() {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  try {
    return NextResponse.json({
      recordings: await listRecordings(),
      pocketConfigured: pocketConfigured(),
    });
  } catch (err) {
    console.error("[/api/admin/pocket] list", err);
    return NextResponse.json({ error: "Could not load recordings." }, { status: 500 });
  }
}

const CreateSchema = z.object({
  name: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().max(120),
  title: z.string().max(200).optional(),
  recordedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

/** Step 1 of an upload: create the row and hand back a signed PUT URL. */
export async function POST(request: Request) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }
  try {
    const result = await createRecording({ ...parsed.data, uploadedBy: ctx.admin.email });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof PocketInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[/api/admin/pocket] create", err);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });
  }
}

const PatchSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(200).optional(),
  notes: z.string().max(8000).optional(),
  leadId: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: Request) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid patch." }, { status: 400 });
  }
  const { id, ...patch } = parsed.data;
  try {
    const recording = await updateRecording(id, patch);
    if (!recording) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ recording });
  } catch (err) {
    console.error("[/api/admin/pocket] patch", err);
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  try {
    const removed = await deleteRecording(id);
    if (!removed) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/admin/pocket] delete", err);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
