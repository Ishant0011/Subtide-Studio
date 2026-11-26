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

interface SignInPayload {
  email?: string;
  password?: string;
}

export async function POST(request: Request) {
  const originCheck = validateSameOrigin(request);
  if (!originCheck.ok) {
    return noStoreJson({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const parsed = await readBoundedJson<SignInPayload>(request, 8 * 1024);
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.error }, { status: parsed.status });
  }

  const email =
    typeof parsed.data.email === "string" ? parsed.data.email.trim().toLowerCase() : "";
  const password =
    typeof parsed.data.password === "string" ? parsed.data.password : "";

  if (!email || !password || email.length > 254 || password.length > 256) {
    return noStoreJson(
      { error: "Please enter a valid email address and password." },
      { status: 400 }
    );
  }

  const emailHash = crypto
    .createHash("sha256")
    .update(`cc-email:${email}`)
    .digest("hex")
    .slice(0, 16);

  const rate = await checkRateLimit({
    policy: RATE_LIMIT_POLICIES.authSignIn,
    subjectKey: buildIpSubject(request, emailHash),
    request,
  });
  if (!rate.ok) return rate.response;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    await recordAuditEvent({
      eventType: "auth.signin",
      outcome: "denied",
      targetResource: `email:${emailHash}`,
      request,
      metadata: { reason: "invalid_credentials" },
    });
    return noStoreJson(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  return noStoreJson({
    ok: true,
    user: { id: data.user.id },
  });
}
