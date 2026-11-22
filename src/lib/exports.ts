import type { EditorCue } from "@/lib/caption-editor";

export type ExportFormat = "srt" | "mp4" | "mov_alpha";

export type ExportJobStatus = "queued" | "rendering" | "ready" | "failed";

export interface ExportJobRow {
  id: string;
  project_id: string;
  revision_id: string;
  revision_number: number;
  user_id: string;
  format: ExportFormat;
  status: ExportJobStatus;
  stage_message: string | null;
  attempt_count: number;
  max_attempts: number;
  bucket_id: string;
  output_object_key: string | null;
  output_mime_type: string | null;
  output_filename: string | null;
  output_size_bytes: number | null;
  output_width: number | null;
  output_height: number | null;
  output_duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExportFormatDescriptor {
  id: ExportFormat;
  label: string;
  badge: string;
  extension: string;
  description: string;
}

export const EXPORT_FORMATS: ExportFormatDescriptor[] = [
  {
    id: "mp4",
    label: "MP4 to post",
    badge: "MP4 · H.264 / AAC",
    extension: ".mp4",
    description:
      "Ready-to-post video with your styled captions burned in and source audio preserved.",
  },
  {
    id: "srt",
    label: "SRT for subtitles",
    badge: "SRT · UTF-8",
    extension: ".srt",
    description:
      "UTF-8 subtitles with deterministic timestamps, multiline text, Unicode, and cue gaps.",
  },
  {
    id: "mov_alpha",
    label: "Transparent MOV for compositing",
    badge: "MOV · ProRes 4444 Alpha",
    extension: ".mov",
    description:
      "Captions only on a real alpha channel with transparent gaps and no audio for NLE timelines.",
  },
];

export function isExportFormat(value: unknown): value is ExportFormat {
  return value === "srt" || value === "mp4" || value === "mov_alpha";
}

/**
 * Formats integer milliseconds as exact SRT timestamp: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(ms: number): string {
  const clamped = Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0;
  const hours = Math.floor(clamped / 3_600_000);
  const mins = Math.floor((clamped % 3_600_000) / 60_000);
  const secs = Math.floor((clamped % 60_000) / 1_000);
  const millis = clamped % 1_000;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

/**
 * Normalizes cue text for SRT while preserving intentional multiline breaks
 * and full Unicode characters (never strips non-ASCII or collapses internal lines).
 */
function normalizeSrtCueText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""));

  // Trim blank lines only at the very start/end, keeping internal structure intact
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  // Prevent blank lines inside a single SRT cue block (which SRT parsers treat as block separators)
  return lines.filter((line) => line.trim().length > 0).join("\n");
}

/**
 * Generates deterministic UTF-8 SubRip (.srt) text from saved cues.
 * Preserves multiline text, Unicode, exact timestamps, and gaps between cues.
 */
export function generateSrtFromCues(cues: EditorCue[]): string {
  const ordered = [...cues]
    .filter((cue) => cue.end_ms > cue.start_ms && cue.text.trim().length > 0)
    .sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms);

  if (ordered.length === 0) {
    return "";
  }

  const blocks = ordered.map((cue, index) => {
    const start = formatSrtTimestamp(cue.start_ms);
    const end = formatSrtTimestamp(cue.end_ms);
    const body = normalizeSrtCueText(cue.text);
    return `${index + 1}\n${start} --> ${end}\n${body}`;
  });

  return `${blocks.join("\n\n")}\n`;
}

export function buildExportFilename(
  projectTitle: string,
  revisionNumber: number,
  format: ExportFormat
): string {
  const slug =
    projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "clipcaptions-export";

  if (format === "srt") {
    return `${slug}-rev${revisionNumber}.srt`;
  }
  if (format === "mp4") {
    return `${slug}-rev${revisionNumber}.mp4`;
  }
  return `${slug}-rev${revisionNumber}-alpha.mov`;
}
