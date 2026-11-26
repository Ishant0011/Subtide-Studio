import crypto from "crypto";
import { NextResponse } from "next/server";
export { sanitizeNextPath } from "@/lib/security/redirects";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
} as const;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function noStoreJson<T>(
  body: T,
  init?: { status?: number; headers?: HeadersInit }
): NextResponse<T> {
  const headers = new Headers(NO_STORE_HEADERS);
  if (init?.headers) {
    const extra = new Headers(init.headers);
    extra.forEach((value, key) => headers.set(key, value));
  }
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers,
  });
}

/**
 * Validates same-origin CSRF defenses on state-changing requests (POST/PATCH/DELETE).
 * Checks Origin (preferred), Referer fallback, and Sec-Fetch-Site when present.
 */
export function validateSameOrigin(request: Request): { ok: true } | { ok: false; reason: string } {
  const hostHeader =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!hostHeader) {
    return { ok: false, reason: "Missing host header." };
  }
  const expectedHost = hostHeader.split(",")[0].trim().toLowerCase();

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (
    secFetchSite &&
    secFetchSite !== "same-origin" &&
    secFetchSite !== "none"
  ) {
    return { ok: false, reason: "Cross-site request blocked." };
  }

  const origin = request.headers.get("origin");
  if (origin) {
    if (origin === "null") {
      return { ok: false, reason: "Opaque origin blocked." };
    }
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (originHost !== expectedHost) {
        return { ok: false, reason: "Origin mismatch." };
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: "Invalid origin header." };
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererHost = new URL(referer).host.toLowerCase();
      if (refererHost !== expectedHost) {
        return { ok: false, reason: "Referer mismatch." };
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: "Invalid referer header." };
    }
  }

  // Allow non-browser / server-side requests only if they are not cross-site;
  // browsers always attach Origin or Referer on POST/PATCH/DELETE.
  return { ok: true };
}

export async function readBoundedJson<T>(
  request: Request,
  maxBytes = 256 * 1024
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsed = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      return { ok: false, status: 413, error: "Request body exceeds size limit." };
    }
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, status: 400, error: "Unable to read request body." };
  }

  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    return { ok: false, status: 413, error: "Request body exceeds size limit." };
  }

  if (!raw.trim()) {
    return { ok: true, data: {} as T };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON payload." };
  }
}

export function getClientIpHash(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const rawIp =
    (forwarded ? forwarded.split(",")[0].trim() : null) ||
    request.headers.get("x-real-ip") ||
    "unknown";
  // Hash client IP so raw IPs are not stored verbatim in audit or rate-limit keys
  return crypto.createHash("sha256").update(`cc-ip:${rawIp}`).digest("hex").slice(0, 24);
}
