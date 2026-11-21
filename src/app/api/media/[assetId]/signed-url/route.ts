import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MEDIA_BUCKET } from "@/lib/uploads";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const { assetId } = await context.params;
  const kind = request.nextUrl.searchParams.get("kind");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: asset, error: assetError } = await supabase
    .from("media_assets")
    .select("id, project_id, user_id, object_key, status")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError || !asset || asset.user_id !== user.id) {
    return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
  }

  if (asset.status !== "uploaded") {
    return NextResponse.json(
      { error: "Media asset has not finished uploading." },
      { status: 409 }
    );
  }

  let targetKey = asset.object_key;
  let targetKind: "source" | "preview" = "source";

  if (kind === "preview") {
    const { data: project } = await supabase
      .from("projects")
      .select("preview_object_key, user_id")
      .eq("id", asset.project_id)
      .maybeSingle();

    if (project && project.user_id === user.id && project.preview_object_key) {
      targetKey = project.preview_object_key;
      targetKind = "preview";
    }
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(targetKey, 60);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to create signed download URL." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signedUrl: signed.signedUrl,
    kind: targetKind,
    expiresInSeconds: 60,
  });
}
