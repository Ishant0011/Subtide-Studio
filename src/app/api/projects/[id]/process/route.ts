import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Owner-authorized endpoint to start processing an already-finalized upload
 * (such as a Phase 2 clip uploaded before Phase 3) or retry a failed ingest job
 * without re-uploading.
 */
export async function POST(
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
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // Server-verified ownership via RLS-scoped read
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, media_assets(id, status, user_id)")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const assets = Array.isArray(project.media_assets) ? project.media_assets : [];
  const uploadedAsset = assets.find(
    (a: { status: string; user_id: string }) =>
      a.status === "uploaded" && a.user_id === user.id
  );

  if (!uploadedAsset) {
    return NextResponse.json(
      { error: "No finalized upload found for this project." },
      { status: 409 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("enqueue_existing_asset_ingest", {
    p_user_id: user.id,
    p_project_id: project.id,
    p_asset_id: uploadedAsset.id,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to enqueue processing job.", detail: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 200 });
}
