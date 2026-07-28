import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import {
  addInvitedEmail,
  getAssessmentAnswers,
  getAssessmentByToken,
  saveAssessmentAnswers,
  submitAssessment,
} from "@/lib/lifecycle/assessments";
import { onAssessmentSubmitted } from "@/lib/lifecycle/orchestrate";
import { fireAutomation } from "@/lib/lifecycle/automations";
import { links } from "@/lib/lifecycle/core";

export const runtime = "nodejs";

function unavailable() {
  return NextResponse.json({ error: "Not available right now." }, { status: 503 });
}

type Params = { params: Promise<{ token: string }> };

/** Public shape — never leak point maps, internal notes, or lead ids. */
function publicAssessment(a: NonNullable<Awaited<ReturnType<typeof getAssessmentByToken>>>) {
  return {
    status: a.status,
    currentSection: a.current_section,
    invitedCount: Array.isArray(a.invited_emails) ? a.invited_emails.length : 0,
    submittedAt: a.submitted_at,
    summary: a.status === "submitted" || a.status === "reviewed" ? a.summary : null,
    recommendedCategory:
      a.status === "submitted" || a.status === "reviewed"
        ? a.recommended_service_category
        : null,
  };
}

export async function GET(request: Request, { params }: Params) {
  if (!isSupabaseConfigured()) return unavailable();
  if (!(await rateLimit(`assessment-get:${clientIp(request)}`, 60, 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const assessment = await getAssessmentByToken(token);
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }
  const answers =
    assessment.status === "draft" || assessment.status === "in_progress"
      ? await getAssessmentAnswers(assessment.id)
      : {};
  return NextResponse.json({ assessment: publicAssessment(assessment), answers });
}

const patchSchema = z.object({
  entries: z
    .array(
      z.object({
        sectionKey: z.string().max(100),
        questionKey: z.string().max(100),
        answer: z.unknown(),
      }),
    )
    .max(100),
  currentSection: z.string().max(100).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  if (!isSupabaseConfigured()) return unavailable();
  if (!(await rateLimit(`assessment-save:${clientIp(request)}`, 60, 10 * 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const assessment = await getAssessmentByToken(token);
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }
  if (assessment.status !== "draft" && assessment.status !== "in_progress") {
    return NextResponse.json(
      { error: "This assessment has already been submitted." },
      { status: 409 },
    );
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await saveAssessmentAnswers(
    assessment.id,
    body.entries.map((e) => ({
      sectionKey: e.sectionKey,
      questionKey: e.questionKey,
      answer: e.answer,
    })),
    { currentSection: body.currentSection },
  );
  return NextResponse.json({ ok: true });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("invite"), email: z.string().email().max(320) }),
  z.object({
    action: z.literal("upload"),
    name: z.string().min(1).max(255),
    sizeBytes: z.number().int().positive(),
    mimeType: z.string().max(200),
  }),
]);

export async function POST(request: Request, { params }: Params) {
  if (!isSupabaseConfigured()) return unavailable();
  if (!(await rateLimit(`assessment-post:${clientIp(request)}`, 10, 10 * 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const assessment = await getAssessmentByToken(token);
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.action === "invite") {
    if (assessment.status !== "draft" && assessment.status !== "in_progress") {
      return NextResponse.json(
        { error: "This assessment is already submitted." },
        { status: 409 },
      );
    }
    try {
      await addInvitedEmail(assessment.id, body.email);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to invite." },
        { status: 400 },
      );
    }
    await fireAutomation({
      key: "assessment_invite",
      dedupeKey: `assessment_invite:${assessment.id}:${body.email.toLowerCase()}`,
      entityType: "assessment",
      entityId: assessment.id,
      email: {
        to: body.email,
        vars: {
          first_name: "there",
          business_name: "your team",
          assessment_url: links.assessment(assessment.token),
        },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "upload") {
    if (assessment.status !== "draft" && assessment.status !== "in_progress") {
      return NextResponse.json(
        { error: "This assessment is already submitted." },
        { status: 409 },
      );
    }
    try {
      const { createFileRecord } = await import("@/lib/lifecycle/files");
      const result = await createFileRecord({
        assessmentId: assessment.id,
        uploadedByType: "prospect",
        uploadedByName: assessment.email,
        name: body.name,
        category: "document",
        sizeBytes: body.sizeBytes,
        mimeType: body.mimeType,
      });
      return NextResponse.json({
        ok: true,
        uploadUrl: result.uploadUrl,
        fileName: result.file.name,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Upload rejected." },
        { status: 400 },
      );
    }
  }

  // action === "submit"
  if (assessment.status === "submitted" || assessment.status === "reviewed") {
    return NextResponse.json({
      ok: true,
      assessment: publicAssessment(assessment),
    });
  }
  const submitted = await submitAssessment(assessment.id);

  // Journey advancement + internal notice (best-effort).
  try {
    let lead: { id: string; name: string; businessName: string; email: string } | null =
      null;
    if (submitted.lead_id) {
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb
          .from("leads")
          .select("id, name, business_name, email")
          .eq("id", submitted.lead_id)
          .maybeSingle();
        if (data) {
          lead = {
            id: String(data.id),
            name: String(data.name ?? ""),
            businessName: String(data.business_name ?? ""),
            email: String(data.email ?? ""),
          };
        }
      }
    }
    await onAssessmentSubmitted(submitted, lead);
  } catch (error) {
    console.error("[assessment] orchestration failed", error);
  }

  return NextResponse.json({ ok: true, assessment: publicAssessment(submitted) });
}
