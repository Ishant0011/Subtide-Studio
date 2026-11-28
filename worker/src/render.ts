import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { buildMinimalToolEnv } from "./security";

export type RenderErrorCode =
  | "corrupt_media"
  | "bounds_exceeded"
  | "render_failed"
  | "storage_error"
  | "internal_error";

export class RenderError extends Error {
  constructor(
    public readonly code: RenderErrorCode,
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "RenderError";
  }
}

export type CaptionPresetId = "clean" | "boxed" | "word-highlight";
export type CaptionFontSize = "sm" | "md" | "lg";
export type CaptionAccentId = "violet" | "mint";
export type CaptionFontId = "poppins" | "bebas-neue" | "space-mono" | "dm-serif";
export type CaptionCasing = "original" | "uppercase" | "lowercase";
export type CaptionShadowStrength = "none" | "soft" | "strong";
export type CaptionEmphasisMode =
  | "pill"
  | "color"
  | "underline"
  | "scale"
  | "cue";
export type CaptionAlignment = "center" | "left";
export type CaptionLetterSpacing = "tight" | "normal" | "wide";

export interface CaptionStyleConfig {
  preset: CaptionPresetId;
  fontSize: CaptionFontSize;
  verticalPosition: number;
  accent?: CaptionAccentId;
  fontFamily?: CaptionFontId;
  textColor?: string;
  activeWordColor?: string;
  casing?: CaptionCasing;
  outlineWidth?: number;
  outlineColor?: string;
  backgroundEnabled?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  shadowStrength?: CaptionShadowStrength;
  emphasisMode?: CaptionEmphasisMode;
  alignment?: CaptionAlignment;
  letterSpacing?: CaptionLetterSpacing;
  italic?: boolean;
}

export interface RenderCaptionWord {
  id: string;
  text: string;
  start_ms: number;
  end_ms: number;
  confidence?: number | null;
}

export interface RenderCaptionCue {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  words: RenderCaptionWord[];
  timing_mode: "word" | "cue";
}

export interface ExportRenderInput {
  format: "mp4" | "mov_alpha";
  mediaKind: "video" | "audio";
  sourceMediaPath: string;
  usedPreviewSource: boolean;
  sourceRotationDeg: number;
  durationMs: number;
  style: Partial<CaptionStyleConfig> | null | undefined;
  cues: unknown;
  workDir: string;
  ffmpegPath: string;
  ffprobePath: string;
  maxRuntimeMs: number;
  maxOutputBytes: number;
  renderThreads: number;
  fontName: string;
  fontsDir: string | null;
  signal?: AbortSignal;
}

export interface ExportRenderResult {
  outputPath: string;
  extension: "mp4" | "mov";
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationMs: number;
}

// Shared layout constants matching src/lib/caption-editor.ts
const DEFAULT_STYLE: CaptionStyleConfig = {
  preset: "word-highlight",
  fontSize: "md",
  verticalPosition: 14,
  accent: "violet",
  fontFamily: "poppins",
  textColor: "#F5F1E8",
  activeWordColor: "#A78BFA",
  casing: "uppercase",
  outlineWidth: 0,
  outlineColor: "#070B10",
  backgroundEnabled: true,
  backgroundColor: "#070B10",
  backgroundOpacity: 60,
  shadowStrength: "soft",
};

const FONT_ASS_MAP: Record<CaptionFontId, string> = {
  poppins: "Poppins",
  "bebas-neue": "Bebas Neue",
  "space-mono": "Space Mono",
  "dm-serif": "DM Serif Display",
};

const ACCENT_PALETTE: Record<
  CaptionAccentId,
  { hex: string; assBgr: string }
> = {
  violet: { hex: "#A78BFA", assBgr: "FA8BA7" },
  mint: { hex: "#49E6B3", assBgr: "B3E649" },
};

const MIN_VERTICAL_POSITION = 8;
const MAX_VERTICAL_POSITION = 85;
const MAX_LONG_EDGE = 1280;
const AUDIO_STAGE_WIDTH = 720;
const AUDIO_STAGE_HEIGHT = 1280;
const OUTPUT_FPS = 30;

