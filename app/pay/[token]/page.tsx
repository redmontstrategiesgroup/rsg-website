import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getInvoiceByToken, stripeEnabled } from "@/lib/lifecycle/billing";
import { PayClient } from "@/components/lifecycle/PayClient";
import { Logo } from "@/components/Logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Secure Payment | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;

  let body: React.ReactNode;
  if (!isSupabaseConfigured()) {
    body = (
      <p className="text-center text-sm text-white/55">
        Payments aren&rsquo;t available right now — please try again shortly.
      </p>
    );
  } else {
    // Tolerate a not-yet-migrated database: a load failure renders the
    // friendly fallback instead of the error boundary.
    const invoice = await getInvoiceByToken(token).catch((error) => {
      console.warn("[pay] invoice load failed", error);
      return null;
    });
    if (!invoice || invoice.status === "draft") {
      body = (
        <p className="text-center text-sm text-white/55">
          We couldn&rsquo;t find that invoice. Check that the full link from
          your email was copied, or reply to the email and we&rsquo;ll resend it.
        </p>
      );
    } else {
      body = (
        <PayClient
          token={token}
          invoice={invoice}
          stripeReady={stripeEnabled()}
          justPaid={paid === "1"}
        />
      );
    }
  }

  return (
    <main className="min-h-screen bg-base pb-24">
      <header className="border-b border-white/10 bg-base/70 backdrop-blur-xl">
        <div className="container-px flex h-16 items-center justify-between">
          <Logo />
          <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
            Secure payment
          </p>
        </div>
      </header>
      <div className="container-px pt-12 sm:pt-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <p className="label justify-center">Redmont Strategies Group</p>
            <h1 className="display mt-3 text-3xl">Complete your payment</h1>
          </div>
          {body}
        </div>
      </div>
    </main>
  );
}
