import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  MAX_UPLOAD_BYTES,
  MEDIA_BUCKET,
  type UploadCompleteResponse,
} from "@/lib/uploads";

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: {
    projectId?: string;
    assetId?: string;
    objectKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
  const objectKey = typeof body.objectKey === "string" ? body.objectKey.trim() : "";

  if (!projectId || !assetId || !objectKey) {
    return NextResponse.json(
      { error: "projectId, assetId, and objectKey are required." },
      { status: 400 }
    );
  }

  // 1. Server-verified ownership via RLS-scoped read + explicit user_id check
  const { data: asset, error: assetError } = await supabase
    .from("media_assets")
    .select(
      "id, project_id, user_id, bucket_id, object_key, expected_size_bytes, verified_size_bytes, status, completed_at"
    )
    .eq("id", assetId)
    .maybeSingle();

  if (assetError || !asset || asset.user_id !== user.id) {
    return NextResponse.json(
      { error: "Media asset not found." },
      { status: 404 }
    );
  }

  // 2. Verify expected project & server-assigned object key
  if (asset.project_id !== projectId || asset.object_key !== objectKey) {
    return NextResponse.json(
      { error: "Upload key or project mismatch." },
      { status: 400 }
    );
  }

  // Fetch parent project (also RLS-scoped to owner)
  const { data: project, error: projectFetchError } = await supabase
    .from("projects")
    .select("id, title, status, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectFetchError || !project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  // 3. Idempotent completion: repeated completion calls on an already-finalized asset succeed safely
  if (asset.status === "uploaded") {
    const idempotentPayload: UploadCompleteResponse = {
      status: "uploaded",
      idempotent: true,
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
      },
      asset: {
        id: asset.id,
        objectKey: asset.object_key,
        status: asset.status,
        verifiedSizeBytes: asset.verified_size_bytes ?? asset.expected_size_bytes,
        completedAt: asset.completed_at,
      },
    };
    return NextResponse.json(idempotentPayload, { status: 200 });
  }

  // 4. Verify stored object existence and exact byte size in the private bucket (server-only)
  const lastSlash = asset.object_key.lastIndexOf("/");
  const folder = lastSlash > 0 ? asset.object_key.slice(0, lastSlash) : "";
  const fileName =
    lastSlash >= 0 ? asset.object_key.slice(lastSlash + 1) : asset.object_key;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Server storage verification is misconfigured.",
      },
      { status: 503 }
    );
  }

  const { data: objects, error: listError } = await admin.storage
    .from(MEDIA_BUCKET)
    .list(folder, { limit: 100, search: fileName });

  if (listError) {
    return NextResponse.json(
      { error: "Could not verify uploaded object in storage.", detail: listError.message },
      { status: 502 }
    );
  }

  const stored = (objects ?? []).find((entry) => entry.name === fileName);
  if (!stored) {
    return NextResponse.json(
      { error: "Uploaded object was not found at the expected storage key." },
      { status: 409 }
    );
  }

  const rawSize = (stored.metadata as { size?: number | string } | null)?.size;
  const storedSize = typeof rawSize === "number" ? rawSize : Number(rawSize);

  if (
    !Number.isFinite(storedSize) ||
    storedSize <= 0 ||
    storedSize > MAX_UPLOAD_BYTES
  ) {
    return NextResponse.json(
      { error: "Stored file size is invalid or exceeds the 150 MB limit." },
      { status: 422 }
    );
  }

  if (storedSize !== asset.expected_size_bytes) {
    return NextResponse.json(
      {
        error: "Stored file size does not match the expected upload size.",
        expectedSizeBytes: asset.expected_size_bytes,
        storedSizeBytes: storedSize,
      },
      { status: 422 }
    );
  }

  // 5. Finalize server-controlled media asset & project status via privileged client
  //    (ownership already verified above and re-asserted in the WHERE clause)
  const completedAt = new Date().toISOString();

  const { data: updatedAsset, error: updateAssetError } = await admin
    .from("media_assets")
    .update({
      status: "uploaded",
      verified_size_bytes: storedSize,
      completed_at: completedAt,
    })
    .eq("id", asset.id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id, object_key, status, verified_size_bytes, completed_at")
    .maybeSingle();

  if (updateAssetError) {
    return NextResponse.json(
      { error: "Failed to finalize media asset.", detail: updateAssetError.message },
      { status: 500 }
    );
  }

  // Handle race condition where a concurrent completion already finalized the asset
  if (!updatedAsset) {
    const { data: currentAsset } = await admin
      .from("media_assets")
      .select("id, object_key, status, verified_size_bytes, completed_at")
      .eq("id", asset.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (currentAsset?.status === "uploaded") {
      const racePayload: UploadCompleteResponse = {
        status: "uploaded",
        idempotent: true,
        project: {
          id: project.id,
          title: project.title,
          status: "ready",
        },
        asset: {
          id: currentAsset.id,
          objectKey: currentAsset.object_key,
          status: currentAsset.status,
          verifiedSizeBytes: currentAsset.verified_size_bytes ?? storedSize,
          completedAt: currentAsset.completed_at,
        },
      };
      return NextResponse.json(racePayload, { status: 200 });
    }

    return NextResponse.json(
      { error: "Asset could not be finalized from its current state." },
      { status: 409 }
    );
  }

  const { data: updatedProject, error: updateProjectError } = await admin
    .from("projects")
    .update({ status: "ready" })
    .eq("id", project.id)
    .eq("user_id", user.id)
    .select("id, title, status")
    .single();

  if (updateProjectError) {
    return NextResponse.json(
      { error: "Asset verified, but failed to update project status." },
      { status: 500 }
    );
  }

  const payload: UploadCompleteResponse = {
    status: "uploaded",
    idempotent: false,
    project: {
      id: updatedProject.id,
      title: updatedProject.title,
      status: updatedProject.status,
    },
    asset: {
      id: updatedAsset.id,
      objectKey: updatedAsset.object_key,
      status: updatedAsset.status,
      verifiedSizeBytes: updatedAsset.verified_size_bytes ?? storedSize,
      completedAt: updatedAsset.completed_at,
    },
  };

  return NextResponse.json(payload, { status: 200 });
}
