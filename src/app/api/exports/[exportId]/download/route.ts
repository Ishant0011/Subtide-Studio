import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_BUCKET } from "@/lib/uploads";

const SIGNED_DOWNLOAD_TTL_SECONDS = 60;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ exportId: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const { exportId } = await context.params;
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

  // Strict RLS-scoped ownership check
  const { data: job, error: jobError } = await supabase
    .from("export_jobs")
    .select(
      "id, user_id, project_id, revision_id, revision_number, format, status, bucket_id, output_object_key, output_mime_type, output_filename, output_size_bytes"
    )
    .eq("id", exportId)
    .maybeSingle();

  if (jobError || !job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Export not found." }, { status: 404 });
  }

  if (job.status !== "ready" || !job.output_object_key) {
    return NextResponse.json(
      { error: "Export artifact is not ready for download." },
      { status: 409 }
    );
  }

  // Generate short-lived owner-only signed download URL via the user's RLS session
  const { data: signed, error: signError } = await supabase.storage
    .from(job.bucket_id || MEDIA_BUCKET)
    .createSignedUrl(job.output_object_key, SIGNED_DOWNLOAD_TTL_SECONDS, {
      download: job.output_filename || true,
    });

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to create signed export download URL." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signedUrl: signed.signedUrl,
    filename: job.output_filename,
    mimeType: job.output_mime_type,
    sizeBytes: job.output_size_bytes,
    revisionId: job.revision_id,
    revisionNumber: job.revision_number,
    format: job.format,
    expiresInSeconds: SIGNED_DOWNLOAD_TTL_SECONDS,
  });
}
