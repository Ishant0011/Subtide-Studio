import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  isUuid,
  noStoreJson,
  readBoundedJson,
  validateSameOrigin,
} from "@/lib/security/http";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import {
  MAX_UPLOAD_BYTES,
  MEDIA_BUCKET,
  type UploadCompleteResponse,
} from "@/lib/uploads";

export async function POST(request: NextRequest) {
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

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  const rate = await checkRateLimit({
    policy: RATE_LIMIT_POLICIES.uploadComplete,
    subjectKey: user.id,
    request,
    actorUserId: user.id,
  });
  if (!rate.ok) return rate.response;

  const parsed = await readBoundedJson<{
    projectId?: string;
    assetId?: string;
    objectKey?: string;
  }>(request, 16 * 1024);
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.data;

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
  const objectKey = typeof body.objectKey === "string" ? body.objectKey.trim() : "";

  if (!isUuid(projectId) || !isUuid(assetId) || !objectKey || objectKey.length > 512) {
    return noStoreJson(
      { error: "Valid projectId, assetId, and objectKey are required." },
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
    return noStoreJson({ error: "Media asset not found." }, { status: 404 });
  }

  // 2. Verify expected project & server-assigned object key
  if (asset.project_id !== projectId || asset.object_key !== objectKey) {
    return noStoreJson(
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
    return noStoreJson({ error: "Project not found." }, { status: 404 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return noStoreJson(
      { error: "Storage verification service is temporarily unavailable." },
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
      return noStoreJson(
        { error: "Could not verify uploaded object in storage." },
        { status: 502 }
      );
    }

    const stored = (objects ?? []).find((entry) => entry.name === fileName);
    if (!stored) {
      return noStoreJson(
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
      return noStoreJson(
        { error: "Stored file size is invalid or exceeds the 150 MB limit." },
        { status: 422 }
      );
    }

    if (storedSize !== asset.expected_size_bytes) {
      return noStoreJson(
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
    return noStoreJson(
      { error: "Failed to finalize upload and enqueue processing job." },
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

  return noStoreJson(payload, { status: 200 });
}
