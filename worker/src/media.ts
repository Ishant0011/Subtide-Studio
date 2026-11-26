import { spawn } from "child_process";
import fs from "fs";
import { buildMinimalToolEnv } from "./security";

export type WorkerErrorCode =
  | "corrupt_media"
  | "missing_audio"
  | "duration_limit_exceeded"
  | "bounds_exceeded"
  | "provider_failure"
  | "storage_error"
  | "internal_error";

export class WorkerError extends Error {
  constructor(
    public readonly code: WorkerErrorCode,
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "WorkerError";
  }
}

export const MAX_DURATION_MS = 180_000; // 3 minutes
export const MAX_STREAMS = 8;
export const MAX_DIMENSION = 4096;
export const MAX_PIXELS = 4096 * 2160;

export interface MediaProbeResult {
  mediaKind: "video" | "audio";
  durationMs: number;
  width: number | null;
  height: number | null;
  rotationDeg: number;
  hasAudio: boolean;
  audioStartOffsetMs: number;
  videoStartOffsetMs: number;
}

export interface PreviewResult {
  outputPath: string;
  mimeType: string;
  extension: "mp4" | "mp3";
  sizeBytes: number;
  previewWidth: number | null;
  previewHeight: number | null;
}

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
  start_time?: string;
  disposition?: { attached_pic?: number };
  tags?: { rotate?: string };
  side_data_list?: Array<{ side_data_type?: string; rotation?: number }>;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
    start_time?: string;
  };
}

function runBinary(
  binary: string,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
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
      finish(new WorkerError("internal_error", "Processing aborted due to lost lease.", false));
    };

    if (signal) {
      if (signal.aborted) {
        killChild();
        finish(new WorkerError("internal_error", "Processing aborted due to lost lease.", false));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    const timer = setTimeout(() => {
      killChild();
      finish(
        new WorkerError(
          "bounds_exceeded",
          `Media processing exceeded runtime limit of ${Math.round(timeoutMs / 1000)}s.`,
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
      finish(new WorkerError("internal_error", "Media processing binary failed to start.", true));
    });
    child.on("close", (code) => {
      if (code === 0) {
        finish();
      } else {
        finish(new Error(`Media tool exited with status ${code}`));
      }
    });
  });
}

function extractRotationDegrees(stream: FfprobeStream): number {
  let raw = 0;
  if (stream.tags?.rotate) {
    const parsed = Number.parseFloat(stream.tags.rotate);
    if (Number.isFinite(parsed)) raw = parsed;
  } else if (Array.isArray(stream.side_data_list)) {
    for (const sd of stream.side_data_list) {
      if (typeof sd.rotation === "number" && Number.isFinite(sd.rotation)) {
        // FFprobe displaymatrix rotation is counter-clockwise; normalize to positive CW degrees
        raw = -sd.rotation;
        break;
      }
    }
  }
  const normalized = ((Math.round(raw) % 360) + 360) % 360;
  return normalized;
}

function parseStartMs(value?: string): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) : 0;
}

export async function probeMedia(
  inputPath: string,
  ffprobePath: string,
  signal?: AbortSignal
): Promise<MediaProbeResult> {
  let raw: FfprobeOutput;
  try {
    const { stdout } = await runBinary(
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
        inputPath,
      ],
      20_000,
      signal
    );
    raw = JSON.parse(stdout) as FfprobeOutput;
  } catch (err) {
    if (err instanceof WorkerError) throw err;
    throw new WorkerError(
      "corrupt_media",
      "Uploaded file could not be probed as valid media.",
      false
    );
  }

  const streams = Array.isArray(raw.streams) ? raw.streams : [];
  if (streams.length === 0) {
    throw new WorkerError(
      "corrupt_media",
      "Media file contains no readable audio or video streams.",
      false
    );
  }

  if (streams.length > MAX_STREAMS) {
    throw new WorkerError(
      "bounds_exceeded",
      `Media file contains ${streams.length} streams (max ${MAX_STREAMS}).`,
      false
    );
  }

  const videoStream = streams.find(
    (s) => s.codec_type === "video" && !s.disposition?.attached_pic
  );
  const audioStream = streams.find((s) => s.codec_type === "audio");

  const durationCandidates = [
    raw.format?.duration,
    videoStream?.duration,
    audioStream?.duration,
  ]
    .map((v) => (v ? Number.parseFloat(v) : NaN))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (durationCandidates.length === 0) {
    throw new WorkerError(
      "corrupt_media",
      "Media duration could not be determined.",
      false
    );
  }

  const durationMs = Math.round(Math.max(...durationCandidates) * 1000);
  if (durationMs > MAX_DURATION_MS) {
    throw new WorkerError(
      "duration_limit_exceeded",
      `Clip is ${(durationMs / 1000).toFixed(1)}s long, exceeding the 3-minute (180s) processing limit.`,
      false
    );
  }

  if (videoStream) {
    const width = Number(videoStream.width || 0);
    const height = Number(videoStream.height || 0);
    if (width <= 0 || height <= 0) {
      throw new WorkerError("corrupt_media", "Video stream has invalid dimensions.", false);
    }
    if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
      throw new WorkerError(
        "bounds_exceeded",
        `Video dimensions ${width}x${height} exceed maximum allowed bounds (4096x2160).`,
        false
      );
    }

    if (!audioStream) {
      throw new WorkerError(
        "missing_audio",
        "Video clip does not contain an audio track to transcribe.",
        false
      );
    }

    const rotationDeg = extractRotationDegrees(videoStream);
    return {
      mediaKind: "video",
      durationMs,
      width,
      height,
      rotationDeg,
      hasAudio: true,
      audioStartOffsetMs: parseStartMs(audioStream.start_time ?? raw.format?.start_time),
      videoStartOffsetMs: parseStartMs(videoStream.start_time ?? raw.format?.start_time),
    };
  }

  if (!audioStream) {
    throw new WorkerError(
      "corrupt_media",
      "File does not contain a supported video or audio stream.",
      false
    );
  }

  return {
    mediaKind: "audio",
    durationMs,
    width: null,
    height: null,
    rotationDeg: 0,
    hasAudio: true,
    audioStartOffsetMs: parseStartMs(audioStream.start_time ?? raw.format?.start_time),
    videoStartOffsetMs: 0,
  };
}

