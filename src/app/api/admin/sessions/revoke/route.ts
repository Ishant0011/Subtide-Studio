import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOwnerAdmin } from "@/lib/security/admin-guard";
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

interface RevokeRequestBody {
  scope?: "others" | "global";
  reason?: string;
}

/**
 * Owner-only privileged write: revokes active sessions (requires AAL2 + fresh MFA within 15 min + CSRF).
 */
export async function POST(request: Request) {
  const originCheck = validateSameOrigin(request);
  if (!originCheck.ok) {
    return noStoreJson({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const rate = await checkRateLimit({
    policy: RATE_LIMIT_POLICIES.adminWrite,
    subjectKey: buildIpSubject(request),
    request,
  });
  if (!rate.ok) return rate.response;

  const auth = await requireOwnerAdmin({
    request,
    resource: "POST /api/admin/sessions/revoke",
    requireFreshMfaSeconds: 900,
  });
  if (!auth.ok) {
    return noStoreJson(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  const parsed = await readBoundedJson<RevokeRequestBody>(request, 4096);
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.error }, { status: parsed.status });
  }

  const scope = parsed.data.scope === "global" ? "global" : "others";
  const reason =
    typeof parsed.data.reason === "string"
      ? parsed.data.reason.trim().slice(0, 120)
      : "owner_requested_revocation";

  const supabase = await createSupabaseServerClient();
  const { error: signOutError } = await supabase.auth.signOut({ scope });

  if (signOutError) {
    await recordAuditEvent({
      eventType: "admin.sessions.revoke",
      outcome: "error",
      actorUserId: auth.user.id,
      targetResource: `scope:${scope}`,
      request,
      metadata: { reason },
    });
    return noStoreJson(
      { error: "Unable to revoke sessions right now." },
      { status: 500 }
    );
  }

  await recordAuditEvent({
    eventType: "admin.sessions.revoke",
    outcome: "allowed",
    actorUserId: auth.user.id,
    targetResource: `scope:${scope}`,
    request,
    metadata: { reason, scope },
  });

  return noStoreJson({
    ok: true,
    scope,
    revokedAt: new Date().toISOString(),
  });
}
