// lib/apiv1/resources/billing.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { getInvoice } from "@/lib/lifecycle/billing";
import { listInvoicesPage, listPaymentsPage } from "@/lib/lifecycle/paged";
import { getActiveSubscriptionForClient } from "@/lib/managed-services/store";
import { clientOf } from "../client.ts";
import { parseListParams } from "../pagination.ts";
import { invoiceOwnedBy, requireOwned, requireUuid } from "../ownership.ts";
import { toInvoiceDto, toPaymentDto, toSubscriptionDto } from "../serializers.ts";
import type { ApiHandler } from "../types.ts";

export const invoicesQuery = z.object({ status: z.string().max(40).optional(), limit: z.string().optional(), cursor: z.string().optional() });
export const pageQuery = z.object({ limit: z.string().optional(), cursor: z.string().optional() });

export const listInvoices: ApiHandler<undefined, z.infer<typeof invoicesQuery>> = async ({ principal, query, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listInvoicesPage(requireSupabase(), c.portal.client.id, { limit, cursor, status: query.status });
  return { data: page.data.map(toInvoiceDto), meta: { next_cursor: page.next_cursor, limit } };
};

export const getInvoiceHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const inv = await getInvoice(requireUuid(params.id));
  return { data: toInvoiceDto(requireOwned(inv, invoiceOwnedBy(inv, c.portal.client.id))) };
};

export const listPayments: ApiHandler<undefined, z.infer<typeof pageQuery>> = async ({ principal, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listPaymentsPage(requireSupabase(), c.portal.client.id, { limit, cursor });
  return { data: page.data.map(toPaymentDto), meta: { next_cursor: page.next_cursor, limit } };
};

export const getSubscription: ApiHandler<undefined, undefined> = async ({ principal }) => {
  const c = clientOf(principal);
  const sub = await getActiveSubscriptionForClient(c.portal.client.id);
  return { data: sub ? toSubscriptionDto(sub) : null };
};