const FONT_SIZE_TABLE: Record<CaptionFontSize, { renderPx1080: number }> = {
  sm: { renderPx1080: 44 },
  md: { renderPx1080: 54 },
  lg: { renderPx1080: 66 },
};

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value === "string" && HEX_COLOR_RE.test(value.trim())) {
    return value.trim().toUpperCase();
  }
  return fallback.toUpperCase();
}

function hexToAssBgr(hex: string): string {
  const clean = normalizeHex(hex, "#A78BFA").slice(1);
  return `${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}`;
}

function opacityPctToAssAlphaHex(opacityPct: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(opacityPct)));
  // ASS alpha is inverted: 00 = opaque, FF = fully transparent
  const alphaByte = Math.round(((100 - clamped) / 100) * 255);
  return alphaByte.toString(16).toUpperCase().padStart(2, "0");
}

function contrastingInkAssBgr(hex: string): string {
  const clean = normalizeHex(hex, "#A78BFA").slice(1);
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? "100B07" : "E8F1F5";
}

function computeLayout(style: Partial<CaptionStyleConfig> | null | undefined) {
  const preset: CaptionPresetId =
    style?.preset === "clean" ||
    style?.preset === "boxed" ||
    style?.preset === "word-highlight"
      ? style.preset
      : DEFAULT_STYLE.preset;

  const fontSize: CaptionFontSize =
    style?.fontSize === "sm" ||
    style?.fontSize === "md" ||
    style?.fontSize === "lg"
      ? style.fontSize
      : DEFAULT_STYLE.fontSize;

  const rawPos =
    typeof style?.verticalPosition === "number" &&
    Number.isFinite(style.verticalPosition)
      ? Math.round(style.verticalPosition)
      : DEFAULT_STYLE.verticalPosition;

  const bottomPercent = Math.max(
    MIN_VERTICAL_POSITION,
    Math.min(MAX_VERTICAL_POSITION, rawPos)
  );

  const accent: CaptionAccentId = style?.accent === "mint" ? "mint" : "violet";
  const accentColor = ACCENT_PALETTE[accent];

  const fontFamily: CaptionFontId =
    style?.fontFamily && style.fontFamily in FONT_ASS_MAP
      ? style.fontFamily
      : "poppins";

  const textColorHex = normalizeHex(style?.textColor, "#F5F1E8");
  const activeWordHex = normalizeHex(style?.activeWordColor, accentColor.hex);

  const casing: CaptionCasing =
    style?.casing === "original" ||
    style?.casing === "uppercase" ||
    style?.casing === "lowercase"
      ? style.casing
      : preset === "word-highlight"
        ? "uppercase"
        : "original";

  const outlineWidth =
    typeof style?.outlineWidth === "number" && Number.isFinite(style.outlineWidth)
      ? Math.max(0, Math.min(6, Math.round(style.outlineWidth)))
      : preset === "clean"
        ? 2
        : 0;
  const outlineColorHex = normalizeHex(style?.outlineColor, "#070B10");

  const backgroundEnabled =
    typeof style?.backgroundEnabled === "boolean"
      ? style.backgroundEnabled
      : preset !== "clean";
  const backgroundColorHex = normalizeHex(style?.backgroundColor, "#070B10");
  const backgroundOpacity =
    typeof style?.backgroundOpacity === "number" &&
    Number.isFinite(style.backgroundOpacity)
      ? Math.max(0, Math.min(100, Math.round(style.backgroundOpacity)))
      : preset === "boxed"
        ? 82
        : preset === "word-highlight"
          ? 60
          : 0;

  const shadowStrength: CaptionShadowStrength =
    style?.shadowStrength === "none" ||
    style?.shadowStrength === "soft" ||
    style?.shadowStrength === "strong"
      ? style.shadowStrength
      : preset === "clean"
        ? "strong"
        : "soft";

  const defaultEmphasis: CaptionEmphasisMode =
    preset === "word-highlight"
      ? "pill"
      : preset === "boxed"
        ? "underline"
        : "color";
  const emphasisMode: CaptionEmphasisMode =
    style?.emphasisMode === "pill" ||
    style?.emphasisMode === "color" ||
    style?.emphasisMode === "underline" ||
    style?.emphasisMode === "scale" ||
    style?.emphasisMode === "cue"
      ? style.emphasisMode
      : defaultEmphasis;

  const alignment: CaptionAlignment =
    style?.alignment === "left" ? "left" : "center";

  const letterSpacing: CaptionLetterSpacing =
    style?.letterSpacing === "tight" ||
    style?.letterSpacing === "normal" ||
    style?.letterSpacing === "wide"
      ? style.letterSpacing
      : "normal";

  const assSpacing =
    letterSpacing === "tight"
      ? -0.5
      : letterSpacing === "wide"
        ? 2.2
        : preset === "word-highlight"
          ? 0.4
          : 0;

  const assItalic = style?.italic ? -1 : 0;

  return {
    preset,
    fontSize,
    renderFontSizePx1080: FONT_SIZE_TABLE[fontSize].renderPx1080,
    bottomPercent,
    maxWidthPercent:
      alignment === "left" ? 88 : preset === "word-highlight" ? 94 : 90,
    accent,
    accentHex: activeWordHex,
    accentAssBgr: hexToAssBgr(activeWordHex),
    activeInkAssBgr: contrastingInkAssBgr(activeWordHex),
    textAssBgr: hexToAssBgr(textColorHex),
    assFontFamily: FONT_ASS_MAP[fontFamily],
    casing,
    outlineWidth,
    outlineAssBgr: hexToAssBgr(outlineColorHex),
    backgroundEnabled,
    bgAssBgr: hexToAssBgr(backgroundColorHex),
    bgAssAlpha: backgroundEnabled
      ? opacityPctToAssAlphaHex(backgroundOpacity)
      : "FF",
    bgDimAssAlpha: backgroundEnabled
      ? opacityPctToAssAlphaHex(Math.round(backgroundOpacity * 0.72))
      : "FF",
    shadowDepth:
      shadowStrength === "strong" ? 3 : shadowStrength === "soft" ? 1.5 : 0,
    emphasisMode,
    assAlignment: alignment === "left" ? 1 : 2,
    assSpacing,
    assItalic,
  };
}

