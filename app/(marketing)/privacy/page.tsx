import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Privacy Policy | Redmont Strategies Group",
  description:
    "How Redmont Strategies Group collects, uses, and protects the information you share with us.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | Redmont Strategies Group",
    description:
      "How Redmont Strategies Group collects, uses, and protects the information you share with us.",
    url: "/privacy",
    images: ["/og.png"],
  },
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <section className="container-px py-12 sm:py-24">
        <div className="max-w-2xl">
          <p className="label">Legal</p>
          <h1 className="display mt-6 text-3xl sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 font-mono text-[0.72rem] sm:text-[0.62rem] uppercase tracking-label text-white/35">
            Last updated: July 2026
          </p>

          <div className="mt-8 sm:mt-12 space-y-10 text-sm leading-relaxed text-white/55">
            <div>
              <h2 className="text-base font-medium text-white">
                Information we collect
              </h2>
              <p className="mt-3">
                When you contact Redmont Strategies Group, we collect the
                information you provide: your name, business name, website,
                email address, phone number, industry, and any details you share
                about your business. If you join our email list, we collect the
                email address you submit. If you are a client, we also maintain
                the account information needed to operate your client portal.
              </p>
            </div>
            <div>
              <h2 className="text-base font-medium text-white">Cookies</h2>
              <p className="mt-3">
                This site uses a small number of first-party cookies. Essential
                cookies keep the client portal working (session cookies) and
                remember your cookie preference. If you accept cookies, we also
                set an anonymous visitor identifier that helps us understand
                how the site is used and improve it. We do not use third-party
                advertising cookies, and you can decline non-essential cookies
                in the banner without affecting the site.
              </p>
            </div>
            <div>
              <h2 className="text-base font-medium text-white">
                Marketing emails
              </h2>
              <p className="mt-3">
                If you subscribe to our email list, we send occasional emails
                about business systems, operations, and AI implementation.
                Every email includes an unsubscribe link, and you can ask to be
                removed at any time. We never sell or share the list.
              </p>
            </div>
            <div>
              <h2 className="text-base font-medium text-white">
                How we use it
              </h2>
              <p className="mt-3">
                We use your information to respond to inquiries, prepare for
                strategy calls, deliver consulting and implementation services,
                and operate the client portal. We do not sell your information,
                and we do not share it with third parties except where required
                to deliver services you have requested or where required by law.
              </p>
            </div>
            <div>
              <h2 className="text-base font-medium text-white">
                Data retention and security
              </h2>
              <p className="mt-3">
                We keep contact submissions and client records only as long as
                needed for the purposes above. Client portal credentials are
                stored using industry-standard password hashing, and portal
                sessions use signed, httpOnly cookies.
              </p>
            </div>
            <div>
              <h2 className="text-base font-medium text-white">
                Your choices
              </h2>
              <p className="mt-3">
                You can request a copy of the information we hold about you, ask
                us to correct it, or ask us to delete it by contacting us at
                contact@redmontstrategiesgroup.com. We process data-subject
                requests for lead records through our admin DSAR tools and
                retain spam/archived leads for up to 24 months unless a shorter
                period is required.
              </p>
            </div>
            <div>
              <h2 className="text-base font-medium text-white">
                Subprocessors
              </h2>
              <p className="mt-3">
                We use a small set of infrastructure providers to operate the
                site: Vercel (hosting), Supabase (database), Resend (transactional
                email), Anthropic (optional site chat), Cloudflare Turnstile
                (optional bot protection), Upstash (optional rate limiting), and
                Sentry (optional error monitoring). We do not sell personal
                information.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
