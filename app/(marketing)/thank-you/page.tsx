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

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL;

export default function ThankYouPage() {
  return (
    <PageShell>
      <TrackPageEvent event="thank_you_page_view" />
      <section className="container-px flex min-h-[70vh] items-center py-28 sm:py-36">
        <div className="max-w-2xl">
          <div className="h-px w-12 bg-crimson-light/80" />
          <h1 className="display mt-9 text-[2.3rem] leading-[1.04] sm:text-[3.2rem]">
            Your request was received.
          </h1>
          <p className="mt-8 max-w-lg text-[1.05rem] leading-relaxed text-white/55">
            Redmont Strategies Group will review your business details and the
            systems you want to improve.
          </p>
          {!BOOKING_URL && (
            <p className="mt-5 max-w-lg text-[0.95rem] leading-relaxed text-white/45">
              A confirmation is on its way to your inbox, and we&rsquo;ll reach
              out shortly to schedule your strategy call.
            </p>
          )}

          <div className="mt-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-9">
            {BOOKING_URL && (
              <TrackedLink
                href={BOOKING_URL}
                event="book_strategy_call_click"
                eventProps={{ location: "thank_you" }}
                className="btn-primary"
              >
                Book a Strategy Call
              </TrackedLink>
            )}
            <Link href="/" className="link-underline">
              Return to Homepage
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
