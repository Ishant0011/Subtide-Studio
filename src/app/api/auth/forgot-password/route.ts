import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/security/audit";
import {
  noStoreJson,
  readBoundedJson,
  validateSameOrigin,
} from "@/lib/security/http";
import {
  buildIpSubject,
  checkRateLimit,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

interface ForgotPasswordPayload {
  email?: string;
}

const GENERIC_SUCCESS_MESSAGE =
  "If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.";

export async function POST(request: Request) {
  const originCheck = validateSameOrigin(request);
  if (!originCheck.ok) {
    return noStoreJson(
      { error: "Cross-origin request rejected." },
      { status: 403 }
    );
  }

  const parsed = await readBoundedJson<ForgotPasswordPayload>(
    request,
    4 * 1024
  );
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.error }, { status: parsed.status });
  }

  const email =
    typeof parsed.data.email === "string"
      ? parsed.data.email.trim().toLowerCase()
      : "";

  if (!email || !email.includes("@") || email.length > 254) {
    return noStoreJson(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const emailHash = crypto
    .createHash("sha256")
    .update(`cc-email:${email}`)
    .digest("hex")
    .slice(0, 16);

  const rate = await checkRateLimit({
    policy: RATE_LIMIT_POLICIES.authRecovery,
    subjectKey: buildIpSubject(request, emailHash),
    request,
  });
  if (!rate.ok) return rate.response;

  const requestOrigin = new URL(request.url).origin;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${requestOrigin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });

  if (error) {
    const isRateLimited =
      error.status === 429 || /rate limit|too many/i.test(error.message);
    await recordAuditEvent({
      eventType: "auth.recovery",
      outcome: "denied",
      targetResource: `email:${emailHash}`,
      request,
      metadata: { reason: isRateLimited ? "provider_rate_limit" : "provider_error" },
    });
    if (isRateLimited) {
      return noStoreJson(
        {
          error:
            "Too many reset emails requested recently. Please wait a minute and try again.",
        },
        { status: 429 }
      );
    }
  }

  return noStoreJson({
    ok: true,
    message: GENERIC_SUCCESS_MESSAGE,
  });
}
