// lib/apiv1/resources/files.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { getDownloadUrl, getFile } from "@/lib/lifecycle/files";
import { listFilesPage } from "@/lib/lifecycle/paged";
import { clientOf } from "../client.ts";
import { ApiError } from "../errors.ts";
import { parseListParams } from "../pagination.ts";
import { fileOwnedBy, requireOwned, requireUuid } from "../ownership.ts";
import { toFileDto } from "../serializers.ts";
import type { ApiHandler } from "../types.ts";

export const filesQuery = z.object({
  project_id: z.string().uuid().optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

export const listFiles: ApiHandler<undefined, z.infer<typeof filesQuery>> = async ({ principal, query, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listFilesPage(requireSupabase(), c.portal.client.id, { limit, cursor, projectId: query.project_id });
  return { data: page.data.map(toFileDto), meta: { next_cursor: page.next_cursor, limit } };
};

async function ownedFile(id: string, clientId: string) {
  const f = await getFile(requireUuid(id));
  return requireOwned(f, fileOwnedBy(f, clientId));
}

export const getFileHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  return { data: toFileDto(await ownedFile(params.id, c.portal.client.id)) };
};

export const downloadFile: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const f = await ownedFile(params.id, c.portal.client.id);
  if (f.scan_status !== "clean") {
    throw new ApiError(409, "conflict", "File is not available for download yet.");
  }
  const { url, name, sizeBytes } = await getDownloadUrl(f.id);
  return {
    status: 302,
    headers: { Location: url },
    data: { url, name, size_bytes: sizeBytes, expires_in_seconds: 600 },
  };
};
