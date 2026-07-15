import type { Metadata } from "next";
import { BookingFunnel } from "@/components/booking/BookingFunnel";

export const metadata: Metadata = {
  title: "Book a Strategy Consultation | Redmont Strategies Group",
  description:
    "Request a Redmont Strategies Group consultation. Complete a short eligibility review and schedule a strategy call.",
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; service?: string; type?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-crimson/10 blur-3xl" />
      <div className="container-px relative">
        <p className="label mb-4">Consultation intake</p>
        <h1 className="display text-4xl sm:text-5xl">
          Book a strategy consultation
        </h1>
        <p className="mt-4 max-w-2xl text-base text-white/55">
          A structured intake for serious operators. We qualify fit first, then
          offer times that match our availability.
        </p>
        <div className="mt-12">
          <BookingFunnel
            presetServiceSlug={params.service}
            presetAppointmentSlug={params.type}
            initialSessionToken={params.session}
          />
        </div>
      </div>
    </main>
  );
}