function hydrateCues(rawCues: unknown): RenderCaptionCue[] {
  if (!Array.isArray(rawCues)) return [];
  return rawCues
    .map((raw, idx) => {
      const c = raw as Partial<RenderCaptionCue>;
      const words = Array.isArray(c.words) ? c.words : [];
      const timingMode: "word" | "cue" =
        c.timing_mode === "cue"
          ? "cue"
          : words.length > 0
            ? "word"
            : "cue";
      return {
        id: typeof c.id === "string" && c.id ? c.id : `cue-${idx + 1}`,
        start_ms: typeof c.start_ms === "number" ? Math.round(c.start_ms) : 0,
        end_ms: typeof c.end_ms === "number" ? Math.round(c.end_ms) : 0,
        text: typeof c.text === "string" ? c.text : "",
        words,
        timing_mode: timingMode,
      };
    })
    .filter((c) => c.end_ms > c.start_ms && c.text.trim().length > 0)
    .sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms);
}

/**
 * Exact mirror of findActiveEditorWord in src/lib/caption-editor.ts so
 * highlighted word changes match the browser preview within 1 output frame.
 */
function findActiveWord(
  cue: RenderCaptionCue,
  timeMs: number
): RenderCaptionWord | null {
  if (cue.timing_mode !== "word" || cue.words.length === 0) {
    return null;
  }
  for (const w of cue.words) {
    if (timeMs >= w.start_ms && timeMs < w.end_ms) {
      return w;
    }
  }
  const last = cue.words[cue.words.length - 1];
  if (last && timeMs >= last.start_ms && timeMs <= last.end_ms) {
    return last;
  }
  return null;
}

function formatAssTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const centisTotal = Math.round(safe / 10);
  const cs = centisTotal % 100;
  const secsTotal = Math.floor(centisTotal / 100);
  const secs = secsTotal % 60;
  const minsTotal = Math.floor(secsTotal / 60);
  const mins = minsTotal % 60;
  const hours = Math.floor(minsTotal / 60);
  return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "\\N");
}

/**
 * Computes which word indices start a new line based on explicit line breaks in cue.text.
 */
function detectWordLineBreaks(cueText: string, wordCount: number): Set<number> {
  const breakBefore = new Set<number>();
  const normalized = cueText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized.includes("\n")) return breakBefore;

  const lines = normalized.split("\n");
  let tokenIdx = 0;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineTokens = lines[lineIdx].trim().split(/\s+/).filter(Boolean);
    if (lineIdx > 0 && lineTokens.length > 0 && tokenIdx < wordCount) {
      breakBefore.add(tokenIdx);
    }
    tokenIdx += lineTokens.length;
  }
  return breakBefore;
}

