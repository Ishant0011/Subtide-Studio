import type { EditorCue } from "@/lib/caption-editor";

export type ExportFormat = "srt" | "mp4" | "mov_alpha";

export type ExportResolutionTier =
  | "original"
  | "240p"
  | "360p"
  | "480p"
  | "720p"
  | "1080p"
  | "1440p"
  | "2160p";

export type ExportJobStatus = "queued" | "rendering" | "ready" | "failed";

export interface ExportJobRow {
  id: string;
  project_id: string;
  revision_id: string;
  revision_number: number;
  user_id: string;
  format: ExportFormat;
  resolution_tier?: ExportResolutionTier | null;
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

export interface ExportResolutionOption {
  tier: ExportResolutionTier;
  label: string;
  shortLabel: string;
  targetShortEdge: number | null;
  width: number;
  height: number;
  enabled: boolean;
  disabledReason: string | null;
}

export const STANDARD_RESOLUTION_TIERS: Array<{
  tier: Exclude<ExportResolutionTier, "original">;
  label: string;
  shortLabel: string;
  shortEdgePx: number;
}> = [
  { tier: "240p", label: "240p", shortLabel: "240p", shortEdgePx: 240 },
  { tier: "360p", label: "360p", shortLabel: "360p", shortEdgePx: 360 },
  { tier: "480p", label: "480p", shortLabel: "480p", shortEdgePx: 480 },
  { tier: "720p", label: "720p", shortLabel: "720p", shortEdgePx: 720 },
  { tier: "1080p", label: "1080p", shortLabel: "1080p", shortEdgePx: 1080 },
  { tier: "1440p", label: "1440p", shortLabel: "1440p", shortEdgePx: 1440 },
  { tier: "2160p", label: "2160p (4K)", shortLabel: "4K", shortEdgePx: 2160 },
];

export const MAX_EXPORT_DIMENSION = 4096;
export const MAX_EXPORT_PIXELS = 4096 * 2160;
export const AUDIO_STAGE_MAX_SHORT_EDGE = 1080;

export function isExportFormat(value: unknown): value is ExportFormat {
  return value === "srt" || value === "mp4" || value === "mov_alpha";
}

export function isExportResolutionTier(
  value: unknown
): value is ExportResolutionTier {
  return (
    value === "original" ||
    value === "240p" ||
    value === "360p" ||
    value === "480p" ||
    value === "720p" ||
    value === "1080p" ||
    value === "1440p" ||
    value === "2160p"
  );
}

export function formatResolutionTierLabel(
  tier: ExportResolutionTier | string | null | undefined
): string {
  if (!tier) return "1080p";
  if (tier === "original") return "Original size";
  if (tier === "2160p") return "2160p (4K)";
  return tier;
}

export function makeEvenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

/**
 * Computes upright display dimensions from probed source width/height/rotation.
 */
export function computeDisplaySourceDimensions(params: {
  mediaKind: "video" | "audio";
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  sourceRotationDeg?: number | null;
}): { width: number; height: number } {
  if (params.mediaKind === "audio") {
    return { width: 1080, height: 1920 };
  }

  const rawW =
    typeof params.sourceWidth === "number" && params.sourceWidth > 0
      ? params.sourceWidth
      : 1080;
  const rawH =
    typeof params.sourceHeight === "number" && params.sourceHeight > 0
      ? params.sourceHeight
      : 1920;

  const rot = (((Math.round(params.sourceRotationDeg ?? 0) % 360) + 360) % 360);
  if (rot === 90 || rot === 270) {
    return { width: makeEvenDimension(rawH), height: makeEvenDimension(rawW) };
  }
  return { width: makeEvenDimension(rawW), height: makeEvenDimension(rawH) };
}

function scaleForShortEdge(
  srcWidth: number,
  srcHeight: number,
  targetShortEdge: number
): { width: number; height: number } {
  const isPortrait = srcHeight >= srcWidth;
  if (isPortrait) {
    const scale = targetShortEdge / srcWidth;
    return {
      width: makeEvenDimension(targetShortEdge),
      height: makeEvenDimension(srcHeight * scale),
    };
  }
  const scale = targetShortEdge / srcHeight;
  return {
    width: makeEvenDimension(srcWidth * scale),
    height: makeEvenDimension(targetShortEdge),
  };
}

/**
 * Returns the full ordered list of MP4 resolution choices for a project,
 * with actual computed output dimensions and clear disabled reasons for
 * tiers above source resolution or worker safety bounds.
 */
export function getResolutionOptionsForSource(params: {
  mediaKind: "video" | "audio";
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  sourceRotationDeg?: number | null;
}): ExportResolutionOption[] {
  const display = computeDisplaySourceDimensions(params);
  const srcShort = Math.min(display.width, display.height);
  const options: ExportResolutionOption[] = [];

  if (params.mediaKind === "video" && srcShort < 240) {
    options.push({
      tier: "original",
      label: "Original size",
      shortLabel: "Original",
      targetShortEdge: srcShort,
      width: display.width,
      height: display.height,
      enabled: true,
      disabledReason: null,
    });
  }

  for (const spec of STANDARD_RESOLUTION_TIERS) {
    const dims = scaleForShortEdge(
      display.width,
      display.height,
      spec.shortEdgePx
    );

    if (params.mediaKind === "audio") {
      const enabled = spec.shortEdgePx <= AUDIO_STAGE_MAX_SHORT_EDGE;
      options.push({
        tier: spec.tier,
        label: spec.label,
        shortLabel: spec.shortLabel,
        targetShortEdge: spec.shortEdgePx,
        width: dims.width,
        height: dims.height,
        enabled,
        disabledReason: enabled ? null : "Audio stage supports up to 1080p",
      });
      continue;
    }

    if (spec.shortEdgePx > srcShort) {
      options.push({
        tier: spec.tier,
        label: spec.label,
        shortLabel: spec.shortLabel,
        targetShortEdge: spec.shortEdgePx,
        width: dims.width,
        height: dims.height,
        enabled: false,
        disabledReason: `Above source (${display.width}×${display.height})`,
      });
      continue;
    }

    if (
      dims.width > MAX_EXPORT_DIMENSION ||
      dims.height > MAX_EXPORT_DIMENSION ||
      dims.width * dims.height > MAX_EXPORT_PIXELS
    ) {
      options.push({
        tier: spec.tier,
        label: spec.label,
        shortLabel: spec.shortLabel,
        targetShortEdge: spec.shortEdgePx,
        width: dims.width,
        height: dims.height,
        enabled: false,
        disabledReason: "Exceeds max 4K frame bounds",
      });
      continue;
    }

    options.push({
      tier: spec.tier,
      label: spec.label,
      shortLabel: spec.shortLabel,
      targetShortEdge: spec.shortEdgePx,
      width: dims.width,
      height: dims.height,
      enabled: true,
      disabledReason: null,
    });
  }

  return options;
}

/**
 * Selects 1080p by default when eligible; otherwise chooses the highest
 * eligible tier below 1080p (or "original" for < 240p sources).
 */
export function getDefaultResolutionTier(
  options: ExportResolutionOption[]
): ExportResolutionTier {
  const tier1080 = options.find((o) => o.tier === "1080p" && o.enabled);
  if (tier1080) return "1080p";

  const below1080 = options.filter(
    (o) =>
      o.enabled &&
      (o.targetShortEdge === null || o.targetShortEdge < 1080)
  );
  if (below1080.length > 0) {
    return below1080[below1080.length - 1].tier;
  }

  const firstEnabled = options.find((o) => o.enabled);
  return firstEnabled?.tier ?? "1080p";
}

export function validateResolutionTierForSource(params: {
  tier: unknown;
  mediaKind: "video" | "audio";
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  sourceRotationDeg?: number | null;
}):
  | { ok: true; option: ExportResolutionOption }
  | { ok: false; error: string } {
  if (!isExportResolutionTier(params.tier)) {
    return {
      ok: false,
      error:
        "Choose a valid MP4 resolution tier (240p, 360p, 480p, 720p, 1080p, 1440p, 2160p, or original).",
    };
  }

  const options = getResolutionOptionsForSource(params);
  const match = options.find((o) => o.tier === params.tier);
  if (!match) {
    return {
      ok: false,
      error: "Selected resolution tier is not available for this clip.",
    };
  }
  if (!match.enabled) {
    return {
      ok: false,
      error:
        match.disabledReason ||
        `${match.label} is not supported for this clip's source resolution.`,
    };
  }
  return { ok: true, option: match };
}

/**
 * Formats integer milliseconds as exact SRT timestamp: HH:MM:SS,mmm
 * (Kept for backward-compatible utilities.)
 */
export function formatSrtTimestamp(ms: number): string {
  const clamped = Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0;
  const hours = Math.floor(clamped / 3_600_000);
  const mins = Math.floor((clamped % 3_600_000) / 60_000);
  const secs = Math.floor((clamped % 60_000) / 1_000);
  const millis = clamped % 1_000;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function normalizeSrtCueText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""));

  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  return lines.filter((line) => line.trim().length > 0).join("\n");
}

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
  format: ExportFormat,
  resolutionTier?: ExportResolutionTier | null
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
    const tierSuffix = resolutionTier ? `-${resolutionTier}` : "";
    return `${slug}-rev${revisionNumber}${tierSuffix}.mp4`;
  }
  return `${slug}-rev${revisionNumber}-alpha.mov`;
}
