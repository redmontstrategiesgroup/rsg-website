import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getClientById, isSessionLive } from "@/lib/store";
import { toPublic } from "@/lib/seed";
import { getPortalManagedData } from "@/lib/managed-services/portal-data";
import type { PortalManagedData } from "@/lib/managed-services/portal-data";
import { getBookingForLead } from "@/lib/scheduling/booking";
import type { PortalBookingSummary } from "@/lib/scheduling/booking";
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

  // Revocation check runs only on this full page load, not on in-page tab
  // switches. Cheap, and a revoked/expired session is caught immediately on
  // refresh (and within the keepalive interval while the tab stays open).
  if (session.sid && !(await isSessionLive(session.sid))) redirect("/login");

  const client = await getClientById(session.sub);
  if (!client) redirect("/login");

  // Managed-services data is additive: the portal must render even when
  // its stores are unavailable, so failures degrade to the empty state.
  let managed: PortalManagedData | null = null;
  try {
    managed = await getPortalManagedData(client.id);
  } catch (err) {
    console.warn("[portal] managed-services data unavailable.", err);
  }

  // The client's originating consultation, resolved through lead_id (set
  // when the portal account was provisioned from a booked opportunity).
  // Accounts created directly in admin, without a lead, have none.
  let booking: PortalBookingSummary | null = null;
  if (client.leadId) {
    try {
      booking = await getBookingForLead(client.leadId);
    } catch (err) {
      console.warn("[portal] booking lookup unavailable.", err);
    }
  }

  return <Dashboard client={toPublic(client)} managed={managed} booking={booking} />;
}
