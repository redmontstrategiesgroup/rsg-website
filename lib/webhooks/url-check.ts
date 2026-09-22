/**
 * SSRF-safe validation for webhook endpoint URLs.
 *
 * Pure and DNS-free: it rejects the obviously internal targets (loopback,
 * RFC1918, link-local incl. the cloud metadata address, CGNAT, IPv6 ULA and
 * link-local, `.internal` / `.local` names). A hostname that resolves to a
 * private address at delivery time is out of scope (spec §8).
 */

export type UrlCheckResult =
  | { ok: true; url: string }
  | { ok: false; reason: "invalid" | "scheme" | "host" | "length" };

export type UrlCheckOptions = {
  allowHttp: boolean;
  /**
   * Dev-only escape hatch so a local end-to-end delivery test can target a
   * receiver on this machine. Skips ONLY the host block list; scheme,
   * credential and length checks still apply. Never set in production.
   */
  allowPrivate?: boolean;
};

const MAX_URL_LENGTH = 2048;
const BLOCKED_NAMES = ["localhost"];
const BLOCKED_SUFFIXES = [".localhost", ".internal", ".local"];

function ipv4Octets(host: string): number[] | null {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  const octets = host.split(".").map(Number);
  return octets.every((o) => o >= 0 && o <= 255) ? octets : null;
}

function isBlockedIpv4(octets: number[]): boolean {
  const [a, b] = octets as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  return false;
}

function isBlockedIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true; // fc00::/7 (ULA)
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true; // fe80::/10 (link-local)
  // IPv4-mapped: dotted (`::ffff:10.0.0.1`) or the hex form the WHATWG URL
  // parser canonicalises it to (`::ffff:a00:1`).
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h);
  if (dotted) {
    const octets = ipv4Octets(dotted[1]!);
    return octets ? isBlockedIpv4(octets) : true;
  }
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (hex) {
    const hi = parseInt(hex[1]!, 16);
    const lo = parseInt(hex[2]!, 16);
    return isBlockedIpv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  }
  return false;
}

export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_NAMES.includes(host)) return true;
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return true;
  const v4 = ipv4Octets(host);
  if (v4) return isBlockedIpv4(v4);
  if (host.includes(":")) return isBlockedIpv6(host);
  return false;
}

export function checkWebhookUrl(input: string, opts: UrlCheckOptions): UrlCheckResult {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.href.length > MAX_URL_LENGTH) return { ok: false, reason: "length" };
  if (url.username || url.password) return { ok: false, reason: "host" };
  const schemeOk = url.protocol === "https:" || (opts.allowHttp && url.protocol === "http:");
  if (!schemeOk) return { ok: false, reason: "scheme" };
  if (!url.hostname) return { ok: false, reason: "host" };
  if (!opts.allowPrivate && isBlockedHost(url.hostname)) return { ok: false, reason: "host" };
  return { ok: true, url: url.href };
}
