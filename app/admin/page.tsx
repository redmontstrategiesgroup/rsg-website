import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveAdminContext, isMfaSetupRequired } from "@/lib/admin-auth";
import { getClients, getLeads, getSubscribers, getPageViews } from "@/lib/store";
import { toPublic } from "@/lib/seed";
import { summarizeAnalytics } from "@/lib/analytics";
import { can } from "@/lib/scheduling/permissions";
import { AdminConsole } from "@/components/admin/AdminConsole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Console | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const ctx = await resolveAdminContext();
  if (!ctx) redirect("/admin/login");

  const role = ctx.role;
  // Capability flags — mirror the server-side permission gates on the API
  // routes so the console never server-renders data a role can't manage.
  const caps = {
    clients: can("manage_clients", role),
    leads: can("manage_leads", role),
    analytics: can("view_analytics", role),
    scheduling: can("view_appointments", role),
    connect: can("manage_clients", role),
    privateAi: can("manage_leads", role),
    brief: can("manage_leads", role),
    security: can("view_security", role),
  };

  // Only load what this role is allowed to see.
  const [clients, leads, subscribers, pageViews] = await Promise.all([
    caps.clients ? getClients() : Promise.resolve([]),
    caps.leads ? getLeads() : Promise.resolve([]),
    caps.leads ? getSubscribers() : Promise.resolve([]),
    caps.analytics ? getPageViews() : Promise.resolve([]),
  ]);

  const mfaSetupRequired = await isMfaSetupRequired(ctx);

  return (
    <AdminConsole
      adminEmail={ctx.admin.email}
      role={role}
      caps={caps}
      mfaEnabled={ctx.admin.mfaEnabled}
      mfaSetupRequired={mfaSetupRequired}
      initialClients={clients.map(toPublic)}
      leads={leads}
      subscribers={subscribers}
      analytics={summarizeAnalytics(pageViews)}
    />
  );
}
