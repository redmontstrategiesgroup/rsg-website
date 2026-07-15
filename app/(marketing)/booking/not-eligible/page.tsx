import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Thank You | Redmont Strategies Group",
};

export default function BookingNotEligiblePage() {
  return (
    <main className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
      <div className="container-px relative max-w-2xl">
        <p className="label mb-4">Next steps</p>
        <h1 className="display text-4xl sm:text-5xl">
          Thank you for your interest
        </h1>
        <p className="mt-6 text-lg text-white/60">
          Based on the information provided, a direct strategy consultation may
          not be the best next step at this time. We have saved your information
          and may contact you with a more appropriate resource or service.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/services" className="btn-primary">
            Explore services
          </Link>
          <Link href="/connect" className="btn-ghost">
            General inquiry
          </Link>
        </div>
      </div>
    </main>
  );
}
