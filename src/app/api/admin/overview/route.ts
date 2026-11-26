import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOwnerAdmin } from "@/lib/security/admin-guard";
import { noStoreJson } from "@/lib/security/http";
import {
  buildIpSubject,
  checkRateLimit,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rate = await checkRateLimit({
    policy: RATE_LIMIT_POLICIES.adminRead,
    subjectKey: buildIpSubject(request),
    request,
  });
  if (!rate.ok) return rate.response;

  const auth = await requireOwnerAdmin({
    request,
    resource: "GET /api/admin/overview",
  });
  if (!auth.ok) {
    return noStoreJson(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  const admin = createSupabaseAdminClient();
  const [projectsCount, ingestQueuedCount, exportQueuedCount, auditRes] =
    await Promise.all([
      admin.from("projects").select("id", { count: "exact", head: true }),
      admin
        .from("ingest_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["queued", "probing", "transcoding", "transcribing"]),
      admin
        .from("export_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["queued", "rendering"]),
      admin
        .from("security_audit_events")
        .select(
          "id, event_type, outcome, actor_user_id, target_resource, metadata, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  return noStoreJson({
    owner: {
      id: auth.user.id,
      aal: auth.aal,
      latestMfaTimestampSec: auth.latestMfaTimestampSec,
    },
    counts: {
      projects: projectsCount.count ?? 0,
      activeIngestJobs: ingestQueuedCount.count ?? 0,
      activeExportJobs: exportQueuedCount.count ?? 0,
    },
    recentAuditEvents: auditRes.data ?? [],
  });
}