type ComputedRenderLayout = ReturnType<typeof computeLayout>;

function formatStyledCueRun(
  cue: RenderCaptionCue,
  layout: ComputedRenderLayout,
  activeWord: RenderCaptionWord | null,
  sampleTimeMs: number
): string {
  const {
    preset,
    emphasisMode,
    accentAssBgr,
    activeInkAssBgr,
    textAssBgr,
    bgAssBgr,
    bgAssAlpha,
    bgDimAssAlpha,
    casing,
  } = layout;
  const useWordTiming =
    cue.timing_mode === "word" &&
    cue.words.length > 0 &&
    emphasisMode !== "cue";
  const transform = (s: string) =>
    casing === "uppercase"
      ? s.toUpperCase()
      : casing === "lowercase"
        ? s.toLowerCase()
        : s;

  if (!useWordTiming) {
    const escaped = escapeAssText(transform(cue.text.trim()));
    if (emphasisMode === "cue") {
      return `{\\c&H${textAssBgr}&\\1a&H00&}${escaped}`;
    }
    if (preset === "word-highlight" || emphasisMode === "pill") {
      return `{\\c&H${activeInkAssBgr}&\\1a&H00&\\3c&H${accentAssBgr}&\\3a&H00&}${escaped}`;
    }
    return `{\\c&H${accentAssBgr}&\\1a&H00&}${escaped}`;
  }

  const lineBreaks = detectWordLineBreaks(cue.text, cue.words.length);
  const isPillMode = preset === "word-highlight" || emphasisMode === "pill";
  const parts: string[] = [];

  for (let i = 0; i < cue.words.length; i++) {
    const w = cue.words[i];
    const isActive = activeWord?.id === w.id;
    const isPast = sampleTimeMs >= w.end_ms;
    const wordText = escapeAssText(transform(w.text));

    if (i > 0) {
      if (lineBreaks.has(i)) {
        parts.push("\\N");
      } else if (isPillMode) {
        parts.push("{\\3a&HFF&} ");
      } else {
        parts.push(" ");
      }
    }

    if (isPillMode) {
      if (isActive) {
        parts.push(
          `{\\c&H${activeInkAssBgr}&\\1a&H00&\\3c&H${accentAssBgr}&\\3a&H00&}${wordText}`
        );
      } else if (isPast) {
        parts.push(
          `{\\c&H${textAssBgr}&\\1a&H00&\\3c&H${bgAssBgr}&\\3a&H${bgAssAlpha}&}${wordText}`
        );
      } else {
        parts.push(
          `{\\c&H${textAssBgr}&\\1a&H40&\\3c&H${bgAssBgr}&\\3a&H${bgDimAssAlpha}&}${wordText}`
        );
      }
    } else if (emphasisMode === "underline") {
      if (isActive) {
        parts.push(`{\\c&H${accentAssBgr}&\\1a&H00&\\u1}${wordText}`);
      } else if (isPast) {
        parts.push(`{\\c&H${textAssBgr}&\\1a&H00&\\u0}${wordText}`);
      } else {
        parts.push(`{\\c&H${textAssBgr}&\\1a&H42&\\u0}${wordText}`);
      }
    } else if (emphasisMode === "scale") {
      if (isActive) {
        parts.push(
          `{\\c&H${accentAssBgr}&\\1a&H00&\\fscx110\\fscy110}${wordText}`
        );
      } else if (isPast) {
        parts.push(
          `{\\c&H${textAssBgr}&\\1a&H00&\\fscx100\\fscy100}${wordText}`
        );
      } else {
        parts.push(
          `{\\c&H${textAssBgr}&\\1a&H33&\\fscx100\\fscy100}${wordText}`
        );
      }
    } else {
      // emphasisMode === "color"
      if (isActive) {
        parts.push(`{\\c&H${accentAssBgr}&\\1a&H00&}${wordText}`);
      } else if (isPast) {
        parts.push(`{\\c&H${textAssBgr}&\\1a&H00&}${wordText}`);
      } else {
        parts.push(`{\\c&H${textAssBgr}&\\1a&H38&}${wordText}`);
      }
    }
  }

  return parts.join("");
}

