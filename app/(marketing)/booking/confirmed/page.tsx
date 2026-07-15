import type { Metadata } from "next";
import Link from "next/link";
import { BookingManageClient } from "@/components/booking/BookingManageClient";

export const metadata: Metadata = {
  title: "Appointment Confirmed | Redmont Strategies Group",
};

export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
      <div className="container-px relative max-w-2xl">
        <p className="label mb-4">Confirmed</p>
        <h1 className="display text-4xl sm:text-5xl">You&apos;re on the calendar</h1>
        <p className="mt-4 text-white/55">
          A confirmation email with calendar details is on its way. Use your
          secure link anytime to reschedule or cancel.
        </p>
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
