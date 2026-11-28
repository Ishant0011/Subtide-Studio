import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/security/http";

const ALLOWED_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "magiclink",
  "recovery",
  "invite",
  "email_change",
  "email",
]);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const providerError = searchParams.get("error");
  const providerErrorCode = searchParams.get("error_code");
  const safeNext = sanitizeNextPath(searchParams.get("next"), "/projects");

  if (providerError === "access_denied") {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_cancelled");
    loginUrl.searchParams.set("next", safeNext);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  }

  if (providerErrorCode === "otp_expired") {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_link_expired");
    loginUrl.searchParams.set("next", safeNext);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  }

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const target =
        rawType === "recovery" ? "/reset-password" : safeNext;
      const response = NextResponse.redirect(new URL(target, origin));
      response.headers.set("Cache-Control", "no-store, private");
      return response;
    }
  } else if (
    tokenHash &&
    rawType &&
    ALLOWED_OTP_TYPES.has(rawType as EmailOtpType)
  ) {
    const { error } = await supabase.auth.verifyOtp({
      type: rawType as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) {
      const target =
        rawType === "recovery" ? "/reset-password" : safeNext;
      const response = NextResponse.redirect(new URL(target, origin));
      response.headers.set("Cache-Control", "no-store, private");
      return response;
    }
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set(
    "error",
    tokenHash || rawType ? "auth_link_expired" : "auth_callback_failed"
  );
  loginUrl.searchParams.set("next", safeNext);
  const response = NextResponse.redirect(loginUrl);
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}
