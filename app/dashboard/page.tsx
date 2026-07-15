import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireLiveAdminSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { ExecutiveDashboard } from "@/components/dashboard/ExecutiveDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Executive Intelligence | Redmont Strategies Group",
  description: "Private Redmont Strategies Group executive intelligence dashboard.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default async function DashboardPage() {
  const admin = await requireLiveAdminSession();
  if (!admin) redirect("/admin/login?next=/dashboard");
  const data = await getDashboardData();
  return <ExecutiveDashboard adminEmail={admin.email} initialData={data} />;
}
