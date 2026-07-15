import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Login | Redmont Strategies Group",
  robots: { index: false, follow: false },
};

/** Only allow internal admin destinations after login. */
function safeAdminNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/admin";
  if (
    next === "/dashboard" ||
    next.startsWith("/dashboard?") ||
    next === "/admin" ||
    next.startsWith("/admin?")
  ) {
    return next.split("?")[0] || "/admin";
  }
  return "/admin";
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeAdminNext(params.next);
  const admin = await getAdminSession();
  if (admin) redirect(next);
  return <AdminLoginForm next={next} />;
}
