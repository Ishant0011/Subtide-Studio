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

interface SignUpPayload {
  email?: string;
  password?: string;
  nextPath?: string;
}

export async function POST(request: Request) {
  const originCheck = validateSameOrigin(request);
  if (!originCheck.ok) {
    return noStoreJson({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const parsed = await readBoundedJson<SignUpPayload>(request, 8 * 1024);
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.error }, { status: parsed.status });
  }

  const email =
    typeof parsed.data.email === "string" ? parsed.data.email.trim().toLowerCase() : "";
  const password =
    typeof parsed.data.password === "string" ? parsed.data.password : "";
  const nextPath = sanitizeNextPath(parsed.data.nextPath, "/projects");

  if (!email || email.length > 254 || password.length < 6 || password.length > 256) {
    return noStoreJson(
      { error: "Provide a valid email and a password of at least 6 characters." },
      { status: 400 }
    );
  }

  const emailHash = crypto
    .createHash("sha256")
    .update(`cc-email:${email}`)
    .digest("hex")
    .slice(0, 16);

  const rate = await checkRateLimit({
    policy: RATE_LIMIT_POLICIES.authSignUp,
    subjectKey: buildIpSubject(request, emailHash),
    request,
  });
  if (!rate.ok) return rate.response;

  const requestOrigin = new URL(request.url).origin;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${requestOrigin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    await recordAuditEvent({
      eventType: "auth.signup",
      outcome: "denied",
      targetResource: `email:${emailHash}`,
      request,
      metadata: { reason: "signup_rejected" },
    });
    return noStoreJson(
      { error: "Could not create account. Check your email or try signing in." },
      { status: 400 }
    );
  }

  return noStoreJson({
    ok: true,
    hasSession: Boolean(data.session),
  });
}
