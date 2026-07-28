import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getAssessmentAnswers,
  getAssessmentByToken,
} from "@/lib/lifecycle/assessments";
import { ASSESSMENT_SECTIONS } from "@/lib/lifecycle/assessment-content";
import { TokenFlow } from "@/components/lifecycle/TokenFlow";
import type { AssessmentSummary } from "@/lib/lifecycle/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Business Systems Assessment | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let content: React.ReactNode;
  if (!isSupabaseConfigured()) {
    content = (
      <p className="text-sm text-white/55">
        The assessment isn&rsquo;t available right now. Please try again
        shortly, or <Link href="/book" className="link-underline text-white/80">book a consultation</Link> directly.
      </p>
    );
  } else {
    const assessment = await getAssessmentByToken(token);
    if (!assessment) {
      content = (
        <p className="text-sm text-white/55">
          We couldn&rsquo;t find that assessment link. If it was emailed to
          you, make sure the full link was copied — or{" "}
          <a href="/start" className="link-underline text-white/80">start fresh here</a>.
        </p>
      );
    } else {
      const answers =
        assessment.status === "draft" || assessment.status === "in_progress"
          ? await getAssessmentAnswers(assessment.id)
          : {};
      const summary =
        assessment.status === "submitted" || assessment.status === "reviewed"
          ? (assessment.summary as AssessmentSummary)
          : null;
      content = (
        <TokenFlow
          kind="assessment"
          token={token}
          sections={ASSESSMENT_SECTIONS}
          initialAnswers={answers}
          initialStatus={assessment.status}
          initialSummary={summary && Object.keys(summary).length > 0 ? summary : null}
        />
      );
    }
  }

  return (
    <main className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
      <div className="container-px relative">
        <div className="mx-auto max-w-2xl">
          <p className="label mb-4">Business Systems Assessment</p>
          <h1 className="display text-3xl sm:text-4xl">
            A clear picture of how your business runs.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55">
            10–15 minutes, in plain English. Your progress saves as you go, and
            you&rsquo;ll get a preliminary summary the moment you finish.
          </p>
          <div className="mt-12">{content}</div>
        </div>
      </div>
    </main>
  );
}
