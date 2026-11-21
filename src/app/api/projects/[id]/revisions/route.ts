import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { validateCaptionRevisionInput } from "@/lib/caption-editor";

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
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // Server-verified ownership check via RLS-scoped read
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, duration_ms, active_revision_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  let body: {
    baseRevisionId?: string | null;
    cues?: unknown;
    style?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const baseRevisionId =
    typeof body.baseRevisionId === "string" && body.baseRevisionId.trim()
      ? body.baseRevisionId.trim()
      : null;

  const validation = validateCaptionRevisionInput({
    cues: body.cues,
    style: body.style,
    durationMs: project.duration_ms,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
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
    return NextResponse.json(
      { error: "Failed to save caption revision.", detail: rpcError?.message },
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
    return NextResponse.json(
      {
        error: "A newer revision was saved in another tab.",
        code: "stale_revision",
        currentRevision: result.currentRevision ?? null,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ revision: result.revision }, { status: 201 });
}
