import { NextResponse, type NextRequest } from "next/server";
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
import { MEDIA_BUCKET } from "@/lib/uploads";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const { id: projectId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  // Verify project ownership via RLS-scoped query
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
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
    return NextResponse.json(
      { error: "Failed to load exports." },
      { status: 500 }
    );
  }

  return NextResponse.json({ exports: (jobs ?? []) as ExportJobRow[] });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const { id: projectId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  let body: { revisionId?: unknown; format?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const revisionId =
    typeof body.revisionId === "string" ? body.revisionId.trim() : "";
  if (!UUID_RE.test(revisionId)) {
    return NextResponse.json(
      { error: "A valid saved revisionId is required to export." },
      { status: 400 }
    );
  }

  if (!isExportFormat(body.format)) {
    return NextResponse.json(
      { error: "Format must be 'srt', 'mp4', or 'mov_alpha'." },
      { status: 400 }
    );
  }
  const format = body.format;

  // Server-verified ownership & revision binding via RLS-scoped reads
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, title, status, duration_ms")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  if (project.status !== "ready") {
    return NextResponse.json(
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
    return NextResponse.json(
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
    return NextResponse.json(
      { error: "Failed to create export job.", detail: rpcError?.message },
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

    // Upload complete UTF-8 SRT artifact to private storage before publishing
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
          error_message: uploadError.message.slice(0, 500),
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return NextResponse.json(
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
      return NextResponse.json(
        { error: "Failed to finalize SRT export." },
        { status: 500 }
      );
    }

    job = (pubData as { ok: true; job: ExportJobRow }).job;
  }

  return NextResponse.json(
    {
      job,
      idempotent: result.idempotent,
      retried: Boolean(result.retried),
    },
    { status: result.idempotent ? 200 : 201 }
  );
}
