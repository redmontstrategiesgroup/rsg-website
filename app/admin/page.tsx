import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireLiveAdminSession } from "@/lib/auth";
import { getClients, getLeads, getSubscribers, getPageViews } from "@/lib/store";
import { toPublic } from "@/lib/seed";
import { summarizeAnalytics } from "@/lib/analytics";
import { AdminConsole } from "@/components/admin/AdminConsole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Console | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const admin = await requireLiveAdminSession();
  if (!admin) redirect("/admin/login");

  const [clients, leads, subscribers, pageViews] = await Promise.all([
    getClients(),
    getLeads(),
    getSubscribers(),
    getPageViews(),
  ]);

  return (
    <AdminConsole
      adminEmail={admin.email}
      initialClients={clients.map(toPublic)}
      leads={leads}
      subscribers={subscribers}
      analytics={summarizeAnalytics(pageViews)}
    />
  );
}
