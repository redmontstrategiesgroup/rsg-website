import type { Metadata } from "next";
import { BookingFunnel } from "@/components/booking/BookingFunnel";

export const metadata: Metadata = {
  title: "Book a Strategy Call | Redmont Strategies Group",
};

export default function BookStrategyPage() {
  return (
    <main className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
      <div className="container-px relative">
        <p className="label mb-4">Strategy call</p>
        <h1 className="display text-4xl sm:text-5xl">Book a strategy call</h1>
        <div className="mt-12">
          <BookingFunnel
            presetServiceSlug="general-strategy"
            presetAppointmentSlug="strategy"
          />
        </div>
      </div>
    </main>
  );
}
