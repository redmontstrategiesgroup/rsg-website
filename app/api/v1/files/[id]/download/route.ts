import { DownloadSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { downloadFile } from "@/lib/apiv1/resources/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["files:read"],
  meta: { operationId: "downloadFile", summary: "Download a file", tag: "Files", response: envelope(DownloadSchema), status: 302 },
}, downloadFile);

export const OPTIONS = options;
