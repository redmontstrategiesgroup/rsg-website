import { FileSchema, listEnvelope } from "@/lib/apiv1/response-schemas";
import { api, options } from "@/lib/apiv1/runtime";
import { filesQuery, listFiles } from "@/lib/apiv1/resources/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["files:read"],
  query: filesQuery,
  meta: { operationId: "listFiles", summary: "List files", tag: "Files", response: listEnvelope(FileSchema) },
}, listFiles);

export const OPTIONS = options;
