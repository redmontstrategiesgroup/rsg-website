import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getInviteByToken } from "@/lib/lifecycle/access";
import { InviteAccept } from "@/components/portal/InviteAccept";
import { Logo } from "@/components/Logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accept Invitation | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = isSupabaseConfigured() ? await getInviteByToken(token) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        {invite ? (
          <InviteAccept
            token={token}
            name={invite.user.name}
            email={invite.user.email}
            company={invite.company}
          />
        ) : (
          <div className="card px-6 py-8 text-center">
            <p className="text-sm leading-relaxed text-white/60">
              This invitation link is invalid or has expired. Ask your account
              owner to send a fresh one — invitations are valid for 7 days.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
