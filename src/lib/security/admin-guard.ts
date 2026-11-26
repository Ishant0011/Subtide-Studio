import "server-only";

import crypto from "crypto";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/security/audit";
import { isUuid } from "@/lib/security/http";

export type OwnerAdminFailureCode =
  | "admin_not_configured"
  | "unauthenticated"
  | "not_owner"
  | "mfa_required"
  | "reauth_required";

export type OwnerAdminCheckResult =
  | {
      ok: true;
      user: User;
      aal: "aal2";
      latestMfaTimestampSec: number | null;
    }
  | {
      ok: false;
      status: 401 | 403 | 503;
      code: OwnerAdminFailureCode;
      error: string;
    };

function constantTimeUuidEqual(a: string, b: string): boolean {
  const normA = Buffer.from(a.trim().toLowerCase(), "utf8");
  const normB = Buffer.from(b.trim().toLowerCase(), "utf8");
  if (normA.length !== normB.length) return false;
  return crypto.timingSafeEqual(normA, normB);
}

/**
 * Reads the single server-configured immutable owner Supabase user UUID.
 * Fails closed (returns null) if unset, empty, or malformed.
 */
export function getConfiguredOwnerAdminUserId(): string | null {
  const raw = process.env.OWNER_ADMIN_USER_ID?.trim();
  if (!raw || !isUuid(raw)) {
    return null;
  }
  return raw.toLowerCase();
}

/**
 * Server-only owner-admin authorization guard.
 *
 * Enforces ALL of the following (fail closed):
 * 1. Server-only OWNER_ADMIN_USER_ID is configured as a valid UUID.
 * 2. Supabase Auth server verifies the active user session via auth.getUser().
 * 3. Verified user.id matches OWNER_ADMIN_USER_ID in constant time (never email/metadata/OAuth).
 * 4. Active session is MFA-verified at AAL2 via auth.mfa.getAuthenticatorAssuranceLevel().
 * 5. Optional fresh MFA verification window for sensitive privileged actions.
 */
export async function requireOwnerAdmin(options?: {
  request?: Request;
  resource?: string;
  requireFreshMfaSeconds?: number;
}): Promise<OwnerAdminCheckResult> {
  const resource = options?.resource ?? "admin";
  const configuredOwnerId = getConfiguredOwnerAdminUserId();

  if (!configuredOwnerId) {
    await recordAuditEvent({
      eventType: "admin.access",
      outcome: "denied",
      targetResource: resource,
      request: options?.request,
      metadata: { reason: "admin_not_configured" },
    });
    return {
      ok: false,
      status: 403,
      code: "admin_not_configured",
      error: "Owner administration is disabled.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    await recordAuditEvent({
      eventType: "admin.access",
      outcome: "denied",
      targetResource: resource,
      request: options?.request,
      metadata: { reason: "unauthenticated" },
    });
    return {
      ok: false,
      status: 401,
      code: "unauthenticated",
      error: "Authentication required.",
    };
  }

  if (!constantTimeUuidEqual(user.id, configuredOwnerId)) {
    await recordAuditEvent({
      eventType: "admin.access",
      outcome: "denied",
      actorUserId: user.id,
      targetResource: resource,
      request: options?.request,
      metadata: { reason: "not_owner" },
    });
    return {
      ok: false,
      status: 403,
      code: "not_owner",
      error: "Owner access required.",
    };
  }

  const { data: aalData, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError || !aalData || aalData.currentLevel !== "aal2") {
    await recordAuditEvent({
      eventType: "admin.access",
      outcome: "denied",
      actorUserId: user.id,
      targetResource: resource,
      request: options?.request,
      metadata: {
        reason: "mfa_required",
        currentLevel: aalData?.currentLevel ?? "unknown",
        nextLevel: aalData?.nextLevel ?? "unknown",
      },
    });
    return {
      ok: false,
      status: 403,
      code: "mfa_required",
      error: "Multi-factor authentication (AAL2) is required for owner access.",
    };
  }

  // Extract latest MFA verification timestamp from verified AMR entries
  const amrEntries = Array.isArray(aalData.currentAuthenticationMethods)
    ? aalData.currentAuthenticationMethods
    : [];
  const mfaTimestamps = amrEntries
    .filter((entry): entry is { method: string; timestamp: number } => {
      if (typeof entry !== "object" || entry === null) return false;
      const method = String(entry.method ?? "").toLowerCase();
      return (
        method === "totp" ||
        method === "mfa/totp" ||
        method === "webauthn" ||
        method === "mfa/webauthn" ||
        method === "phone"
      );
    })
    .map((entry) => Number(entry.timestamp))
    .filter((ts) => Number.isFinite(ts) && ts > 0);

  const latestMfaTimestampSec =
    mfaTimestamps.length > 0 ? Math.max(...mfaTimestamps) : null;

  if (options?.requireFreshMfaSeconds && options.requireFreshMfaSeconds > 0) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      latestMfaTimestampSec === null ||
      nowSec - latestMfaTimestampSec > options.requireFreshMfaSeconds
    ) {
      await recordAuditEvent({
        eventType: "admin.access",
        outcome: "denied",
        actorUserId: user.id,
        targetResource: resource,
        request: options?.request,
        metadata: {
          reason: "reauth_required",
          maxAgeSeconds: options.requireFreshMfaSeconds,
        },
      });
      return {
        ok: false,
        status: 403,
        code: "reauth_required",
        error: "Recent MFA verification is required for this privileged action.",
      };
    }
  }

  await recordAuditEvent({
    eventType: "admin.access",
    outcome: "allowed",
    actorUserId: user.id,
    targetResource: resource,
    request: options?.request,
    metadata: { aal: "aal2" },
  });

  return {
    ok: true,
    user,
    aal: "aal2",
    latestMfaTimestampSec,
  };
}
