import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/security/audit";
import {
  noStoreJson,
  readBoundedJson,
  sanitizeNextPath,
  validateSameOrigin,
} from "@/lib/security/http";
import {
  buildIpSubject,
  checkRateLimit,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

interface MagicLinkPayload {
  email?: string;
  nextPath?: string;
}

const GENERIC_SUCCESS_MESSAGE =
  "Check your inbox for a one-time sign-in link. It expires shortly and brings you right back here.";

export async function POST(request: Request) {
  const originCheck = validateSameOrigin(request);
  if (!originCheck.ok) {
    return noStoreJson(
      { error: "Cross-origin request rejected." },
      { status: 403 }
    );
  }

  const parsed = await readBoundedJson<MagicLinkPayload>(request, 4 * 1024);
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.error }, { status: parsed.status });
  }

  const email =
    typeof parsed.data.email === "string"
      ? parsed.data.email.trim().toLowerCase()
      : "";
  const nextPath = sanitizeNextPath(parsed.data.nextPath, "/projects");

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
    policy: RATE_LIMIT_POLICIES.authMagicLink,
    subjectKey: buildIpSubject(request, emailHash),
    request,
  });
  if (!rate.ok) return rate.response;

  const requestOrigin = new URL(request.url).origin;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${requestOrigin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    const isRateLimited =
      error.status === 429 || /rate limit|too many/i.test(error.message);
    await recordAuditEvent({
      eventType: "auth.magic_link",
      outcome: "denied",
      targetResource: `email:${emailHash}`,
      request,
      metadata: { reason: isRateLimited ? "provider_rate_limit" : "provider_error" },
    });
    if (isRateLimited) {
      return noStoreJson(
        {
          error:
            "Too many email links requested recently. Please wait a minute and try again.",
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
