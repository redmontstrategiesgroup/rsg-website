import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePortalPage } from "@/lib/lifecycle/portal-page";
import { canManageTeam } from "@/lib/lifecycle/access";
import { listTeam } from "@/lib/lifecycle/access";
import { PortalShell } from "@/components/portal/PortalShell";
import { TeamView } from "@/components/portal/TeamView";
import { PageHeader } from "@/components/portal/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team | Client Portal",
  robots: { index: false, follow: false },
};

export default async function TeamPage() {
  const ctx = await requirePortalPage();
  if (!canManageTeam(ctx.user.role)) redirect("/portal");

  // Tolerate a not-yet-migrated database — render calm empty states.
  const team = await listTeam(ctx.client.id).catch(() => ({
    users: [],
    legacyOwner: null,
  }));

  return (
    <PortalShell company={ctx.client.company} userName={ctx.user.name} role={ctx.user.role}>
      <PageHeader
        eyebrow="Team"
        title="Portal access"
        description="Give teammates their own logins with the right level of access — never share passwords."
      />
      <TeamView
        users={team.users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          title: u.title,
          role: u.role,
          active: u.active,
          hasAccepted: u.has_accepted,
          lastLoginAt: u.last_login_at,
        }))}
        legacyOwner={team.legacyOwner}
        selfId={ctx.user.id}
      />
    </PortalShell>
  );
}
