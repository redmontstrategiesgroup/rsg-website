import type { Metadata } from "next";
import { BookingFunnel } from "@/components/booking/BookingFunnel";

export const metadata: Metadata = {
  title: "Book a Consultation | Redmont Strategies Group",
};

export default function BookConsultationPage() {
  return (
    <main className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
      <div className="container-px relative">
        <div className="mx-auto max-w-2xl">
          <p className="label mb-4">Free consultation</p>
          <h1 className="display text-3xl sm:text-5xl">Book a consultation</h1>
          <p className="mt-4 text-base leading-relaxed text-white/55">
            Tell us what you’re trying to improve, choose a convenient time, and
            we’ll help determine the best next step. Free, no obligation.
          </p>
          <div className="mt-12">
            <BookingFunnel presetAppointmentSlug="strategy" />
          </div>
        </div>
      </div>
    </main>
  );
}
