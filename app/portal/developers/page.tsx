import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requirePortalPage } from "@/lib/lifecycle/portal-page";
import { canManageTeam } from "@/lib/lifecycle/access";
import { requireSupabase } from "@/lib/lifecycle/core";
import { apiPlatformEnabled } from "@/lib/env";
import { listApiKeys } from "@/lib/apiv1/key-store";
import { CLIENT_SCOPES } from "@/lib/apiv1/scopes";
import { PortalShell } from "@/components/portal/PortalShell";
import { ApiKeysView } from "@/components/portal/ApiKeysView";
import { PageHeader } from "@/components/portal/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developers | Client Portal",
  robots: { index: false, follow: false },
};

export default async function DevelopersPage() {
  if (!apiPlatformEnabled()) notFound();
  const ctx = await requirePortalPage();
  if (!canManageTeam(ctx.user.role)) redirect("/portal");

  // Tolerate a not-yet-migrated database: render a calm empty state.
  const keys = await listApiKeys(requireSupabase(), { type: "client", id: ctx.client.id }).catch(
    () => [],
  );

  return (
    <PortalShell company={ctx.client.company} userName={ctx.user.name} role={ctx.user.role}>
      <PageHeader
        eyebrow="Developers"
        title="API keys"
        description="Connect your own tools to your Redmont workspace. Keys are shown once, store them somewhere safe."
      />
      <ApiKeysView initialKeys={keys} scopes={[...CLIENT_SCOPES]} endpoint="/api/portal/apikeys" />
    </PortalShell>
  );
}
