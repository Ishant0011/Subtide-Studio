import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sanitizeNextPath } from "@/lib/security/redirects";

const PROTECTED_PREFIXES = ["/projects", "/upload", "/admin"];

/**
 * Resolves the exact origin from the incoming request headers so middleware
 * redirects stay strictly same-origin (preventing 127.0.0.1 vs localhost CSP mismatches).
 */
function getRequestOrigin(request: NextRequest): string {
  const rawHost = (request.headers.get("host") || "").split(",")[0].trim();
  const forwardedHost = (request.headers.get("x-forwarded-host") || "")
    .split(",")[0]
    .trim();

  // Next.js standalone/start server injects x-forwarded-host=localhost:<port>
  // even when the browser requested 127.0.0.1:<port>; preserve raw Host in that case
  // so browser fetch/RSC redirects stay strictly same-origin with CSP 'self'.
  const useRawLoopback =
    rawHost.startsWith("127.0.0.1") && forwardedHost.startsWith("localhost");
  const host = (useRawLoopback ? rawHost : forwardedHost || rawHost) || "";

  if (!host) {
    return request.nextUrl.origin;
  }
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto =
    (forwardedProto
      ? forwardedProto.split(",")[0].trim()
      : request.nextUrl.protocol.replace(":", "")) || "http";
  return `${proto}://${host}`;
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Always verify session with Supabase Auth server via getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
    response.headers.set("Pragma", "no-cache");
  }

  const origin = getRequestOrigin(request);

  if (isProtected && !user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "next",
      sanitizeNextPath(`${pathname}${search}`, "/projects")
    );
    const redirectRes = NextResponse.redirect(loginUrl);
    redirectRes.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
    return redirectRes;
  }

  if (pathname === "/login" && user) {
    const safeNext = sanitizeNextPath(
      request.nextUrl.searchParams.get("next"),
      "/projects"
    );
    const dest = new URL(safeNext, origin);
    const redirectRes = NextResponse.redirect(dest);
    redirectRes.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
    return redirectRes;
  }

  return response;
}

export const config = {
  matcher: ["/projects/:path*", "/upload/:path*", "/admin/:path*", "/login"],
};
