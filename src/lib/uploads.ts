export const MEDIA_BUCKET = "media";
export const MAX_UPLOAD_BYTES = 150 * 1024 * 1024; // 150 MiB (157,286,400 bytes)
export const MAX_DURATION_MINUTES = 3;
export const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024; // Required 6 MiB chunk size for Supabase Storage TUS

export const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface NormalizedCaptionWord {
  id: string;
  text: string;
  start_ms: number;
  end_ms: number;
  confidence: number | null;
}

export interface NormalizedCaptionCue {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  words: NormalizedCaptionWord[];
}

export interface CaptionRevisionRow {
  id: string;
  project_id: string;
  user_id: string;
  revision_number: number;
  source: "deepgram_nova3" | "fixture" | "no_speech";
  speech_status: "speech" | "no_speech";
  language: string | null;
  words: NormalizedCaptionWord[];
  cues: NormalizedCaptionCue[];
  created_at: string;
}

export type IngestJobStatus =
  | "queued"
  | "probing"
  | "transcoding"
  | "transcribing"
  | "completed"
  | "failed";

export type IngestErrorCode =
  | "corrupt_media"
  | "missing_audio"
  | "duration_limit_exceeded"
  | "bounds_exceeded"
  | "provider_failure"
  | "storage_error"
  | "internal_error";

export interface IngestJobRow {
  id: string;
  project_id: string;
  media_asset_id: string;
  user_id: string;
  status: IngestJobStatus;
  stage_message: string | null;
  attempt_count: number;
  max_attempts: number;
  error_code: IngestErrorCode | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

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
  media_kind?: "video" | "audio" | null;
  duration_ms?: number | null;
  width?: number | null;
  height?: number | null;
  rotation_deg?: number | null;
  has_audio?: boolean | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithMedia {
  id: string;
  user_id: string;
  title: string;
  status: "uploading" | "queued" | "processing" | "ready" | "failed";
  media_kind?: "video" | "audio" | null;
  duration_ms?: number | null;
  preview_object_key?: string | null;
  preview_mime_type?: string | null;
  preview_width?: number | null;
  preview_height?: number | null;
  active_revision_id?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  created_at: string;
  updated_at: string;
  media_assets: MediaAssetRow[];
  ingest_jobs?: IngestJobRow[];
  caption_revisions?: CaptionRevisionRow[];
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
  job?: {
    id: string;
    status: IngestJobStatus;
    stageMessage: string | null;
    attemptCount: number;
  };
}

export interface UploadValidationResult {
  ok: true;
  mimeType: AllowedMimeType;
  extension: "mp4" | "mov" | "mp3" | "wav";
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
    return {
      ok: false,
      error: "Please choose a valid MP4, MOV, MP3, or WAV file.",
    };
  }

  const lower = filename.toLowerCase();
  const extMatch = lower.endsWith(".mp4")
    ? "mp4"
    : lower.endsWith(".mov")
      ? "mov"
      : lower.endsWith(".mp3")
        ? "mp3"
        : lower.endsWith(".wav")
          ? "wav"
          : null;

  if (!extMatch) {
    return {
      ok: false,
      error:
        "Only MP4 (.mp4), QuickTime MOV (.mov), MP3 (.mp3), and WAV (.wav) files are supported.",
    };
  }

  const rawMime = (input.mimeType || "").trim().toLowerCase();
  let normalizedMime: AllowedMimeType | null = null;
  if (rawMime === "video/mp4") {
    normalizedMime = "video/mp4";
  } else if (rawMime === "video/quicktime") {
    normalizedMime = "video/quicktime";
  } else if (rawMime === "audio/mpeg" || rawMime === "audio/mp3") {
    normalizedMime = "audio/mpeg";
  } else if (rawMime === "audio/wav" || rawMime === "audio/x-wav" || rawMime === "audio/wave") {
    normalizedMime = "audio/wav";
  } else if (rawMime === "" || rawMime === "application/octet-stream") {
    // Some browsers omit MIME type for .mov/.wav; infer strictly from verified extension
    normalizedMime =
      extMatch === "mp4"
        ? "video/mp4"
        : extMatch === "mov"
          ? "video/quicktime"
          : extMatch === "mp3"
            ? "audio/mpeg"
            : "audio/wav";
  }

  if (!normalizedMime) {
    return {
      ok: false,
      error:
        "Unsupported file format. Please upload an MP4, MOV, MP3, or WAV file.",
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
