import { randomBytes } from "node:crypto";

/** Generate an unguessable URL-safe token. */
export function createSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function createIcalUid(domain = "redmontstrategiesgroup.com"): string {
  return `${createSecureToken(16)}@${domain}`;
}
