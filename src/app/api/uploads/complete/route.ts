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

  const { data: project, error: projectFetchError } = await supabase
    .from("projects")
    .select("id, title, status, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectFetchError || !project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

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

  // 3. If pending, verify stored object existence and exact byte size in the private bucket
  let verifiedSize = asset.verified_size_bytes ?? asset.expected_size_bytes;

  if (asset.status !== "uploaded") {
    const lastSlash = asset.object_key.lastIndexOf("/");
    const folder = lastSlash > 0 ? asset.object_key.slice(0, lastSlash) : "";
    const fileName =
      lastSlash >= 0 ? asset.object_key.slice(lastSlash + 1) : asset.object_key;

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

    verifiedSize = storedSize;
  }

  // 4. Atomically finalize upload and enqueue one logical ingest job in a single Postgres transaction
  const { data: rpcData, error: rpcError } = await admin.rpc(
    "finalize_upload_and_enqueue_ingest",
    {
      p_user_id: user.id,
      p_project_id: project.id,
      p_asset_id: asset.id,
      p_verified_size_bytes: verifiedSize,
      p_completed_at: new Date().toISOString(),
    }
  );

  if (rpcError || !rpcData) {
    return NextResponse.json(
      {
        error: "Failed to finalize upload and enqueue ingest job.",
        detail: rpcError?.message,
      },
      { status: 500 }
    );
  }

  const result = rpcData as {
    idempotent: boolean;
    project: UploadCompleteResponse["project"];
    asset: UploadCompleteResponse["asset"];
    job: NonNullable<UploadCompleteResponse["job"]>;
  };

  const payload: UploadCompleteResponse = {
    status: "uploaded",
    idempotent: Boolean(result.idempotent),
    project: result.project,
    asset: result.asset,
    job: result.job,
  };

  return NextResponse.json(payload, { status: 200 });
}
