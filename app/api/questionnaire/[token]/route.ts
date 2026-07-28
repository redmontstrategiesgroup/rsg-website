import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import {
  addInvitedEmail,
  getQuestionnaireAnswers,
  getQuestionnaireByToken,
  saveQuestionnaireAnswers,
  submitQuestionnaire,
} from "@/lib/lifecycle/questionnaires";
import { onQuestionnaireSubmitted } from "@/lib/lifecycle/orchestrate";
import { fireAutomation } from "@/lib/lifecycle/automations";
import { links } from "@/lib/lifecycle/core";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

function unavailable() {
  return NextResponse.json({ error: "Not available right now." }, { status: 503 });
}

export async function GET(request: Request, { params }: Params) {
  if (!isSupabaseConfigured()) return unavailable();
  if (!(await rateLimit(`questionnaire-get:${clientIp(request)}`, 60, 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const questionnaire = await getQuestionnaireByToken(token);
  if (!questionnaire) {
    return NextResponse.json({ error: "Questionnaire not found." }, { status: 404 });
  }
  const answers =
    questionnaire.status === "pending" || questionnaire.status === "in_progress"
      ? await getQuestionnaireAnswers(questionnaire.id)
      : {};
  return NextResponse.json({
    questionnaire: {
      status: questionnaire.status,
      templateKey: questionnaire.template_key,
      dueAt: questionnaire.due_at,
    },
    answers,
  });
}

const patchSchema = z.object({
  entries: z
    .array(z.object({ questionKey: z.string().max(100), answer: z.unknown() }))
    .max(100),
});

export async function PATCH(request: Request, { params }: Params) {
  if (!isSupabaseConfigured()) return unavailable();
  if (!(await rateLimit(`questionnaire-save:${clientIp(request)}`, 60, 10 * 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const questionnaire = await getQuestionnaireByToken(token);
  if (!questionnaire) {
    return NextResponse.json({ error: "Questionnaire not found." }, { status: 404 });
  }
  if (questionnaire.status !== "pending" && questionnaire.status !== "in_progress") {
    return NextResponse.json(
      { error: "This questionnaire has already been submitted." },
      { status: 409 },
    );
  }
  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  await saveQuestionnaireAnswers(
    questionnaire.id,
    body.entries.map((e) => ({ questionKey: e.questionKey, answer: e.answer })),
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
  if (!(await rateLimit(`questionnaire-post:${clientIp(request)}`, 10, 10 * 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const questionnaire = await getQuestionnaireByToken(token);
  if (!questionnaire) {
    return NextResponse.json({ error: "Questionnaire not found." }, { status: 404 });
  }

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const editable =
    questionnaire.status === "pending" || questionnaire.status === "in_progress";

  if (body.action === "invite") {
    if (!editable) {
      return NextResponse.json({ error: "Already submitted." }, { status: 409 });
    }
    try {
      await addInvitedEmail(questionnaire.id, body.email);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to invite." },
        { status: 400 },
      );
    }
    await fireAutomation({
      key: "questionnaire_invite",
      dedupeKey: `questionnaire_invite:${questionnaire.id}:${body.email.toLowerCase()}`,
      entityType: "questionnaire",
      entityId: questionnaire.id,
      email: {
        to: body.email,
        vars: {
          first_name: "there",
          appointment_time_local: "the upcoming consultation",
          questionnaire_url: links.questionnaire(questionnaire.token),
        },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "upload") {
    if (!editable) {
      return NextResponse.json({ error: "Already submitted." }, { status: 409 });
    }
    try {
      const { createFileRecord } = await import("@/lib/lifecycle/files");
      const result = await createFileRecord({
        questionnaireId: questionnaire.id,
        clientId: questionnaire.client_id,
        uploadedByType: "prospect",
        uploadedByName: "Questionnaire respondent",
        name: body.name,
        category: "document",
        sizeBytes: body.sizeBytes,
        mimeType: body.mimeType,
      });
      return NextResponse.json({ ok: true, uploadUrl: result.uploadUrl });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Upload rejected." },
        { status: 400 },
      );
    }
  }

  // submit
  if (!editable) {
    return NextResponse.json({ ok: true });
  }
  const submitted = await submitQuestionnaire(questionnaire.id);

  try {
    let contact: { name?: string; businessName?: string } = {};
    if (submitted.lead_id) {
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb
          .from("leads")
          .select("name, business_name")
          .eq("id", submitted.lead_id)
          .maybeSingle();
        contact = {
          name: (data?.name as string) ?? undefined,
          businessName: (data?.business_name as string) ?? undefined,
        };
      }
    }
    await onQuestionnaireSubmitted(submitted, contact);
  } catch (error) {
    console.error("[questionnaire] orchestration failed", error);
  }
  return NextResponse.json({ ok: true });
}
