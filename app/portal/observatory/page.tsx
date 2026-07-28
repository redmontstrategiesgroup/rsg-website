import { requireAppPage } from "@/lib/apps/context";
import { ObservatoryFrame } from "./ObservatoryFrame";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Observatory", robots: { index: false } };

export default async function ObservatoryPage() {
  await requireAppPage(); // auth gate — redirects to /login when signed out
  return <ObservatoryFrame />;
}
