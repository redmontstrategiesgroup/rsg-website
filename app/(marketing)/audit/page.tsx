import { redirect } from "next/navigation";

/** Legacy route: the audit now has a dedicated local service page. */
export default function AuditPage() {
  redirect("/business-systems-audit-plymouth-county-ma");
}
