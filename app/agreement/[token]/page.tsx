import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getContractByToken, markContractViewed } from "@/lib/lifecycle/contracts";
import { CONTRACT_TEMPLATES } from "@/lib/lifecycle/contract-templates";
import { AgreementClient } from "@/components/lifecycle/AgreementClient";
import { Logo } from "@/components/Logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agreement | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

export default async function AgreementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let body: React.ReactNode;
  let title = "Your agreement";
  if (!isSupabaseConfigured()) {
    body = (
      <p className="text-sm text-white/55">
        This agreement isn&rsquo;t available right now — please try again shortly.
      </p>
    );
  } else {
    // Tolerate a not-yet-migrated database: a load failure renders the
    // friendly fallback instead of the error boundary.
    const loaded = await getContractByToken(token).catch((error) => {
      console.warn("[agreement] contract load failed", error);
      return null;
    });
    if (!loaded || loaded.contract.status === "draft") {
      body = (
        <p className="text-sm text-white/55">
          We couldn&rsquo;t find that agreement. Check that the full link from
          your email was copied, or reply to the email and we&rsquo;ll resend it.
        </p>
      );
    } else {
      title = loaded.contract.title;
      if (loaded.contract.status === "sent") {
        await markContractViewed(loaded.contract.id).catch(() => {});
      }
      body = (
        <AgreementClient
          token={token}
          contract={loaded.contract}
          signatures={loaded.signatures.map((s) => ({
            id: s.id,
            signer_type: s.signer_type,
            role: s.role,
            signer_name: s.signer_name,
            signer_title: s.signer_title,
            signed_name: s.signed_name,
            sort_order: s.sort_order,
            required: s.required,
            signed_at: s.signed_at,
          }))}
          acknowledgments={
            CONTRACT_TEMPLATES[loaded.contract.kind]?.acknowledgments ?? []
          }
        />
      );
    }
  }

  return (
    <main className="min-h-screen bg-base pb-24">
      <header className="border-b border-white/10 bg-base/70 backdrop-blur-xl print:hidden">
        <div className="container-px flex h-16 items-center justify-between">
          <Logo />
          <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
            Confidential agreement
          </p>
        </div>
      </header>
      <div className="container-px pt-12 sm:pt-16">
        <div className="mx-auto max-w-5xl">
          <p className="label mb-4">Electronic signature</p>
          <h1 className="display max-w-3xl text-3xl sm:text-4xl">{title}</h1>
          <div className="mt-10">{body}</div>
        </div>
      </div>
    </main>
  );
}
