import { z } from "zod";
import { api, options } from "@/lib/apiv1/runtime";
import { downloadFile } from "@/lib/apiv1/resources/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api("GET", {
  auth: "client",
  scopes: ["files:read"],
  meta: { operationId: "downloadFile", summary: "Download a file", tag: "Files", response: z.any() },
}, downloadFile);

export const OPTIONS = options;
