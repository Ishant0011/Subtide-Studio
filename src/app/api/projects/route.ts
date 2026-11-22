import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_BUCKET, type ProjectWithMedia } from "@/lib/uploads";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

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

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, user_id, title, status, media_kind, duration_ms, preview_object_key, preview_mime_type, preview_width, preview_height, active_revision_id, last_error_code, last_error_message, created_at, updated_at, media_assets(id, project_id, user_id, bucket_id, object_key, original_filename, mime_type, expected_size_bytes, verified_size_bytes, status, media_kind, duration_ms, width, height, rotation_deg, has_audio, completed_at, created_at, updated_at), ingest_jobs(id, project_id, media_asset_id, user_id, status, stage_message, attempt_count, max_attempts, error_code, error_message, started_at, completed_at, created_at, updated_at), caption_revisions!caption_revisions_project_id_fkey(id, project_id, user_id, revision_number, source, speech_status, language, words, cues, created_at)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load projects.", detail: error.message },
      { status: 500 }
    );
  }

  const rawProjects = (data ?? []) as ProjectWithMedia[];
  const projects = await Promise.all(
    rawProjects.map(async (project) => {
      const primaryAsset = project.media_assets?.[0] ?? null;
      const isAudio =
        project.media_kind === "audio" ||
        primaryAsset?.mime_type?.startsWith("audio/");
      if (isAudio) {
        return { ...project, thumbnail_url: null };
      }

      const key =
        project.preview_object_key ||
        (primaryAsset?.status === "uploaded" ? primaryAsset.object_key : null);
      if (!key) {
        return { ...project, thumbnail_url: null };
      }

      const { data: signed } = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(key, 300);

      return { ...project, thumbnail_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ projects });
}
