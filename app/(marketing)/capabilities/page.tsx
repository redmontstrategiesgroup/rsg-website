import { redirect } from "next/navigation";

/** Legacy route from a previous version of the site. */
export default function CapabilitiesPage() {
  redirect("/services");
}
