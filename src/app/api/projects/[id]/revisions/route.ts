import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { validateCaptionRevisionInput } from "@/lib/caption-editor";
import {
  isUuid,
  noStoreJson,
  readBoundedJson,
  validateSameOrigin,
} from "@/lib/security/http";

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

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, duration_ms, active_revision_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project || project.user_id !== user.id) {
    return noStoreJson({ error: "Project not found." }, { status: 404 });
  }

  const parsed = await readBoundedJson<{
    baseRevisionId?: string | null;
    cues?: unknown;
    style?: unknown;
  }>(request, 512 * 1024);
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.data;

  const baseRevisionId =
    typeof body.baseRevisionId === "string" && body.baseRevisionId.trim()
      ? body.baseRevisionId.trim()
      : null;

  if (baseRevisionId !== null && !isUuid(baseRevisionId)) {
    return noStoreJson(
      { error: "Invalid baseRevisionId." },
      { status: 400 }
    );
  }

  const validation = validateCaptionRevisionInput({
    cues: body.cues,
    style: body.style,
    durationMs: project.duration_ms,
  });

  if (!validation.ok) {
    return noStoreJson({ error: validation.error }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: rpcData, error: rpcError } = await admin.rpc(
    "save_caption_revision",
    {
      p_user_id: user.id,
      p_project_id: project.id,
      p_base_revision_id: baseRevisionId,
      p_cues: validation.normalizedCues,
      p_words: validation.flatWords,
      p_style: validation.normalizedStyle,
    }
  );

  if (rpcError || !rpcData) {
    return noStoreJson(
      { error: "Failed to save caption revision." },
      { status: 500 }
    );
  }

  const result = rpcData as {
    ok: boolean;
    reason?: string;
    currentRevision?: unknown;
    revision?: unknown;
  };

  if (!result.ok && result.reason === "stale_revision") {
    return noStoreJson(
      {
        error: "A newer revision was saved in another tab.",
        code: "stale_revision",
        currentRevision: result.currentRevision ?? null,
      },
      { status: 409 }
    );
  }

  return noStoreJson({ revision: result.revision }, { status: 201 });
}
