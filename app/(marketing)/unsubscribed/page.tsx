import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Unsubscribed | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

const COPY = {
  done: {
    title: "You're unsubscribed.",
    body: "That address will not receive marketing email from Redmont Strategies Group again. Transactional messages about work you have booked with us are unaffected.",
  },
  invalid: {
    title: "That link didn't check out.",
    body: "The unsubscribe link was incomplete or altered. Open the most recent email and use the link there, or email us and we will remove the address by hand.",
  },
  error: {
    title: "We couldn't save that just now.",
    body: "Something failed on our side. Try the link again in a minute, or email us and we will remove the address by hand.",
  },
} as const;

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const copy = COPY[state === "invalid" || state === "error" ? state : "done"];
  return (
    <main className="container-px flex min-h-[60dvh] items-center py-20 sm:py-28">
      <div className="max-w-xl">
        <div className="h-px w-12 bg-crimson-light/80" />
        <h1 className="display mt-7 text-[2.1rem] leading-[1.05] sm:text-5xl">{copy.title}</h1>
        <p className="mt-5 text-white/60">{copy.body}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn-ghost">
            Back to the site
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}?subject=Unsubscribe`} className="link-arrow group">
            Email us instead
          </a>
        </div>
      </div>
    </main>
  );
}
