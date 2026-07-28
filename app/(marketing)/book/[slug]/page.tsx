import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getAppointmentTypeBySlug } from "@/lib/scheduling/catalog";
import { BookingFunnel } from "@/components/booking/BookingFunnel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isSupabaseConfigured()) return { title: "Book | Redmont Strategies Group" };
  try {
    const type = await getAppointmentTypeBySlug(slug);
    return {
      title: type
        ? `Book ${type.name} | Redmont Strategies Group`
        : "Book | Redmont Strategies Group",
    };
  } catch {
    return { title: "Book | Redmont Strategies Group" };
  }
}

export default async function BookBySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Reserved paths handled by sibling routes
  if (slug === "consultation" || slug === "strategy") notFound();

  let exists = true;
  if (isSupabaseConfigured()) {
    try {
      const type = await getAppointmentTypeBySlug(slug);
      exists = Boolean(type);
    } catch {
      exists = false;
    }
  }
  if (!exists) notFound();

  return (
    <main className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
      <div className="container-px relative">
        <div className="mx-auto max-w-2xl">
          <p className="label mb-4">Schedule</p>
          <h1 className="display text-3xl sm:text-5xl">Book your consultation</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/55">
            Tell us what you’re trying to improve, choose a convenient time, and
            we’ll help determine the best next step.
          </p>
          <div className="mt-12">
            <BookingFunnel presetAppointmentSlug={slug} />
          </div>
        </div>
      </div>
    </main>
  );
}
