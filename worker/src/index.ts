import fs from "fs";
import os from "os";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadWorkerConfig, type WorkerConfig } from "./config";
import {
  WorkerError,
  extractTranscriptionAudio,
  generatePreview,
  probeMedia,
} from "./media";
import {
  RenderError,
  renderExportArtifact,
  type CaptionStyleConfig,
} from "./render";
import { transcribeAudio } from "./transcribe";

interface ClaimedIngestJob {
  jobId: string;
  projectId: string;
  mediaAssetId: string;
  userId: string;
  attemptCount: number;
  maxAttempts: number;
  attemptToken: string;
  bucketId: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  verifiedSizeBytes: number;
}

interface ClaimedExportJob {
  jobId: string;
  projectId: string;
  revisionId: string;
  revisionNumber: number;
  userId: string;
  format: "mp4" | "mov_alpha";
  attemptCount: number;
  maxAttempts: number;
  attemptToken: string;
  bucketId: string;
  projectTitle: string;
  mediaKind: "video" | "audio";
  durationMs: number | null;
  previewObjectKey: string | null;
  previewWidth: number | null;
  previewHeight: number | null;
  sourceObjectKey: string | null;
  sourceRotationDeg: number;
  style: Partial<CaptionStyleConfig> | null;
  cues: unknown;
}

function log(level: "info" | "warn" | "error", msg: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ?? {}),
  };
  console.log(JSON.stringify(entry));
}

function buildExportFilename(
  projectTitle: string,
  revisionNumber: number,
  format: "mp4" | "mov_alpha"
): string {
  const slug =
    projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "clipcaptions-export";

  return format === "mp4"
    ? `${slug}-rev${revisionNumber}.mp4`
    : `${slug}-rev${revisionNumber}-alpha.mov`;
}

