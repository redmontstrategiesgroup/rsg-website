import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getProposalByToken,
  proposalTotals,
} from "@/lib/lifecycle/proposals";
import { ProposalViewer } from "@/components/lifecycle/ProposalViewer";
import { Logo } from "@/components/Logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Proposal | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

export default async function LifecycleProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let body: React.ReactNode;
  let title = "Your proposal";
  if (!isSupabaseConfigured()) {
    body = (
      <p className="text-sm text-white/55">
        This proposal isn&rsquo;t available right now — please try again shortly.
      </p>
    );
  } else {
    const loaded = await getProposalByToken(token);
    if (!loaded || loaded.proposal.status === "draft") {
      body = (
        <p className="text-sm text-white/55">
          We couldn&rsquo;t find that proposal. Check that the full link from
          your email was copied, or reply to the email and we&rsquo;ll resend it.
        </p>
      );
    } else {
      title = loaded.proposal.title;
      body = (
        <ProposalViewer
          token={token}
          proposal={loaded.proposal}
          options={loaded.options}
          comments={loaded.comments}
          totals={proposalTotals(loaded.proposal, loaded.options)}
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
            Confidential proposal
          </p>
        </div>
      </header>
      <div className="container-px pt-12 sm:pt-16">
        <div className="mx-auto max-w-5xl">
          <p className="label mb-4">Prepared for you by Redmont Strategies Group</p>
          <h1 className="display max-w-3xl text-3xl sm:text-4xl">{title}</h1>
          <div className="mt-10">{body}</div>
        </div>
      </div>
    </main>
  );
}