export function buildAssScript(params: {
  width: number;
  height: number;
  style: Partial<CaptionStyleConfig> | null | undefined;
  cues: unknown;
  fontName: string;
}): string {
  const { width, height, fontName } = params;
  const layout = computeLayout(params.style);
  const cues = hydrateCues(params.cues);

  const resolvedFontName = layout.assFontFamily || fontName;
  const refWidth = width > height ? Math.round(height * 0.85) : width;
  const fontSize = Math.max(
    24,
    Math.round(layout.renderFontSizePx1080 * (refWidth / 1080))
  );
  const marginV = Math.max(16, Math.round(height * (layout.bottomPercent / 100)));
  const marginH = Math.max(
    24,
    Math.round(width * ((100 - layout.maxWidthPercent) / 200))
  );

  let styleLine: string;
  const scaledOutline = Number(
    (layout.outlineWidth * (refWidth / 1080) * 1.4).toFixed(1)
  );
  const isPillMode =
    layout.preset === "word-highlight" || layout.emphasisMode === "pill";

  if (isPillMode) {
    styleLine = `Style: Caption,${resolvedFontName},${fontSize},&H00${layout.textAssBgr},&H00${layout.accentAssBgr},&H${layout.bgAssAlpha}${layout.bgAssBgr},&H${layout.bgAssAlpha}${layout.bgAssBgr},-1,${layout.assItalic},0,0,100,100,${layout.assSpacing},0,3,8,${layout.shadowDepth},${layout.assAlignment},${marginH},${marginH},${marginV},1`;
  } else if (layout.preset === "boxed") {
    const borderStyle = layout.backgroundEnabled ? 3 : 1;
    const outlineCol = layout.backgroundEnabled
      ? `&H${layout.bgAssAlpha}${layout.bgAssBgr}`
      : `&H10${layout.outlineAssBgr}`;
    const outlinePx = layout.backgroundEnabled ? 14 : scaledOutline;
    styleLine = `Style: Caption,${resolvedFontName},${fontSize},&H00${layout.textAssBgr},&H00${layout.accentAssBgr},${outlineCol},&H${layout.bgAssAlpha}${layout.bgAssBgr},-1,${layout.assItalic},0,0,100,100,${layout.assSpacing},0,${borderStyle},${outlinePx},${layout.shadowDepth},${layout.assAlignment},${marginH},${marginH},${marginV},1`;
  } else {
    const borderStyle = layout.backgroundEnabled ? 3 : 1;
    const outlineCol = layout.backgroundEnabled
      ? `&H${layout.bgAssAlpha}${layout.bgAssBgr}`
      : `&H10${layout.outlineAssBgr}`;
    const outlinePx = layout.backgroundEnabled
      ? 10
      : Math.max(0.5, scaledOutline || 2);
    styleLine = `Style: Caption,${resolvedFontName},${fontSize},&H00${layout.textAssBgr},&H00${layout.accentAssBgr},${outlineCol},&H66100B07,-1,${layout.assItalic},0,0,100,100,${layout.assSpacing},0,${borderStyle},${outlinePx},${layout.shadowDepth},${layout.assAlignment},${marginH},${marginH},${marginV},1`;
  }

  const events: string[] = [];

  for (const cue of cues) {
    const useWordTiming =
      cue.timing_mode === "word" &&
      cue.words.length > 0 &&
      layout.emphasisMode !== "cue";
    if (!useWordTiming) {
      const startStr = formatAssTime(cue.start_ms);
      const endStr = formatAssTime(cue.end_ms);
      if (startStr !== endStr) {
        const text = formatStyledCueRun(cue, layout, null, cue.start_ms);
        events.push(`Dialogue: 0,${startStr},${endStr},Caption,,0,0,0,,${text}`);
      }
      continue;
    }

    // Collect exact sorted timing boundaries within [cue.start_ms, cue.end_ms]
    const boundarySet = new Set<number>([cue.start_ms, cue.end_ms]);
    for (const w of cue.words) {
      const ws = Math.max(cue.start_ms, Math.min(cue.end_ms, w.start_ms));
      const we = Math.max(cue.start_ms, Math.min(cue.end_ms, w.end_ms));
      boundarySet.add(ws);
      boundarySet.add(we);
    }
    const boundaries = Array.from(boundarySet).sort((a, b) => a - b);

    for (let i = 0; i < boundaries.length - 1; i++) {
      const t0 = boundaries[i];
      const t1 = boundaries[i + 1];
      if (t1 <= t0) continue;

      const startStr = formatAssTime(t0);
      const endStr = formatAssTime(t1);
      if (startStr === endStr) continue;

      const sampleMid = Math.floor((t0 + t1) / 2);
      const activeWord = findActiveWord(cue, sampleMid);
      const text = formatStyledCueRun(
        cue,
        layout,
        activeWord,
        sampleMid
      );
      events.push(`Dialogue: 0,${startStr},${endStr},Caption,,0,0,0,,${text}`);
    }
  }

  return [
    "[Script Info]",
    "Title: ClipCaptions Export",
    "ScriptType: v4.00+",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    styleLine,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
    "",
  ].join("\n");
}

