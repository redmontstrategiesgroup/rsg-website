// lib/apiv1/ownership.ts
import { notFound } from "./errors.ts";

export const projectOwnedBy = (p: { client_id: string } | null, clientId: string) => !!p && p.client_id === clientId;
export const ticketOwnedBy = (t: { client_id: string } | null, clientId: string) => !!t && t.client_id === clientId;
export const approvalOwnedBy = (a: { client_id: string } | null, clientId: string) => !!a && a.client_id === clientId;
export const fileOwnedBy = (f: { client_id: string | null } | null, clientId: string) => !!f && f.client_id === clientId;
export const invoiceOwnedBy = (i: { client_id: string | null } | null, clientId: string) => !!i && i.client_id === clientId;

/** 404 for both "missing" and "not yours" so other clients' ids stay unguessable. */
export function requireOwned<T>(row: T | null, owned: boolean): T {
  if (row === null || !owned) throw notFound();
  return row;
}
