import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getQuestionnaireAnswers,
  getQuestionnaireByToken,
} from "@/lib/lifecycle/questionnaires";
import { QUESTIONNAIRE_TEMPLATES } from "@/lib/lifecycle/questionnaire-content";
import { TokenFlow } from "@/components/lifecycle/TokenFlow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consultation Preparation | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

export default async function PreparePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let content: React.ReactNode;
  if (!isSupabaseConfigured()) {
    content = (
      <p className="text-sm text-white/55">
        This page isn&rsquo;t available right now — please try again shortly.
        Your consultation is unaffected.
      </p>
    );
  } else {
    const questionnaire = await getQuestionnaireByToken(token);
    if (!questionnaire) {
      content = (
        <p className="text-sm text-white/55">
          We couldn&rsquo;t find that preparation link. Check that the full
          link from your email was copied — or simply bring your questions to
          the consultation; it will be productive either way.
        </p>
      );
    } else {
      const template =
        QUESTIONNAIRE_TEMPLATES[questionnaire.template_key] ??
        QUESTIONNAIRE_TEMPLATES.general;
      const answers =
        questionnaire.status === "pending" || questionnaire.status === "in_progress"
          ? await getQuestionnaireAnswers(questionnaire.id)
          : {};
      content = (
        <TokenFlow
          kind="questionnaire"
          token={token}
          sections={template.sections}
          initialAnswers={answers}
          initialStatus={questionnaire.status}
        />
      );
    }
  }

  return (
    <main className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
      <div className="container-px relative">
        <div className="mx-auto max-w-2xl">
          <p className="label mb-4">Before your consultation</p>
          <h1 className="display text-3xl sm:text-4xl">
            Help us make your call count.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55">
            A few questions so we arrive already understanding your business.
            Skip anything that doesn&rsquo;t apply — your answers save
            automatically, and nothing here is required to keep your
            appointment.
          </p>
          <div className="mt-12">{content}</div>
        </div>
      </div>
    </main>
  );
}
