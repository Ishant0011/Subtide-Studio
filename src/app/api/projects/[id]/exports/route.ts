import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  getDefaultResolutionTier,
  getResolutionOptionsForSource,
  validateResolutionTierForSource,
  type ExportJobRow,
} from "@/lib/exports";
import {
  isUuid,
  noStoreJson,
  readBoundedJson,
  validateSameOrigin,
} from "@/lib/security/http";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return noStoreJson(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const { id: projectId } = await context.params;
  if (!isUuid(projectId)) {
    return noStoreJson({ error: "Project not found." }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project || project.user_id !== user.id) {
    return noStoreJson({ error: "Project not found." }, { status: 404 });
  }

  // Preserves all historical exports (including any earlier SRT/MOV rows) for owner access
  const { data: jobs, error: jobsError } = await supabase
    .from("export_jobs")
    .select(
      "id, project_id, revision_id, revision_number, user_id, format, resolution_tier, status, stage_message, attempt_count, max_attempts, bucket_id, output_object_key, output_mime_type, output_filename, output_size_bytes, output_width, output_height, output_duration_ms, error_code, error_message, started_at, completed_at, created_at, updated_at"
    )
    .eq("project_id", project.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (jobsError) {
    return noStoreJson({ error: "Failed to load exports." }, { status: 500 });
  }

  return noStoreJson({ exports: (jobs ?? []) as ExportJobRow[] });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return noStoreJson(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const originCheck = validateSameOrigin(request);
  if (!originCheck.ok) {
    return noStoreJson(
      { error: "Cross-origin request rejected." },
      { status: 403 }
    );
  }

  const { id: projectId } = await context.params;
  if (!isUuid(projectId)) {
    return noStoreJson({ error: "Project not found." }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  const rate = await checkRateLimit({
    policy: RATE_LIMIT_POLICIES.exportCreate,
    subjectKey: user.id,
    request,
    actorUserId: user.id,
  });
  if (!rate.ok) return rate.response;

  const parsed = await readBoundedJson<{
    revisionId?: unknown;
    format?: unknown;
    resolutionTier?: unknown;
  }>(request, 8 * 1024);
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.data;

  const revisionId =
    typeof body.revisionId === "string" ? body.revisionId.trim() : "";
  if (!isUuid(revisionId)) {
    return noStoreJson(
      { error: "A valid saved revisionId is required to export." },
      { status: 400 }
    );
  }

  // New exports are strictly MP4-only
  const requestedFormat =
    body.format === undefined || body.format === null ? "mp4" : body.format;
  if (requestedFormat !== "mp4") {
    return noStoreJson(
      { error: "New exports support MP4 video only." },
      { status: 400 }
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, user_id, title, status, media_kind, duration_ms, preview_width, preview_height, media_assets(id, status, media_kind, mime_type, width, height, rotation_deg, created_at)"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project || project.user_id !== user.id) {
    return noStoreJson({ error: "Project not found." }, { status: 404 });
  }

  if (project.status !== "ready") {
    return noStoreJson(
      { error: "Project must finish processing before exporting." },
      { status: 409 }
    );
  }

  const assets = Array.isArray(project.media_assets)
    ? (project.media_assets as Array<{
        id: string;
        status: string;
        media_kind: string | null;
        mime_type: string | null;
        width: number | null;
        height: number | null;
        rotation_deg: number | null;
      }>)
    : [];
  const primaryAsset =
    assets.find((a) => a.status === "uploaded") ?? assets[0] ?? null;

  const mediaKind: "video" | "audio" =
    project.media_kind === "audio" ||
    primaryAsset?.media_kind === "audio" ||
    primaryAsset?.mime_type?.startsWith("audio/")
      ? "audio"
      : "video";

  const sourceWidth = primaryAsset?.width ?? project.preview_width ?? null;
  const sourceHeight = primaryAsset?.height ?? project.preview_height ?? null;
  const sourceRotationDeg = primaryAsset?.rotation_deg ?? 0;

  const options = getResolutionOptionsForSource({
    mediaKind,
    sourceWidth,
    sourceHeight,
    sourceRotationDeg,
  });
  const requestedTier =
    typeof body.resolutionTier === "string" && body.resolutionTier.trim()
      ? body.resolutionTier.trim().toLowerCase()
      : getDefaultResolutionTier(options);

  const tierCheck = validateResolutionTierForSource({
    tier: requestedTier,
    mediaKind,
    sourceWidth,
    sourceHeight,
    sourceRotationDeg,
  });
  if (!tierCheck.ok) {
    return noStoreJson({ error: tierCheck.error }, { status: 400 });
  }

  const { data: revision, error: revError } = await supabase
    .from("caption_revisions")
    .select("id, project_id, user_id, revision_number")
    .eq("id", revisionId)
    .eq("project_id", project.id)
    .maybeSingle();

  if (revError || !revision || revision.user_id !== user.id) {
    return noStoreJson(
      { error: "Saved caption revision not found for this project." },
      { status: 404 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: rpcData, error: rpcError } = await admin.rpc(
    "request_export_job",
    {
      p_user_id: user.id,
      p_project_id: project.id,
      p_revision_id: revision.id,
      p_format: "mp4",
      p_resolution_tier: tierCheck.option.tier,
    }
  );

  if (rpcError || !rpcData) {
    return noStoreJson(
      { error: "Failed to create export job." },
      { status: 500 }
    );
  }

  const result = rpcData as {
    ok: boolean;
    idempotent: boolean;
    retried?: boolean;
    job: ExportJobRow;
  };

  return noStoreJson(
    {
      job: result.job,
      idempotent: result.idempotent,
      retried: Boolean(result.retried),
    },
    { status: result.idempotent ? 200 : 201 }
  );
}
