import type { Metadata } from "next";
import { BookingManageClient } from "@/components/booking/BookingManageClient";

export const metadata: Metadata = {
  title: "Manage Appointment | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

export default async function BookingManagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="relative overflow-hidden pb-16 pt-24 sm:pb-24 sm:pt-32">
      <div className="container-px relative max-w-2xl">
        <p className="label mb-4">Manage appointment</p>
        <h1 className="display text-4xl sm:text-5xl">Your consultation</h1>
        <div className="mt-10">
          <BookingManageClient token={token} />
        </div>
      </div>
    </main>
  );
}