async function processIngestJob(
  supabase: SupabaseClient,
  config: WorkerConfig,
  job: ClaimedIngestJob
): Promise<void> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `subtide-job-${job.jobId}-`));
  const abortController = new AbortController();
  let currentStage: "probing" | "transcoding" | "transcribing" = "probing";
  let currentMessage = "Probing uploaded media";
  let leaseLost = false;

  const renewLease = async (
    stage: "probing" | "transcoding" | "transcribing",
    message: string
  ): Promise<boolean> => {
    currentStage = stage;
    currentMessage = message;
    const { data, error } = await supabase.rpc("heartbeat_ingest_job", {
      p_job_id: job.jobId,
      p_attempt_token: job.attemptToken,
      p_status: stage,
      p_stage_message: message,
      p_lease_seconds: config.leaseSeconds,
    });
    if (error || data !== true) {
      leaseLost = true;
      abortController.abort();
      log("warn", "Lease lost or attempt superseded; aborting ingest job", {
        jobId: job.jobId,
        attemptToken: job.attemptToken,
      });
      return false;
    }
    return true;
  };

  const heartbeatIntervalMs = Math.max(5_000, Math.floor((config.leaseSeconds * 1000) / 3));
  const heartbeatTimer = setInterval(() => {
    void renewLease(currentStage, currentMessage);
  }, heartbeatIntervalMs);

  try {
    log("info", "Claimed ingest job", {
      jobId: job.jobId,
      projectId: job.projectId,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      originalFilename: job.originalFilename,
    });

    const { data: blob, error: downloadError } = await supabase.storage
      .from(job.bucketId)
      .download(job.objectKey);

    if (downloadError || !blob) {
      throw new WorkerError(
        "storage_error",
        `Failed to download source media: ${downloadError?.message || "missing blob"}`,
        true
      );
    }

    const ext = path.extname(job.objectKey) || ".bin";
    const inputPath = path.join(workDir, `source${ext}`);
    fs.writeFileSync(inputPath, Buffer.from(await blob.arrayBuffer()));

    const probe = await probeMedia(
      inputPath,
      config.ffprobePath,
      abortController.signal
    );

    if (leaseLost) return;

    if (process.env.WORKER_CRASH_AFTER_STAGE === "probing") {
      log("warn", "Simulating worker crash after probing stage", { jobId: job.jobId });
      process.exit(2);
    }

    const okTranscoding = await renewLease(
      "transcoding",
      probe.mediaKind === "video"
        ? "Generating browser preview"
        : "Normalizing audio preview"
    );
    if (!okTranscoding) return;

    const previewBase = path.join(workDir, "preview");
    const preview = await generatePreview(
      inputPath,
      previewBase,
      probe,
      config.ffmpegPath,
      config.ffprobePath,
      config.maxFfmpegRuntimeMs,
      config.maxPreviewBytes,
      abortController.signal
    );

    const previewObjectKey = `${job.userId}/${job.projectId}/preview-${job.mediaAssetId}.${preview.extension}`;
    const previewBuffer = fs.readFileSync(preview.outputPath);
    const { error: uploadPreviewError } = await supabase.storage
      .from(job.bucketId)
      .upload(previewObjectKey, previewBuffer, {
        contentType: preview.mimeType,
        upsert: true,
      });

    if (uploadPreviewError) {
      throw new WorkerError(
        "storage_error",
        `Failed to upload preview media: ${uploadPreviewError.message}`,
        true
      );
    }

    if (leaseLost) return;

    const okTranscribing = await renewLease(
      "transcribing",
      "Transcribing audio to word-level captions"
    );
    if (!okTranscribing) return;

    const wavPath = path.join(workDir, "audio-16k.wav");
    await extractTranscriptionAudio(
      inputPath,
      wavPath,
      probe,
      config.ffmpegPath,
      config.maxFfmpegRuntimeMs,
      abortController.signal
    );

    const transcript = await transcribeAudio({
      wavPath,
      durationMs: probe.durationMs,
      originalFilename: job.originalFilename,
      mode: config.transcriptionAdapter,
      deepgramApiKey: config.deepgramApiKey,
    });

    if (leaseLost) return;

    const { data: publishData, error: publishError } = await supabase.rpc(
      "publish_ingest_result",
      {
        p_job_id: job.jobId,
        p_attempt_token: job.attemptToken,
        p_media_kind: probe.mediaKind,
        p_duration_ms: probe.durationMs,
        p_width: probe.width,
        p_height: probe.height,
        p_rotation_deg: probe.rotationDeg,
        p_has_audio: probe.hasAudio,
        p_audio_start_offset_ms: probe.audioStartOffsetMs,
        p_video_start_offset_ms: probe.videoStartOffsetMs,
        p_preview_object_key: previewObjectKey,
        p_preview_mime_type: preview.mimeType,
        p_preview_width: preview.previewWidth,
        p_preview_height: preview.previewHeight,
        p_revision_source: transcript.source,
        p_speech_status: transcript.speechStatus,
        p_language: transcript.language,
        p_words: transcript.words,
        p_cues: transcript.cues,
      }
    );

    if (publishError) {
      throw new WorkerError(
        "internal_error",
        `Failed to publish ingest result: ${publishError.message}`,
        true
      );
    }

    log("info", "Completed ingest job", {
      jobId: job.jobId,
      projectId: job.projectId,
      publishData,
      mediaKind: probe.mediaKind,
      rotationDeg: probe.rotationDeg,
      speechStatus: transcript.speechStatus,
      source: transcript.source,
      wordCount: transcript.words.length,
      cueCount: transcript.cues.length,
    });
  } catch (err) {
    if (leaseLost) return;

    const workerErr =
      err instanceof WorkerError
        ? err
        : new WorkerError(
            "internal_error",
            err instanceof Error ? err.message : String(err),
            true
          );

    const backoffSeconds = Math.min(60, 2 ** job.attemptCount * 2);

    const { data: failData } = await supabase.rpc("fail_ingest_job", {
      p_job_id: job.jobId,
      p_attempt_token: job.attemptToken,
      p_error_code: workerErr.code,
      p_error_message: workerErr.message.slice(0, 500),
      p_retryable: workerErr.retryable,
      p_backoff_seconds: backoffSeconds,
    });

    log("warn", "Ingest job failed", {
      jobId: job.jobId,
      code: workerErr.code,
      retryable: workerErr.retryable,
      message: workerErr.message,
      failData,
    });
  } finally {
    clearInterval(heartbeatTimer);
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function processExportJob(
  supabase: SupabaseClient,
  config: WorkerConfig,
  job: ClaimedExportJob
): Promise<void> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `subtide-export-${job.jobId}-`));
  const abortController = new AbortController();
  const exportLeaseSeconds = Math.max(config.leaseSeconds, 90);
  let currentMessage =
    job.format === "mp4"
      ? "Rendering burned-in MP4"
      : "Rendering transparent ProRes 4444 MOV";
  let leaseLost = false;

  const renewLease = async (message: string): Promise<boolean> => {
    currentMessage = message;
    const { data, error } = await supabase.rpc("heartbeat_export_job", {
      p_job_id: job.jobId,
      p_attempt_token: job.attemptToken,
      p_stage_message: message,
      p_lease_seconds: exportLeaseSeconds,
    });
    if (error || data !== true) {
      leaseLost = true;
      abortController.abort();
      log("warn", "Export lease lost or attempt superseded; aborting render", {
        jobId: job.jobId,
        attemptToken: job.attemptToken,
      });
      return false;
    }
    return true;
  };

  const heartbeatIntervalMs = Math.max(5_000, Math.floor((exportLeaseSeconds * 1000) / 3));
  const heartbeatTimer = setInterval(() => {
    void renewLease(currentMessage);
  }, heartbeatIntervalMs);

  try {
    log("info", "Claimed export job", {
      jobId: job.jobId,
      projectId: job.projectId,
      revisionId: job.revisionId,
      revisionNumber: job.revisionNumber,
      format: job.format,
      mediaKind: job.mediaKind,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
    });

    // Prefer normalized upright zero-based preview media; fall back to original upload key
    const mediaKey = job.previewObjectKey || job.sourceObjectKey;
    const usedPreviewSource = Boolean(job.previewObjectKey);
    if (!mediaKey) {
      throw new RenderError(
        "corrupt_media",
        "Project media asset could not be located for export rendering.",
        false
      );
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(job.bucketId)
      .download(mediaKey);

    if (downloadError || !blob) {
      throw new RenderError(
        "storage_error",
        `Failed to download media for export: ${downloadError?.message || "missing blob"}`,
        true
      );
    }

    const ext = path.extname(mediaKey) || ".bin";
    const sourcePath = path.join(workDir, `source${ext}`);
    fs.writeFileSync(sourcePath, Buffer.from(await blob.arrayBuffer()));

    if (leaseLost) return;

    const maxOutputBytes =
      job.format === "mp4" ? config.maxMp4ExportBytes : config.maxMovExportBytes;

    const rendered = await renderExportArtifact({
      format: job.format,
      mediaKind: job.mediaKind,
      sourceMediaPath: sourcePath,
      usedPreviewSource,
      sourceRotationDeg: job.sourceRotationDeg || 0,
      durationMs: job.durationMs ?? 15_000,
      style: job.style,
      cues: job.cues,
      workDir,
      ffmpegPath: config.ffmpegPath,
      ffprobePath: config.ffprobePath,
      maxRuntimeMs: config.maxRenderRuntimeMs,
      maxOutputBytes,
      renderThreads: config.renderThreads,
      fontName: config.renderFontName,
      fontsDir: config.renderFontsDir,
      signal: abortController.signal,
    });

    if (leaseLost) return;

    const okUpload = await renewLease("Uploading completed export");
    if (!okUpload) return;

    // Upload only the complete, verified artifact under strict owner-only prefix
    const outputObjectKey = `${job.userId}/${job.projectId}/exports/${job.jobId}.${rendered.extension}`;
    const outputBuffer = fs.readFileSync(rendered.outputPath);
    const { error: uploadError } = await supabase.storage
      .from(job.bucketId)
      .upload(outputObjectKey, outputBuffer, {
        contentType: rendered.mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new RenderError(
        "storage_error",
        `Failed to upload rendered export: ${uploadError.message}`,
        true
      );
    }

    if (leaseLost) return;

    const outputFilename = buildExportFilename(
      job.projectTitle,
      job.revisionNumber,
      job.format
    );

    const { data: publishData, error: publishError } = await supabase.rpc(
      "publish_export_result",
      {
        p_job_id: job.jobId,
        p_attempt_token: job.attemptToken,
        p_output_object_key: outputObjectKey,
        p_output_mime_type: rendered.mimeType,
        p_output_filename: outputFilename,
        p_output_size_bytes: rendered.sizeBytes,
        p_output_width: rendered.width,
        p_output_height: rendered.height,
        p_output_duration_ms: rendered.durationMs,
      }
    );

    if (publishError) {
      throw new RenderError(
        "internal_error",
        `Failed to publish export result: ${publishError.message}`,
        true
      );
    }

    log("info", "Completed export job", {
      jobId: job.jobId,
      projectId: job.projectId,
      revisionNumber: job.revisionNumber,
      format: job.format,
      width: rendered.width,
      height: rendered.height,
      sizeBytes: rendered.sizeBytes,
      publishData,
    });
  } catch (err) {
    if (leaseLost) return;

    const renderErr =
      err instanceof RenderError
        ? err
        : new RenderError(
            "render_failed",
            err instanceof Error ? err.message : String(err),
            true
          );

    const backoffSeconds = Math.min(60, 2 ** job.attemptCount * 2);

    const { data: failData } = await supabase.rpc("fail_export_job", {
      p_job_id: job.jobId,
      p_attempt_token: job.attemptToken,
      p_error_code: renderErr.code,
      p_error_message: renderErr.message.slice(0, 500),
      p_retryable: renderErr.retryable,
      p_backoff_seconds: backoffSeconds,
    });

    log("warn", "Export job failed", {
      jobId: job.jobId,
      format: job.format,
      code: renderErr.code,
      retryable: renderErr.retryable,
      message: renderErr.message,
      failData,
    });
  } finally {
    clearInterval(heartbeatTimer);
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const config = loadWorkerConfig();
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let stopping = false;
  const onStop = () => {
    stopping = true;
    log("info", "Shutdown signal received; finishing current job if any.");
  };
  process.on("SIGINT", onStop);
  process.on("SIGTERM", onStop);

  log("info", "ClipCaptions worker started", {
    workerId: config.workerId,
    adapter: config.transcriptionAdapter,
    hasDeepgramKey: Boolean(config.deepgramApiKey),
    leaseSeconds: config.leaseSeconds,
    renderThreads: config.renderThreads,
    renderFontName: config.renderFontName,
    once: config.once,
  });

  while (!stopping) {
    // 1. Check for runnable ingest jobs first
    const { data: ingestData, error: ingestError } = await supabase.rpc(
      "claim_next_ingest_job",
      {
        p_worker_id: config.workerId,
        p_lease_seconds: config.leaseSeconds,
      }
    );

    if (ingestError) {
      log("error", "Error claiming next ingest job", { error: ingestError.message });
      if (config.once) process.exit(1);
      await new Promise((r) => setTimeout(r, config.pollIntervalMs));
      continue;
    }

    if (ingestData) {
      await processIngestJob(supabase, config, ingestData as ClaimedIngestJob);
      if (config.once) break;
      continue;
    }

    // 2. Check for runnable video export jobs (mp4 / mov_alpha)
    const { data: exportData, error: exportError } = await supabase.rpc(
      "claim_next_export_job",
      {
        p_worker_id: config.workerId,
        p_lease_seconds: Math.max(config.leaseSeconds, 90),
      }
    );

    if (exportError) {
      log("error", "Error claiming next export job", { error: exportError.message });
      if (config.once) process.exit(1);
      await new Promise((r) => setTimeout(r, config.pollIntervalMs));
      continue;
    }

    if (exportData) {
      await processExportJob(supabase, config, exportData as ClaimedExportJob);
      if (config.once) break;
      continue;
    }

    if (config.once) {
      log("info", "No runnable ingest or export jobs found (--once exiting)");
      break;
    }

    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
  }
}

main().catch((err) => {
  log("error", "Worker fatal error", {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