function runProcess(
  binary: string,
  args: string[],
  timeoutMs: number,
  cwd: string,
  signal?: AbortSignal
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: buildMinimalToolEnv(),
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
      if (err) reject(err);
      else resolve({ stdout, stderr });
    };

    const killChild = () => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    };

    const onAbort = () => {
      killChild();
      finish(
        new RenderError(
          "internal_error",
          "Render aborted because worker lease was lost.",
          false
        )
      );
    };

    if (signal) {
      if (signal.aborted) {
        killChild();
        finish(
          new RenderError(
            "internal_error",
            "Render aborted because worker lease was lost.",
            false
          )
        );
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    const timer = setTimeout(() => {
      killChild();
      finish(
        new RenderError(
          "bounds_exceeded",
          `Render exceeded runtime limit of ${Math.round(timeoutMs / 1000)}s.`,
          false
        )
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", () => {
      finish(
        new RenderError(
          "internal_error",
          "Render tool failed to start.",
          true
        )
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        finish();
      } else {
        finish(
          new RenderError(
            "render_failed",
            `Render process exited with status ${code}.`,
            false
          )
        );
      }
    });
  });
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  pix_fmt?: string;
  width?: number;
  height?: number;
  sample_aspect_ratio?: string;
  duration?: string;
  disposition?: { attached_pic?: number };
}

interface ProbeJson {
  streams?: ProbeStream[];
  format?: { duration?: string };
}

async function probeFile(
  filePath: string,
  ffprobePath: string,
  cwd: string,
  signal?: AbortSignal
): Promise<ProbeJson> {
  const { stdout } = await runProcess(
    ffprobePath,
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ],
    20_000,
    cwd,
    signal
  );
  return JSON.parse(stdout) as ProbeJson;
}

function makeEven(n: number): number {
  const rounded = Math.max(2, Math.round(n));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

function computeDisplayCanvas(
  rawWidth: number,
  rawHeight: number,
  sarStr: string | undefined,
  rotationDeg: number
): { width: number; height: number } {
  let sarNum = 1;
  let sarDen = 1;
  if (sarStr && sarStr.includes(":")) {
    const [a, b] = sarStr.split(":").map((v) => Number.parseFloat(v));
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      sarNum = a;
      sarDen = b;
    }
  }

  let dispW = Math.round(rawWidth * (sarNum / sarDen));
  let dispH = rawHeight;

  if (rotationDeg === 90 || rotationDeg === 270) {
    const tmp = dispW;
    dispW = dispH;
    dispH = tmp;
  }

  // Bound long edge while preserving display aspect ratio
  const longEdge = Math.max(dispW, dispH);
  if (longEdge > MAX_LONG_EDGE) {
    const scale = MAX_LONG_EDGE / longEdge;
    dispW = Math.round(dispW * scale);
    dispH = Math.round(dispH * scale);
  }

  return {
    width: makeEven(dispW),
    height: makeEven(dispH),
  };
}

function buildAssFilterExpr(
  assFilename: string,
  alpha: boolean,
  fontsDir: string | null
): string {
  const opts = [`filename=${assFilename}`];
  if (alpha) opts.push("alpha=1");
  if (fontsDir) {
    const escapedDir = fontsDir.replace(/\\/g, "/").replace(/:/g, "\\:");
    opts.push(`fontsdir='${escapedDir}'`);
  }
  return `ass=${opts.join(":")}`;
}

