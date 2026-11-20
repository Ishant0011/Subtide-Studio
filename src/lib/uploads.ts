export const MEDIA_BUCKET = "media";
export const MAX_UPLOAD_BYTES = 150 * 1024 * 1024; // 150 MiB (157,286,400 bytes)
export const MAX_DURATION_MINUTES = 3;
export const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024; // Required 6 MiB chunk size for Supabase Storage TUS

export const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface MediaAssetRow {
  id: string;
  project_id: string;
  user_id: string;
  bucket_id: string;
  object_key: string;
  original_filename: string;
  mime_type: AllowedMimeType;
  expected_size_bytes: number;
  verified_size_bytes: number | null;
  status: "pending" | "uploaded" | "failed";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithMedia {
  id: string;
  user_id: string;
  title: string;
  status: "uploading" | "ready" | "failed";
  created_at: string;
  updated_at: string;
  media_assets: MediaAssetRow[];
}

export interface UploadInitResponse {
  projectId: string;
  assetId: string;
  bucket: string;
  objectKey: string;
  mimeType: AllowedMimeType;
  expectedSizeBytes: number;
  tusEndpoint: string;
  maxUploadBytes: number;
  maxDurationMinutes: number;
}

export interface UploadCompleteResponse {
  status: "uploaded";
  idempotent: boolean;
  project: {
    id: string;
    title: string;
    status: string;
  };
  asset: {
    id: string;
    objectKey: string;
    status: string;
    verifiedSizeBytes: number;
    completedAt: string | null;
  };
}

export interface UploadValidationResult {
  ok: true;
  mimeType: AllowedMimeType;
  extension: "mp4" | "mov";
  sizeBytes: number;
  sanitizedFilename: string;
}

export interface UploadValidationError {
  ok: false;
  error: string;
}

export function validateUploadFile(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): UploadValidationResult | UploadValidationError {
  const filename = (input.filename || "").trim();
  if (!filename || filename.length > 255) {
    return { ok: false, error: "Please choose a valid MP4 or MOV file." };
  }

  const lower = filename.toLowerCase();
  const extMatch = lower.endsWith(".mp4")
    ? "mp4"
    : lower.endsWith(".mov")
      ? "mov"
      : null;

  if (!extMatch) {
    return {
      ok: false,
      error: "Only MP4 (.mp4) and QuickTime MOV (.mov) files are supported.",
    };
  }

  const rawMime = (input.mimeType || "").trim().toLowerCase();
  let normalizedMime: AllowedMimeType | null = null;
  if (rawMime === "video/mp4") {
    normalizedMime = "video/mp4";
  } else if (rawMime === "video/quicktime") {
    normalizedMime = "video/quicktime";
  } else if (rawMime === "" || rawMime === "application/octet-stream") {
    // Some browsers omit MIME type for .mov files; infer strictly from verified extension
    normalizedMime = extMatch === "mp4" ? "video/mp4" : "video/quicktime";
  }

  if (!normalizedMime) {
    return {
      ok: false,
      error: "Unsupported file format. Please upload an MP4 or MOV video.",
    };
  }

  if (
    !Number.isFinite(input.sizeBytes) ||
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes <= 0
  ) {
    return { ok: false, error: "The selected file is empty or unreadable." };
  }

  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File exceeds the ${formatBytes(MAX_UPLOAD_BYTES)} limit (selected: ${formatBytes(input.sizeBytes)}).`,
    };
  }

  const sanitizedFilename = filename.replace(/[/\\]/g, "_");
  return {
    ok: true,
    mimeType: normalizedMime,
    extension: extMatch,
    sizeBytes: input.sizeBytes,
    sanitizedFilename,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

export function deriveProjectTitle(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.slice(0, 120) || "Untitled Clip";
}