export async function generatePreview(
  inputPath: string,
  outputBasePath: string,
  probe: MediaProbeResult,
  ffmpegPath: string,
  ffprobePath: string,
  maxRuntimeMs: number,
  maxPreviewBytes: number,
  signal?: AbortSignal
): Promise<PreviewResult> {
  if (probe.mediaKind === "video") {
    const outputPath = `${outputBasePath}.mp4`;
    // Apply explicit rotation from probed displaymatrix / rotate tag with -noautorotate
    // so both iPhone displaymatrix and legacy rotate-tag clips bake upright cleanly.
    const rotateFilter =
      probe.rotationDeg === 90
        ? "transpose=1,"
        : probe.rotationDeg === 180
          ? "transpose=1,transpose=1,"
          : probe.rotationDeg === 270
            ? "transpose=2,"
            : "";

    const vf = `${rotateFilter}scale='if(gte(iw,ih),min(1280,iw),-2)':'if(gte(iw,ih),-2,min(1280,ih))',scale=trunc(iw/2)*2:trunc(ih/2)*2,setpts=PTS-STARTPTS`;

    const args = [
      "-y",
      "-protocol_whitelist",
      "file,pipe",
      "-noautorotate",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0",
      "-vf",
      vf,
      "-af",
      "asetpts=PTS-STARTPTS",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "24",
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
      "-metadata:s:v:0",
      "rotate=0",
      "-avoid_negative_ts",
      "make_zero",
      "-movflags",
      "+faststart",
      outputPath,
    ];

    try {
      await runBinary(ffmpegPath, args, maxRuntimeMs, signal);
    } catch (err) {
      if (err instanceof WorkerError) throw err;
      throw new WorkerError(
        "corrupt_media",
        "Failed to transcode video preview.",
        false
      );
    }

    const sizeBytes = fs.statSync(outputPath).size;
    if (sizeBytes <= 0 || sizeBytes > maxPreviewBytes) {
      throw new WorkerError(
        "bounds_exceeded",
        `Generated preview size (${sizeBytes} bytes) exceeds allowed output bound.`,
        false
      );
    }

    const previewProbe = await probeMedia(outputPath, ffprobePath, signal);
    return {
      outputPath,
      mimeType: "video/mp4",
      extension: "mp4",
      sizeBytes,
      previewWidth: previewProbe.width,
      previewHeight: previewProbe.height,
    };
  }

  // Audio-only clip (MP3 / WAV) -> normalized zero-based MP3 preview
  const outputPath = `${outputBasePath}.mp3`;
  const args = [
    "-y",
    "-protocol_whitelist",
    "file,pipe",
    "-i",
    inputPath,
    "-vn",
    "-map",
    "0:a:0",
    "-af",
    "asetpts=PTS-STARTPTS",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-ac",
    "2",
    outputPath,
  ];

  try {
    await runBinary(ffmpegPath, args, maxRuntimeMs, signal);
  } catch (err) {
    if (err instanceof WorkerError) throw err;
    throw new WorkerError(
      "corrupt_media",
      "Failed to normalize audio preview.",
      false
    );
  }

  const sizeBytes = fs.statSync(outputPath).size;
  if (sizeBytes <= 0 || sizeBytes > maxPreviewBytes) {
    throw new WorkerError(
      "bounds_exceeded",
      `Generated audio preview size (${sizeBytes} bytes) exceeds allowed output bound.`,
      false
    );
  }

  return {
    outputPath,
    mimeType: "audio/mpeg",
    extension: "mp3",
    sizeBytes,
    previewWidth: null,
    previewHeight: null,
  };
}

/**
 * Extracts 16kHz mono PCM WAV audio aligned to the zero-based preview clock,
 * compensating for any difference between audio and video start timestamps.
 */
export async function extractTranscriptionAudio(
  inputPath: string,
  outputWavPath: string,
  probe: MediaProbeResult,
  ffmpegPath: string,
  maxRuntimeMs: number,
  signal?: AbortSignal
): Promise<void> {
  const deltaMs =
    probe.mediaKind === "video"
      ? probe.audioStartOffsetMs - probe.videoStartOffsetMs
      : 0;

  let audioFilter = "asetpts=PTS-STARTPTS";
  if (deltaMs > 10) {
    // Audio starts after video frame 0: prepend exact silence so word timestamps align to video t=0
    audioFilter = `adelay=${deltaMs}:all=1,asetpts=PTS-STARTPTS`;
  } else if (deltaMs < -10) {
    // Audio starts before video frame 0: trim leading audio before video t=0
    const trimSec = (Math.abs(deltaMs) / 1000).toFixed(3);
    audioFilter = `atrim=start=${trimSec},asetpts=PTS-STARTPTS`;
  }

  const args = [
    "-y",
    "-protocol_whitelist",
    "file,pipe",
    "-i",
    inputPath,
    "-vn",
    "-map",
    "0:a:0",
    "-af",
    audioFilter,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputWavPath,
  ];

  try {
    await runBinary(ffmpegPath, args, maxRuntimeMs, signal);
  } catch (err) {
    if (err instanceof WorkerError) throw err;
    throw new WorkerError(
      "corrupt_media",
      "Failed to extract audio for transcription.",
      false
    );
  }
}
