import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { DeveloperDocs } from "@/components/developers/DeveloperDocs";
import { buildOpenApi } from "@/lib/apiv1/openapi";
import { PROSE_SECTIONS } from "@/lib/developers/content";
import { apiPlatformEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "API reference | Redmont Strategies Group",
  description: "Reference for the Redmont Strategies Group API: authentication, errors, pagination, idempotency, webhooks and every endpoint, generated from the OpenAPI document.",
  alternates: { canonical: "/developers" },
  openGraph: {
    title: "API reference | Redmont Strategies Group",
    description: "Authentication, errors, pagination, idempotency, webhooks and every endpoint of the Redmont Strategies Group API.",
    url: "/developers",
    images: ["/og.png"],
  },
};

/** Public API reference. Rendered on the server from the generated OpenAPI document; 404 while the platform flag is off. */
export default async function DevelopersPage() {
  if (!apiPlatformEnabled()) notFound();
  const doc = await buildOpenApi();
  return (
    <PageShell>
      <DeveloperDocs doc={doc} prose={PROSE_SECTIONS} />
    </PageShell>
  );
}