export async function renderExportArtifact(
  input: ExportRenderInput
): Promise<ExportRenderResult> {
  const {
    format,
    mediaKind,
    sourceMediaPath,
    usedPreviewSource,
    sourceRotationDeg,
    workDir,
    ffmpegPath,
    ffprobePath,
    maxRuntimeMs,
    maxOutputBytes,
    renderThreads,
    fontName,
    fontsDir,
    signal,
  } = input;

  // 1. Probe source media to determine exact duration and display aspect ratio
  const sourceProbe = await probeFile(sourceMediaPath, ffprobePath, workDir, signal);
  const streams = Array.isArray(sourceProbe.streams) ? sourceProbe.streams : [];
  const videoStream = streams.find(
    (s) => s.codec_type === "video" && !s.disposition?.attached_pic
  );
  const audioStream = streams.find((s) => s.codec_type === "audio");

  const probedDurationSec = [
    sourceProbe.format?.duration,
    videoStream?.duration,
    audioStream?.duration,
  ]
    .map((v) => (v ? Number.parseFloat(v) : NaN))
    .find((n) => Number.isFinite(n) && n > 0);

  const durationMs =
    probedDurationSec && probedDurationSec > 0
      ? Math.round(probedDurationSec * 1000)
      : Math.max(500, Math.round(input.durationMs || 5000));
  const durationSecStr = (durationMs / 1000).toFixed(3);

  let outWidth = AUDIO_STAGE_WIDTH;
  let outHeight = AUDIO_STAGE_HEIGHT;
  let applyRotationDeg = 0;

  if (mediaKind === "video" && videoStream?.width && videoStream?.height) {
    applyRotationDeg = usedPreviewSource ? 0 : sourceRotationDeg;
    const canvas = computeDisplayCanvas(
      videoStream.width,
      videoStream.height,
      videoStream.sample_aspect_ratio,
      applyRotationDeg
    );
    outWidth = canvas.width;
    outHeight = canvas.height;
  }

  // 2. Write ASS subtitle script aligned to exact output resolution & editor layout
  const assFilename = "captions.ass";
  const assPath = path.join(workDir, assFilename);
  const assScript = buildAssScript({
    width: outWidth,
    height: outHeight,
    style: input.style,
    cues: input.cues,
    fontName,
  });
  fs.writeFileSync(assPath, assScript, "utf8");

  // 3. Render target format
  if (format === "mov_alpha") {
    const outputFilename = "export-alpha.mov";
    const outputPath = path.join(workDir, outputFilename);
    const assFilter = buildAssFilterExpr(assFilename, true, fontsDir);

    const args = [
      "-y",
      "-threads",
      String(renderThreads),
      "-f",
      "lavfi",
      "-i",
      `color=c=black@0.0:s=${outWidth}x${outHeight}:r=${OUTPUT_FPS}:d=${durationSecStr},format=rgba`,
      "-vf",
      `${assFilter},format=yuva444p10le`,
      "-an",
      "-t",
      durationSecStr,
      "-c:v",
      "prores_ks",
      "-profile:v",
      "4",
      "-pix_fmt",
      "yuva444p10le",
      "-alpha_bits",
      "16",
      "-vendor",
      "apl0",
      "-movflags",
      "+faststart",
      outputFilename,
    ];

    await runProcess(ffmpegPath, args, maxRuntimeMs, workDir, signal);

    const sizeBytes = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
    if (sizeBytes <= 0 || sizeBytes > maxOutputBytes) {
      throw new RenderError(
        "bounds_exceeded",
        `Rendered MOV size (${sizeBytes} bytes) is outside allowed bounds.`,
        false
      );
    }

    // Verify rendered MOV has real alpha ProRes video stream and NO audio stream
    const outProbe = await probeFile(outputPath, ffprobePath, workDir, signal);
    const outStreams = Array.isArray(outProbe.streams) ? outProbe.streams : [];
    const outVideo = outStreams.find((s) => s.codec_type === "video");
    const outAudio = outStreams.find((s) => s.codec_type === "audio");
    if (!outVideo || outVideo.codec_name !== "prores" || outAudio) {
      throw new RenderError(
        "render_failed",
        "Rendered MOV failed stream verification (expected ProRes 4444 alpha video with no audio).",
        false
      );
    }

    return {
      outputPath,
      extension: "mov",
      mimeType: "video/quicktime",
      sizeBytes,
      width: outVideo.width ?? outWidth,
      height: outVideo.height ?? outHeight,
      durationMs,
    };
  }

  // format === "mp4" (H.264/AAC burned-in video with source audio preserved)
  const outputFilename = "export.mp4";
  const outputPath = path.join(workDir, outputFilename);
  const assFilter = buildAssFilterExpr(assFilename, false, fontsDir);

  let args: string[];
  if (mediaKind === "audio") {
    // 9:16 deep-ink portrait stage matching the editor's audio stage + burned-in captions + source audio
    const audioLayout = computeLayout(input.style);
    const accentY = Math.round(outHeight * 0.12);
    const stageVf = [
      `drawbox=x=0:y=0:w=${outWidth}:h=${Math.round(outHeight * 0.42)}:color=#181529@0.85:t=fill`,
      `drawbox=x=0:y=${Math.round(outHeight * 0.42)}:w=${outWidth}:h=${Math.round(outHeight * 0.3)}:color=#10121A@0.9:t=fill`,
      `drawbox=x=${Math.round(outWidth * 0.08)}:y=${accentY}:w=${Math.round(outWidth * 0.84)}:h=4:color=${audioLayout.accentHex}@0.88:t=fill`,
      assFilter,
      "format=yuv420p",
    ].join(",");

    args = [
      "-y",
      "-threads",
      String(renderThreads),
      "-f",
      "lavfi",
      "-i",
      `color=c=#070B10:s=${outWidth}x${outHeight}:r=${OUTPUT_FPS}:d=${durationSecStr}`,
      "-i",
      sourceMediaPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-vf",
      stageVf,
      "-af",
      "asetpts=PTS-STARTPTS",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-shortest",
      "-movflags",
      "+faststart",
      outputFilename,
    ];
  } else {
    const rotateFilter =
      applyRotationDeg === 90
        ? "transpose=1,"
        : applyRotationDeg === 180
          ? "transpose=1,transpose=1,"
          : applyRotationDeg === 270
            ? "transpose=2,"
            : "";

    const vf = `${rotateFilter}scale=${outWidth}:${outHeight},setsar=1,fps=${OUTPUT_FPS},setpts=PTS-STARTPTS,${assFilter},format=yuv420p`;

    args = [
      "-y",
      "-protocol_whitelist",
      "file,pipe",
      "-threads",
      String(renderThreads),
      ...(usedPreviewSource ? [] : ["-noautorotate"]),
      "-i",
      sourceMediaPath,
      "-map",
      "0:v:0",
      ...(audioStream ? ["-map", "0:a:0"] : []),
      "-vf",
      vf,
      ...(audioStream ? ["-af", "asetpts=PTS-STARTPTS"] : []),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-pix_fmt",
      "yuv420p",
      ...(audioStream
        ? ["-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2"]
        : ["-an"]),
      "-metadata:s:v:0",
      "rotate=0",
      "-avoid_negative_ts",
      "make_zero",
      "-movflags",
      "+faststart",
      outputFilename,
    ];
  }

  await runProcess(ffmpegPath, args, maxRuntimeMs, workDir, signal);

  const sizeBytes = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
  if (sizeBytes <= 0 || sizeBytes > maxOutputBytes) {
    throw new RenderError(
      "bounds_exceeded",
      `Rendered MP4 size (${sizeBytes} bytes) is outside allowed bounds.`,
      false
    );
  }

  const outProbe = await probeFile(outputPath, ffprobePath, workDir, signal);
  const outStreams = Array.isArray(outProbe.streams) ? outProbe.streams : [];
  const outVideo = outStreams.find((s) => s.codec_type === "video");
  if (!outVideo || outVideo.codec_name !== "h264") {
    throw new RenderError(
      "render_failed",
      "Rendered MP4 failed stream verification (expected H.264 video).",
      false
    );
  }

  return {
    outputPath,
    extension: "mp4",
    mimeType: "video/mp4",
    sizeBytes,
    width: outVideo.width ?? outWidth,
    height: outVideo.height ?? outHeight,
    durationMs,
  };
}
