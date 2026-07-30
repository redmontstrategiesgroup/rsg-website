import type { Metadata } from "next";
import { BookingFunnel } from "@/components/booking/BookingFunnel";

export const metadata: Metadata = {
  title: "Book a Free Consultation | Redmont Strategies Group",
  description:
    "Book a free business growth and automation consultation. Tell us what you're trying to improve, choose a convenient time, and we'll help determine the best next step.",
};

const REASSURANCES = [
  "Free initial consultation",
  "No technical knowledge required",
  "No obligation",
  "Personalized recommendations",
];

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; service?: string; type?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="relative overflow-hidden pb-16 pt-24 sm:pb-24 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -left-32 top-20 hidden h-72 w-72 rounded-full bg-crimson/10 blur-3xl sm:block" />
      <div className="container-px relative">
        <div className="mx-auto max-w-2xl">
          <p className="label mb-4">Free consultation</p>
          <h1 className="display text-3xl sm:text-5xl">
            Let’s find the right growth opportunity for your business
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/55">
            You don’t need to know exactly what service you need. Tell us what
            you’re trying to improve, choose a convenient time, and we’ll help
            determine the best next step.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {REASSURANCES.map((r) => (
              <li key={r} className="flex items-center gap-2 text-sm text-white/60">
                <span className="h-1 w-1 shrink-0 bg-crimson" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
          <div className="mt-8 sm:mt-12">
            <BookingFunnel
              presetServiceSlug={params.service}
              presetAppointmentSlug={params.type}
              initialSessionToken={params.session}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
