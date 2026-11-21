import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabasePublicEnv, isSupabaseConfigured } from "@/lib/supabase/env";
import {
  MAX_DURATION_MINUTES,
  MAX_UPLOAD_BYTES,
  MEDIA_BUCKET,
  deriveProjectTitle,
  validateUploadFile,
  type UploadInitResponse,
} from "@/lib/uploads";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  // 1. Server-verified authentication
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: {
    title?: string;
    filename?: string;
    mimeType?: string;
    sizeBytes?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const validation = validateUploadFile({
    filename: typeof body.filename === "string" ? body.filename : "",
    mimeType: typeof body.mimeType === "string" ? body.mimeType : "",
    sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : -1,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const projectTitle =
    typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim().slice(0, 120)
      : deriveProjectTitle(validation.sanitizedFilename);

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Server allocation credentials are not configured.",
      },
      { status: 503 }
    );
  }

  // 2. Server-assigned IDs and collision-free object key (strictly server-controlled)
  const projectId = randomUUID();
  const assetId = randomUUID();
  const objectKey = `${user.id}/${projectId}/${assetId}.${validation.extension}`;

  const { error: projectError } = await admin.from("projects").insert({
    id: projectId,
    user_id: user.id,
    title: projectTitle,
    status: "uploading",
  });

  if (projectError) {
    return NextResponse.json(
      { error: "Failed to create project record.", detail: projectError.message },
      { status: 500 }
    );
  }

  const { error: assetError } = await admin.from("media_assets").insert({
    id: assetId,
    project_id: projectId,
    user_id: user.id,
    bucket_id: MEDIA_BUCKET,
    object_key: objectKey,
    original_filename: validation.sanitizedFilename,
    mime_type: validation.mimeType,
    expected_size_bytes: validation.sizeBytes,
    status: "pending",
  });

  if (assetError) {
    // Clean up orphaned project row if asset insert fails
    await admin.from("projects").delete().eq("id", projectId).eq("user_id", user.id);
    return NextResponse.json(
      { error: "Failed to initialize media asset.", detail: assetError.message },
      { status: 500 }
    );
  }

  const { url } = getSupabasePublicEnv();
  const response: UploadInitResponse = {
    projectId,
    assetId,
    bucket: MEDIA_BUCKET,
    objectKey,
    mimeType: validation.mimeType,
    expectedSizeBytes: validation.sizeBytes,
    tusEndpoint: `${url}/storage/v1/upload/resumable`,
    maxUploadBytes: MAX_UPLOAD_BYTES,
    maxDurationMinutes: MAX_DURATION_MINUTES,
  };

  return NextResponse.json(response, { status: 201 });
}
