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
import { transcribeAudio } from "./transcribe";

interface ClaimedJob {
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

function log(level: "info" | "warn" | "error", msg: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ?? {}),
  };
  console.log(JSON.stringify(entry));
}

async function processJob(
  supabase: SupabaseClient,
  config: WorkerConfig,
  job: ClaimedJob
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
      log("warn", "Lease lost or attempt superseded; aborting job", {
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

    // 1. Download source bytes from private storage bucket
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

    // 2. Probe actual media bytes
    const probe = await probeMedia(
      inputPath,
      config.ffprobePath,
      abortController.signal
    );

    if (leaseLost) return;

    // Optional test hook for simulating a crashed worker mid-job
    if (process.env.WORKER_CRASH_AFTER_STAGE === "probing") {
      log("warn", "Simulating worker crash after probing stage", { jobId: job.jobId });
      process.exit(2);
    }

    // 3. Transcode browser preview on zero-based clock (with upright rotation)
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

    // 4. Extract zero-based transcription audio accounting for A/V start offsets
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

    // 5. Publish metadata, preview key, and first caption revision atomically (attempt-token guarded)
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

  log("info", "Subtide Studio worker started", {
    workerId: config.workerId,
    adapter: config.transcriptionAdapter,
    hasDeepgramKey: Boolean(config.deepgramApiKey),
    leaseSeconds: config.leaseSeconds,
    once: config.once,
  });

  while (!stopping) {
    const { data, error } = await supabase.rpc("claim_next_ingest_job", {
      p_worker_id: config.workerId,
      p_lease_seconds: config.leaseSeconds,
    });

    if (error) {
      log("error", "Error claiming next ingest job", { error: error.message });
      if (config.once) process.exit(1);
      await new Promise((r) => setTimeout(r, config.pollIntervalMs));
      continue;
    }

    if (!data) {
      if (config.once) {
        log("info", "No runnable jobs found (--once exiting)");
        break;
      }
      await new Promise((r) => setTimeout(r, config.pollIntervalMs));
      continue;
    }

    await processJob(supabase, config, data as ClaimedJob);

    if (config.once) {
      break;
    }
  }
}

main().catch((err) => {
  log("error", "Worker fatal error", {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
