import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getClientById } from "@/lib/store";
import { toPublic } from "@/lib/seed";
import { Dashboard } from "@/components/portal/Dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Portal | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

export default async function PortalPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const client = await getClientById(session.sub);
  if (!client) redirect("/login");

  return <Dashboard client={toPublic(client)} />;
}
