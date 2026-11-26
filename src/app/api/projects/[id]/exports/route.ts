import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { hydrateEditorCues } from "@/lib/caption-editor";
import {
  buildExportFilename,
  generateSrtFromCues,
  isExportFormat,
  type ExportJobRow,
} from "@/lib/exports";
import {
  isUuid,
  noStoreJson,
  readBoundedJson,
  validateSameOrigin,
} from "@/lib/security/http";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { MEDIA_BUCKET } from "@/lib/uploads";

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

  const { data: jobs, error: jobsError } = await supabase
    .from("export_jobs")
    .select(
      "id, project_id, revision_id, revision_number, user_id, format, status, stage_message, attempt_count, max_attempts, bucket_id, output_object_key, output_mime_type, output_filename, output_size_bytes, output_width, output_height, output_duration_ms, error_code, error_message, started_at, completed_at, created_at, updated_at"
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
    return noStoreJson({ error: "Cross-origin request rejected." }, { status: 403 });
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

  if (!isExportFormat(body.format)) {
    return noStoreJson(
      { error: "Format must be 'srt', 'mp4', or 'mov_alpha'." },
      { status: 400 }
    );
  }
  const format = body.format;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, title, status, duration_ms")
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

  const { data: revision, error: revError } = await supabase
    .from("caption_revisions")
    .select("id, project_id, user_id, revision_number, cues, style")
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
      p_format: format,
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

  let job = result.job;

  // Synchronous UTF-8 SRT generation & upload to private storage when not already ready
  if (format === "srt" && job.status !== "ready") {
    const cues = hydrateEditorCues(revision.cues);
    const srtText = generateSrtFromCues(cues);
    const srtBuffer = Buffer.from(srtText, "utf8");
    const filename = buildExportFilename(
      project.title,
      revision.revision_number,
      "srt"
    );
    const objectKey = `${user.id}/${project.id}/exports/${job.id}.srt`;

    const { error: uploadError } = await admin.storage
      .from(MEDIA_BUCKET)
      .upload(objectKey, srtBuffer, {
        contentType: "text/plain",
        upsert: true,
      });

    if (uploadError) {
      await admin
        .from("export_jobs")
        .update({
          status: "failed",
          stage_message: "SRT upload failed",
          error_code: "storage_error",
          error_message: "Unable to store subtitle export artifact.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return noStoreJson(
        { error: "Failed to store SRT subtitle file." },
        { status: 500 }
      );
    }

    const { data: pubData, error: pubError } = await admin.rpc(
      "publish_immediate_export",
      {
        p_user_id: user.id,
        p_job_id: job.id,
        p_output_object_key: objectKey,
        p_output_mime_type: "text/plain; charset=utf-8",
        p_output_filename: filename,
        p_output_size_bytes: Math.max(1, srtBuffer.byteLength),
        p_output_duration_ms: project.duration_ms ?? null,
      }
    );

    if (pubError || !pubData || !(pubData as { ok: boolean }).ok) {
      return noStoreJson(
        { error: "Failed to finalize SRT export." },
        { status: 500 }
      );
    }

    job = (pubData as { ok: true; job: ExportJobRow }).job;
  }

  return noStoreJson(
    {
      job,
      idempotent: result.idempotent,
      retried: Boolean(result.retried),
    },
    { status: result.idempotent ? 200 : 201 }
  );
}
