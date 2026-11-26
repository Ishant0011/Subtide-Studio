import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isUuid, noStoreJson, validateSameOrigin } from "@/lib/security/http";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";

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
    policy: RATE_LIMIT_POLICIES.processJob,
    subjectKey: user.id,
    request,
    actorUserId: user.id,
  });
  if (!rate.ok) return rate.response;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, media_assets(id, status, user_id)")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project || project.user_id !== user.id) {
    return noStoreJson({ error: "Project not found." }, { status: 404 });
  }

  const assets = Array.isArray(project.media_assets) ? project.media_assets : [];
  const uploadedAsset = assets.find(
    (a: { status: string; user_id: string }) =>
      a.status === "uploaded" && a.user_id === user.id
  );

  if (!uploadedAsset) {
    return noStoreJson(
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
    return noStoreJson(
      { error: "Failed to enqueue processing job." },
      { status: 500 }
    );
  }

  return noStoreJson(data, { status: 200 });
}
