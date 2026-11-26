import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getClientIpHash } from "@/lib/security/http";
import { redactSensitiveText, sanitizeAuditMetadata } from "@/lib/security/redact";

export interface AuditEventInput {
  eventType: string;
  outcome: "allowed" | "denied" | "error";
  actorUserId?: string | null;
  targetResource?: string | null;
  request?: Request;
  metadata?: Record<string, unknown>;
}

/**
 * Records a redacted security audit event to public.security_audit_events.
 * Never throws into caller control flow and never persists raw secrets, tokens, or IPs.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const ipHash = input.request ? getClientIpHash(input.request) : null;
    const rawUa = input.request?.headers.get("user-agent") ?? null;
    const userAgent = rawUa ? redactSensitiveText(rawUa, 160) : null;

    await admin.from("security_audit_events").insert({
      event_type: input.eventType.slice(0, 80),
      outcome: input.outcome,
      actor_user_id: input.actorUserId ?? null,
      target_resource: input.targetResource
        ? redactSensitiveText(input.targetResource, 160)
        : null,
      ip_hash: ipHash,
      user_agent: userAgent,
      metadata: sanitizeAuditMetadata(input.metadata),
    });
  } catch {
    // Audit write failures must not leak internal details or break request handling
  }
}
