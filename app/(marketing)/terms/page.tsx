import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Terms of Service | Redmont Strategies Group",
  description:
    "The terms that govern use of the Redmont Strategies Group website and client portal.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | Redmont Strategies Group",
    description:
      "The terms that govern use of the Redmont Strategies Group website and client portal.",
    url: "/terms",
    images: ["/og.png"],
  },
};

export default function TermsPage() {
  return (
    <PageShell>
      <section className="container-px py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="label">Legal</p>
          <h1 className="display mt-6 text-3xl sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-label text-white/35">
            Last updated: July 2026
          </p>

          <div className="mt-12 space-y-10 text-sm leading-relaxed text-white/55">
            <div>
              <h2 className="text-base font-medium text-white">
                Use of this site
              </h2>
              <p className="mt-3">
                This website is provided by Redmont Strategies Group
                (&ldquo;RSG&rdquo;) for informational purposes and to allow
                prospective and current clients to contact us and access the
                client portal. By using the site you agree to these terms.
              </p>
            </div>
            <div>
              <h2 className="text-base font-medium text-white">
                Consulting engagements
              </h2>
              <p className="mt-3">
                Content on this site describes services generally and is not a
                proposal, quote, or guarantee of results. Every consulting or
                implementation engagement is governed by its own written
                agreement, which controls scope, deliverables, fees, and
                timelines. Business outcomes depend on many factors outside any
                consultant&rsquo;s control, and results vary by business.
              </p>
            </div>
            <div>
              <h2 className="text-base font-medium text-white">
                Client portal
              </h2>
              <p className="mt-3">
                Portal access is provided to active clients. You are responsible
                for keeping your login credentials confidential and for
                activity under your account. We may suspend access to protect
                the integrity of the platform.
              </p>
            </div>
            <div>
              <h2 className="text-base font-medium text-white">
                Intellectual property
              </h2>
              <p className="mt-3">
                The content, design, and branding on this site belong to RSG and
                may not be reproduced without permission. Deliverables created
                for clients are governed by the applicable engagement agreement.
              </p>
            </div>
            <div>
              <h2 className="text-base font-medium text-white">
                Limitation of liability
              </h2>
              <p className="mt-3">
                The site is provided as-is. To the fullest extent permitted by
                law, RSG is not liable for indirect or consequential damages
                arising from use of the site. Questions about these terms can be
                sent through the contact form.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
