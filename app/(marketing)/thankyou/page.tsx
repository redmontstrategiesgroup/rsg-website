import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { TrackedLink } from "@/components/TrackedLink";
import { TrackPageEvent } from "@/components/TrackPageEvent";

export const metadata: Metadata = {
  title: "Request Received | Redmont Strategies Group",
  description:
    "Your strategy call request has been received. We'll review your business and reach out shortly.",
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <PageShell>
      <TrackPageEvent event="thank_you_page_view" />
      <section className="container-px flex min-h-[70vh] items-center py-16 sm:py-36">
        <div className="max-w-2xl">
          <div className="h-px w-12 bg-crimson-light/80" />
          <h1 className="display mt-9 text-[2.3rem] leading-[1.04] sm:text-[3.2rem]">
            Your request was received.
          </h1>
          <p className="mt-8 max-w-lg text-[1.05rem] leading-relaxed text-white/55">
            Redmont Strategies Group will review your business details and the
            systems you want to improve.
          </p>
          <p className="mt-5 max-w-lg text-[0.95rem] leading-relaxed text-white/45">
            Prefer to lock a time now? Complete our consultation intake and
            book a qualified strategy session.
          </p>

          <div className="mt-10 max-w-lg space-y-4 border-t border-white/10 pt-8">
            <p className="font-mono text-[0.7rem] sm:text-[0.58rem] uppercase tracking-label text-white/40">
              What happens next
            </p>
            <ol className="space-y-3 text-sm leading-relaxed text-white/55">
              <li>
                <span className="text-white/80">1.</span> We review your intake
                details, website, and where follow-up is breaking down.
              </li>
              <li>
                <span className="text-white/80">2.</span> You receive a short
                confirmation email — or book a time below if you prefer to lock
                a slot now.
              </li>
              <li>
                <span className="text-white/80">3.</span> We reply with next
                steps for a focused strategy conversation — no pitch deck, no
                generic audit PDF.
              </li>
            </ol>
          </div>

          <div className="mt-8 sm:mt-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-9">
            <TrackedLink
              href="/book"
              event="book_strategy_call_click"
              eventProps={{ location: "thank_you" }}
              className="btn-primary"
            >
              Book a Strategy Call
            </TrackedLink>
            <Link href="/" className="link-underline">
              Return to Homepage
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
