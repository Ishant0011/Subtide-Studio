import fs from "fs";
import path from "path";
import os from "os";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

export type TranscriptionAdapterMode = "auto" | "deepgram" | "fixture";

export interface WorkerConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  workerId: string;
  leaseSeconds: number;
  pollIntervalMs: number;
  maxFfmpegRuntimeMs: number;
  maxRenderRuntimeMs: number;
  maxPreviewBytes: number;
  maxMp4ExportBytes: number;
  maxMovExportBytes: number;
  renderThreads: number;
  renderFontName: string;
  renderFontsDir: string | null;
  ffmpegPath: string;
  ffprobePath: string;
  transcriptionAdapter: TranscriptionAdapterMode;
  deepgramApiKey: string | null;
  once: boolean;
}

function loadEnvFileIfPresent(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function loadWorkerConfig(argv: string[] = process.argv.slice(2)): WorkerConfig {
  // Load root .env.local if running natively from repo root or worker/
  loadEnvFileIfPresent(path.resolve(process.cwd(), ".env.local"));
  loadEnvFileIfPresent(path.resolve(process.cwd(), "..", ".env.local"));

  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/+$/, "");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Worker requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const rawAdapter = (process.env.TRANSCRIPTION_ADAPTER || "auto").toLowerCase();
  const transcriptionAdapter: TranscriptionAdapterMode =
    rawAdapter === "deepgram" || rawAdapter === "fixture" ? rawAdapter : "auto";

  const deepgramApiKey = process.env.DEEPGRAM_API_KEY?.trim() || null;

  const ffmpegPath =
    process.env.FFMPEG_PATH?.trim() ||
    (typeof ffmpegStatic === "string" && ffmpegStatic ? ffmpegStatic : "ffmpeg");

  const ffprobePath =
    process.env.FFPROBE_PATH?.trim() ||
    (ffprobeStatic?.path ? ffprobeStatic.path : "ffprobe");

  const workerId =
    process.env.WORKER_ID?.trim() ||
    `worker-${os.hostname()}-${process.pid}`;

  const leaseSeconds = Math.max(
    15,
    Number.parseInt(process.env.WORKER_LEASE_SECONDS || "60", 10) || 60
  );
  const pollIntervalMs = Math.max(
    500,
    Number.parseInt(process.env.WORKER_POLL_INTERVAL_MS || "2000", 10) || 2000
  );
  const maxFfmpegRuntimeMs = Math.max(
    10_000,
    Number.parseInt(process.env.WORKER_MAX_FFMPEG_RUNTIME_MS || "120000", 10) || 120_000
  );
  const maxRenderRuntimeMs = Math.max(
    20_000,
    Number.parseInt(process.env.WORKER_MAX_RENDER_RUNTIME_MS || "240000", 10) || 240_000
  );
  const maxPreviewBytes = Math.max(
    5 * 1024 * 1024,
    Number.parseInt(process.env.WORKER_MAX_PREVIEW_BYTES || String(60 * 1024 * 1024), 10) ||
      60 * 1024 * 1024
  );
  const maxMp4ExportBytes = Math.max(
    10 * 1024 * 1024,
    Number.parseInt(process.env.WORKER_MAX_MP4_EXPORT_BYTES || String(150 * 1024 * 1024), 10) ||
      150 * 1024 * 1024
  );
  const maxMovExportBytes = Math.max(
    20 * 1024 * 1024,
    Number.parseInt(process.env.WORKER_MAX_MOV_EXPORT_BYTES || String(450 * 1024 * 1024), 10) ||
      450 * 1024 * 1024
  );
  const renderThreads = Math.max(
    1,
    Math.min(4, Number.parseInt(process.env.WORKER_RENDER_THREADS || "2", 10) || 2)
  );
  const renderFontName =
    process.env.WORKER_FONT_NAME?.trim() ||
    (process.platform === "win32" ? "Segoe UI" : "DejaVu Sans");
  const renderFontsDir = process.env.WORKER_FONTS_DIR?.trim() || null;

  return {
    supabaseUrl,
    serviceRoleKey,
    workerId,
    leaseSeconds,
    pollIntervalMs,
    maxFfmpegRuntimeMs,
    maxRenderRuntimeMs,
    maxPreviewBytes,
    maxMp4ExportBytes,
    maxMovExportBytes,
    renderThreads,
    renderFontName,
    renderFontsDir,
    ffmpegPath,
    ffprobePath,
    transcriptionAdapter,
    deepgramApiKey,
    once: argv.includes("--once"),
  };
}
