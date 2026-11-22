import { isIP } from "node:net";

const TRACKING_PARAM_PATTERNS: RegExp[] = [
  /^utm_/i,
  /^at_/i,
  /^mc_(cid|eid)$/i,
  /^(fbclid|gclid|dclid|msclkid|twclid|igshid)$/i,
  /^(ref|ref_src|referrer|source|campaign|__twitter_impression)$/i,
  /^(guccounter|guce_referrer|guce_referrer_sig)$/i,
];

function isTrackingParameter(name: string): boolean {
  return TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Normalize an article URL so the same story from different feeds collapses to
 * one row. Removes fragments and tracking parameters, but preserves meaningful
 * query strings (e.g. `?p=123`).
 */
export function canonicalizeArticleUrl(
  raw: string,
  base?: string,
): string | null {
  try {
    const url = new URL(raw.trim(), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.username = "";
    url.password = "";

    for (const key of Array.from(url.searchParams.keys())) {
      if (isTrackingParameter(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Feed URLs are not canonicalized like article URLs: query parameters can
 * select the feed (e.g. hnrss.org/newest?q=cybersecurity). Only validate.
 */
export function normalizeFeedUrl(raw: string): string {
  const trimmed = raw.trim();
  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid http(s) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Feed URL must start with http:// or https://.");
  }

  if (isPrivateHostname(url.hostname)) {
    throw new Error("Private and local network feed URLs are not allowed.");
  }

  url.hash = "";
  return url.toString();
}

/** Reject loopback, link-local, and private-range hosts (basic SSRF guard). */
export function isPrivateHostname(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "");

  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".home.arpa") ||
    host === "metadata.google.internal"
  ) {
    return true;
  }

  const version = isIP(host);

  if (version === 4) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;

    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (version === 6) {
    if (host === "::1" || host === "::") return true;
    if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
    if (/^fe[89ab][0-9a-f]:/.test(host)) return true;
    if (host.startsWith("::ffff:")) {
      return isPrivateHostname(host.slice("::ffff:".length));
    }
  }

  return false;
}

export function feedHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown source";
  }
}
