import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Request Under Review | Redmont Strategies Group",
};

export default function BookingReviewPage() {
  return (
    <main className="relative overflow-hidden pb-16 pt-24 sm:pb-24 sm:pt-32">
      <div className="container-px relative max-w-2xl">
        <p className="label mb-4">Under review</p>
        <h1 className="display text-4xl sm:text-5xl">
          Thank you for submitting your information
        </h1>
        <p className="mt-6 text-lg text-white/60">
          Our team will review your request and contact you regarding the best
          next step. A confirmation has been sent to your email.
        </p>
        <Link href="/" className="btn-ghost mt-10 inline-flex">
          Return home
        </Link>
      </div>
    </main>
  );
}
