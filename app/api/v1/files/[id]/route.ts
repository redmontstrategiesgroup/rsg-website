import { FileSchema, envelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { getFileHandler } from "@/lib/apiv1/resources/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["files:read"],
  meta: { operationId: "getFile", summary: "Get a file", tag: "Files", response: envelope(FileSchema) },
}, getFileHandler);

export const OPTIONS = options;
