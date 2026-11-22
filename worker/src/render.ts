import { spawn } from "child_process";
import fs from "fs";
import path from "path";

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

export interface CaptionStyleConfig {
  preset: CaptionPresetId;
  fontSize: CaptionFontSize;
  verticalPosition: number;
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

  return {
    preset,
    fontSize,
    renderFontSizePx1080: FONT_SIZE_TABLE[fontSize].renderPx1080,
    bottomPercent,
    maxWidthPercent: preset === "word-highlight" ? 94 : 90,
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

function formatStyledCueRun(
  cue: RenderCaptionCue,
  preset: CaptionPresetId,
  activeWord: RenderCaptionWord | null,
  sampleTimeMs: number
): string {
  const useWordTiming = cue.timing_mode === "word" && cue.words.length > 0;
  const transform = (s: string) =>
    preset === "word-highlight" ? s.toUpperCase() : s;

  // Deep ink #070B10 -> 100B07, Warm white #F5F1E8 -> E8F1F5, Mint #49E6B3 -> B3E649
  if (!useWordTiming) {
    const escaped = escapeAssText(transform(cue.text.trim()));
    if (preset === "word-highlight") {
      return `{\\c&H100B07&\\1a&H00&\\3c&HB3E649&\\3a&H00&}${escaped}`;
    }
    return `{\\c&HB3E649&\\1a&H00&}${escaped}`;
  }

  const lineBreaks = detectWordLineBreaks(cue.text, cue.words.length);
  const parts: string[] = [];

  for (let i = 0; i < cue.words.length; i++) {
    const w = cue.words[i];
    const isActive = activeWord?.id === w.id;
    const isPast = sampleTimeMs >= w.end_ms;
    const wordText = escapeAssText(transform(w.text));

    if (i > 0) {
      if (lineBreaks.has(i)) {
        parts.push("\\N");
      } else if (preset === "word-highlight") {
        // Transparent separator space so per-word pills stay crisp without seam overlap
        parts.push("{\\3a&HFF&} ");
      } else {
        parts.push(" ");
      }
    }

    if (preset === "clean") {
      if (isActive) {
        parts.push(`{\\c&HB3E649&\\1a&H00&\\fscx104\\fscy104}${wordText}`);
      } else if (isPast) {
        parts.push(`{\\c&HE8F1F5&\\1a&H00&\\fscx100\\fscy100}${wordText}`);
      } else {
        parts.push(`{\\c&HE8F1F5&\\1a&H33&\\fscx100\\fscy100}${wordText}`);
      }
    } else if (preset === "boxed") {
      if (isActive) {
        parts.push(`{\\c&HB3E649&\\1a&H00&\\u1}${wordText}`);
      } else if (isPast) {
        parts.push(`{\\c&HE8F1F5&\\1a&H00&\\u0}${wordText}`);
      } else {
        parts.push(`{\\c&HE8F1F5&\\1a&H45&\\u0}${wordText}`);
      }
    } else {
      // word-highlight: kinetic mint pill with dark ink text vs translucent ink pills
      if (isActive) {
        parts.push(`{\\c&H100B07&\\1a&H00&\\3c&HB3E649&\\3a&H00&}${wordText}`);
      } else if (isPast) {
        parts.push(`{\\c&HE8F1F5&\\1a&H00&\\3c&H100B07&\\3a&H73&}${wordText}`);
      } else {
        parts.push(`{\\c&HE8F1F5&\\1a&H40&\\3c&H100B07&\\3a&H99&}${wordText}`);
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

  // Match editor proportion across portrait, square, and landscape canvases
  const refWidth = width > height ? Math.round(height * 0.85) : width;
  const fontSize = Math.max(
    24,
    Math.round(layout.renderFontSizePx1080 * (refWidth / 1080))
  );
  const marginV = Math.max(16, Math.round(height * (layout.bottomPercent / 100)));
  const marginH = Math.max(
    18,
    Math.round(width * ((100 - layout.maxWidthPercent) / 200))
  );

  // Style definition tailored to preset
  let styleLine: string;
  if (layout.preset === "clean") {
    styleLine = `Style: Caption,${fontName},${fontSize},&H00E8F1F5,&H00B3E649,&H10100B07,&H66100B07,-1,0,0,0,100,100,0,0,1,2.5,2,2,${marginH},${marginH},${marginV},1`;
  } else if (layout.preset === "boxed") {
    styleLine = `Style: Caption,${fontName},${fontSize},&H00E8F1F5,&H00B3E649,&H2E100B07,&H2E100B07,-1,0,0,0,100,100,0,0,3,14,0,2,${marginH},${marginH},${marginV},1`;
  } else {
    styleLine = `Style: Caption,${fontName},${fontSize},&H00E8F1F5,&H00B3E649,&H73100B07,&H73100B07,-1,0,0,0,100,100,0.4,0,3,8,0,2,${marginH},${marginH},${marginV},1`;
  }

  const events: string[] = [];

  for (const cue of cues) {
    const useWordTiming = cue.timing_mode === "word" && cue.words.length > 0;
    if (!useWordTiming) {
      const startStr = formatAssTime(cue.start_ms);
      const endStr = formatAssTime(cue.end_ms);
      if (startStr !== endStr) {
        const text = formatStyledCueRun(cue, layout.preset, null, cue.start_ms);
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
      const text = formatStyledCueRun(cue, layout.preset, activeWord, sampleMid);
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
    child.on("error", (err) => {
      finish(
        new RenderError(
          "internal_error",
          `Failed to spawn ${binary}: ${err.message}`,
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
            `${path.basename(binary)} exited with code ${code}: ${stderr.slice(-400)}`,
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
    const accentY = Math.round(outHeight * 0.12);
    const stageVf = [
      `drawbox=x=0:y=0:w=${outWidth}:h=${Math.round(outHeight * 0.42)}:color=#112635@0.75:t=fill`,
      `drawbox=x=0:y=${Math.round(outHeight * 0.42)}:w=${outWidth}:h=${Math.round(outHeight * 0.3)}:color=#0B1722@0.85:t=fill`,
      `drawbox=x=${Math.round(outWidth * 0.08)}:y=${accentY}:w=${Math.round(outWidth * 0.84)}:h=4:color=#49E6B3@0.85:t=fill`,
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
