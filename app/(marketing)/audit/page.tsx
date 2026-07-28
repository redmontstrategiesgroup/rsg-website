import { redirect } from "next/navigation";

/** Legacy route: the audit now has a dedicated local service page. */
export default function AuditPage() {
  redirect("/systemsaudit");
}
