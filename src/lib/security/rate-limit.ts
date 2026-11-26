import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAuditEvent } from "@/lib/security/audit";
import { getClientIpHash, noStoreJson } from "@/lib/security/http";
import type { NextResponse } from "next/server";

export interface RateLimitPolicy {
  scope: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export const RATE_LIMIT_POLICIES = {
  authSignIn: { scope: "auth_signin", limit: 15, windowSeconds: 300 },
  authSignUp: { scope: "auth_signup", limit: 8, windowSeconds: 600 },
  uploadInit: { scope: "upload_init", limit: 20, windowSeconds: 300 },
  uploadComplete: { scope: "upload_complete", limit: 30, windowSeconds: 300 },
  processJob: { scope: "process_job", limit: 20, windowSeconds: 300 },
  exportCreate: { scope: "export_create", limit: 30, windowSeconds: 300 },
  adminRead: { scope: "admin_read", limit: 30, windowSeconds: 60 },
  adminWrite: { scope: "admin_write", limit: 10, windowSeconds: 300 },
} as const satisfies Record<string, RateLimitPolicy>;

export async function checkRateLimit(input: {
  policy: RateLimitPolicy;
  subjectKey: string;
  request?: Request;
  actorUserId?: string | null;
}): Promise<{ ok: true; result: RateLimitResult } | { ok: false; response: NextResponse }> {
  const admin = createSupabaseAdminClient();
  const bucketKey = `${input.policy.scope}:${input.subjectKey}`.slice(0, 200);

  const { data, error } = await admin.rpc("check_and_increment_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: input.policy.limit,
    p_window_seconds: input.policy.windowSeconds,
  });

  if (error || !data) {
    // Fail closed on rate-limit backend failure for sensitive admin/auth scopes
    if (
      input.policy.scope.startsWith("admin_") ||
      input.policy.scope.startsWith("auth_")
    ) {
      return {
        ok: false,
        response: noStoreJson(
          { error: "Service temporarily unavailable. Please retry shortly." },
          { status: 503 }
        ),
      };
    }
    return {
      ok: true,
      result: {
        allowed: true,
        count: 0,
        limit: input.policy.limit,
        remaining: input.policy.limit,
        retryAfterSeconds: 0,
      },
    };
  }

  const parsed = data as RateLimitResult;
  if (!parsed.allowed) {
    await recordAuditEvent({
      eventType: `rate_limit.${input.policy.scope}`,
      outcome: "denied",
      actorUserId: input.actorUserId ?? null,
      targetResource: input.policy.scope,
      request: input.request,
      metadata: {
        count: parsed.count,
        limit: parsed.limit,
        retryAfterSeconds: parsed.retryAfterSeconds,
      },
    });

    return {
      ok: false,
      response: noStoreJson(
        {
          error: "Too many requests. Please wait a moment and try again.",
          retryAfterSeconds: parsed.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(parsed.retryAfterSeconds) },
        }
      ),
    };
  }

  return { ok: true, result: parsed };
}

export function buildIpSubject(request: Request, suffix?: string): string {
  const ipHash = getClientIpHash(request);
  return suffix ? `${ipHash}:${suffix}` : ipHash;
}
