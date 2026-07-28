import type { Metadata } from "next";
import Link from "next/link";
import { BookingManageClient } from "@/components/booking/BookingManageClient";
import { defaultPlanByKey } from "@/lib/managed-services/content";

export const metadata: Metadata = {
  title: "Appointment Confirmed | Redmont Strategies Group",
};

export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; plan?: string }>;
}) {
  const { token, plan } = await searchParams;
  const recommendedPlan = plan ? defaultPlanByKey(plan) : null;
  return (
    <main className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
      <div className="container-px relative max-w-2xl">
        <p className="label mb-4">Confirmed</p>
        <h1 className="display text-3xl sm:text-5xl">
          Your consultation is booked
        </h1>
        <p className="mt-4 leading-relaxed text-white/55">
          We’ll review the information you provided and use the meeting to
          understand your goals, identify the strongest opportunities, and
          recommend practical next steps.
        </p>
        <p className="mt-3 text-sm text-white/45">
          A confirmation email with calendar details is on its way to your inbox.
        </p>
        {recommendedPlan && (
          <p className="mt-6 border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/70">
            Based on your answers, we’ll come prepared to discuss our{" "}
            <span className="text-white">{recommendedPlan.name}</span> management
            plan.
          </p>
        )}
        {token ? (
          <div className="mt-10">
            <BookingManageClient token={token} confirmedView />
          </div>
        ) : (
          <Link href="/book" className="btn-primary mt-10 inline-flex">
            Book another consultation
          </Link>
        )}
      </div>
    </main>
  );
}
