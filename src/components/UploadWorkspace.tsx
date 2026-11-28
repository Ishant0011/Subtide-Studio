"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as tus from "tus-js-client";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileVideo,
  FolderKanban,
  Loader2,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import {
  MAX_DURATION_MINUTES,
  MAX_UPLOAD_BYTES,
  TUS_CHUNK_SIZE_BYTES,
  deriveProjectTitle,
  formatBytes,
  validateUploadFile,
  type ProjectWithMedia,
  type UploadCompleteResponse,
  type UploadInitResponse,
} from "@/lib/uploads";

type UploadPhase =
  | "idle"
  | "initializing"
  | "uploading"
  | "paused"
  | "finalizing"
  | "completed"
  | "error";

export function UploadWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tusUploadRef = useRef<tus.Upload | null>(null);
  const initMetaRef = useRef<UploadInitResponse | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<UploadCompleteResponse | null>(null);
  const [liveProject, setLiveProject] = useState<ProjectWithMedia | null>(null);

  // Poll real worker processing stages right after upload completes so Open editor appears immediately
  useEffect(() => {
    if (phase !== "completed" || !completed?.project.id) return;
    if (liveProject?.status === "ready" || liveProject?.status === "failed") return;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const projectId = completed.project.id;

    const poll = async () => {
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.projects)) {
            const found = (data.projects as ProjectWithMedia[]).find(
              (p) => p.id === projectId
            );
            if (found) {
              setLiveProject(found);
              if (found.status === "ready" || found.status === "failed") {
                return;
              }
            }
          }
        }
      } catch {
        // retry next tick
      }
      if (!cancelled) {
        timerId = setTimeout(poll, 2000);
      }
    };

    timerId = setTimeout(poll, 1200);
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [phase, completed, liveProject?.status]);

  // Abort in-flight TUS upload if component unmounts
  useEffect(() => {
    return () => {
      if (tusUploadRef.current) {
        void tusUploadRef.current.abort();
      }
    };
  }, []);

  const handleFilePicked = useCallback((file: File | null) => {
    setError(null);
    setCompleted(null);
    setLiveProject(null);
    setPhase("idle");
    setBytesUploaded(0);
    setBytesTotal(0);
    tusUploadRef.current = null;
    initMetaRef.current = null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const check = validateUploadFile({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    if (!check.ok) {
      setSelectedFile(null);
      setError(check.error);
      return;
    }

    setSelectedFile(file);
    setBytesTotal(file.size);
    setTitle((prev) => (prev.trim() ? prev : deriveProjectTitle(file.name)));
  }, []);

  const finalizeUpload = useCallback(async (initMeta: UploadInitResponse) => {
    setPhase("finalizing");
    setError(null);

    const res = await fetch("/api/uploads/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: initMeta.projectId,
        assetId: initMeta.assetId,
        objectKey: initMeta.objectKey,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Upload completion verification failed.");
    }

    setCompleted(data as UploadCompleteResponse);
    setPhase("completed");
  }, []);

  const createAndStartTus = useCallback(
    async (file: File, initMeta: UploadInitResponse) => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const { anonKey } = getSupabasePublicEnv();
      const upload = new tus.Upload(file, {
        endpoint: initMeta.tusEndpoint,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: TUS_CHUNK_SIZE_BYTES,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${session.access_token}`,
          "x-upsert": "false",
        },
        metadata: {
          bucketName: initMeta.bucket,
          objectName: initMeta.objectKey,
          contentType: initMeta.mimeType,
          cacheControl: "3600",
        },
        onError(err) {
          setError(err.message || "Upload interrupted. Click Resume or Retry.");
          setPhase("error");
        },
        onProgress(uploaded, total) {
          setBytesUploaded(uploaded);
          setBytesTotal(total);
        },
        onSuccess() {
          setBytesUploaded(file.size);
          setBytesTotal(file.size);
          void finalizeUpload(initMeta).catch((err) => {
            setError(
              err instanceof Error
                ? err.message
                : "Upload stored, but final verification failed."
            );
            setPhase("error");
          });
        },
      });

      tusUploadRef.current = upload;

      // Resume from any matching interrupted upload if available
      const previousUploads = await upload.findPreviousUploads();
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      setPhase("uploading");
      upload.start();
    },
    [finalizeUpload]
  );

  const startUpload = useCallback(async () => {
    if (!selectedFile) return;

    setError(null);
    setCompleted(null);
    setPhase("initializing");

    try {
      const initRes = await fetch("/api/uploads/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || deriveProjectTitle(selectedFile.name),
          filename: selectedFile.name,
          mimeType: selectedFile.type,
          sizeBytes: selectedFile.size,
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok) {
        throw new Error(initData.error || "Failed to initialize upload.");
      }

      const initMeta = initData as UploadInitResponse;
      initMetaRef.current = initMeta;

      await createAndStartTus(selectedFile, initMeta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start upload.");
      setPhase("error");
    }
  }, [createAndStartTus, selectedFile, title]);

  const pauseUpload = useCallback(async () => {
    const upload = tusUploadRef.current;
    if (!upload) return;
    await upload.abort();
    setPhase("paused");
  }, []);

  const resumeOrRetry = useCallback(async () => {
    setError(null);
    const upload = tusUploadRef.current;
    const initMeta = initMetaRef.current;

    if (upload) {
      setPhase("uploading");
      upload.start();
      return;
    }

    if (selectedFile && initMeta) {
      try {
        await createAndStartTus(selectedFile, initMeta);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not resume upload.");
        setPhase("error");
      }
      return;
    }

    await startUpload();
  }, [createAndStartTus, selectedFile, startUpload]);

  const [retryingJob, setRetryingJob] = useState(false);

  const retryWorkerProcessing = useCallback(async () => {
    if (!completed?.project.id) return;
    setRetryingJob(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${completed.project.id}/process`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not restart caption processing.");
        return;
      }
      setLiveProject((prev) =>
        prev ? { ...prev, status: "processing", ingest_jobs: [data.job] } : null
      );
    } catch {
      setError("Network error while restarting caption processing.");
    } finally {
      setRetryingJob(false);
    }
  }, [completed]);

  const percent =
    bytesTotal > 0 ? Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)) : 0;

  const liveJob = liveProject?.ingest_jobs?.[0] ?? null;
  const isTranscriptionReady =
    phase === "completed" && liveProject?.status === "ready";
  const isTranscriptionFailed =
    phase === "completed" &&
    (liveProject?.status === "failed" || liveJob?.status === "failed");
  const isTranscribing =
    phase === "completed" && !isTranscriptionReady && !isTranscriptionFailed;
  const isTransferActive =
    phase === "initializing" ||
    phase === "uploading" ||
    phase === "paused" ||
    phase === "finalizing" ||
    (phase === "error" && bytesTotal > 0);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Limits & Constraints Strip */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-ink/10 bg-panel p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <FileVideo className="h-3.5 w-3.5 text-ink-secondary" />
            <span>Formats</span>
          </div>
          <p className="mt-1 text-xs text-ink-secondary">MP4, MOV, MP3, and WAV</p>
        </div>

        <div className="rounded-xl border border-ink/10 bg-panel p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Upload className="h-3.5 w-3.5 text-ink-secondary" />
            <span>Max File Size</span>
          </div>
          <p className="mt-1 text-xs text-ink-secondary">
            Up to {formatBytes(MAX_UPLOAD_BYTES)} (resumable TUS)
          </p>
        </div>

        <div className="rounded-xl border border-ink/10 bg-panel p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Clock className="h-3.5 w-3.5 text-ink-secondary" />
            <span>Processing Limit</span>
          </div>
          <p className="mt-1 text-xs text-ink-secondary">
            Up to {MAX_DURATION_MINUTES} minutes per clip
          </p>
        </div>
      </div>

      {/* Main Upload Card */}
      <div className="rounded-2xl border border-ink/12 bg-panel p-5 sm:p-6">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = e.dataTransfer.files?.[0] ?? null;
            handleFilePicked(dropped);
          }}
          className={`rounded-2xl border border-dashed p-6 text-center transition-all duration-150 ${
            isDragging
              ? "scale-[1.01] border-accent bg-accent-soft/35 shadow-[0_0_0_3px_rgba(169,154,242,0.18)]"
              : "border-ink/20 bg-inset hover:border-ink/35"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,audio/mpeg,audio/wav,.mp4,.mov,.mp3,.wav"
            onChange={(e) => handleFilePicked(e.target.files?.[0] ?? null)}
            aria-label="Choose MP4, MOV, MP3, or WAV media file"
            className="sr-only"
          />

          <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-ink/15 bg-elevated text-ink">
            <Upload className="h-5 w-5" />
          </div>

          <p className="mt-3 text-sm font-semibold text-ink">
            {selectedFile ? selectedFile.name : "Drop an MP4, MOV, MP3, or WAV clip here"}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {selectedFile
              ? `${formatBytes(selectedFile.size)} · ${selectedFile.type || "media"}`
              : `MP4, MOV, MP3, or WAV up to ${formatBytes(MAX_UPLOAD_BYTES)} · ${MAX_DURATION_MINUTES}-minute processing limit`}
          </p>

          <button
            type="button"
            disabled={phase === "uploading" || phase === "initializing" || phase === "finalizing"}
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-elevated px-4 py-2 text-xs font-semibold text-ink transition hover:border-ink/30 disabled:opacity-50"
          >
            <span>{selectedFile ? "Choose a different file" : "Select media file"}</span>
          </button>
        </div>

        {/* Project Title */}
        <div className="mt-5">
          <label
            htmlFor="project-title"
            className="block text-xs font-medium text-ink-secondary"
          >
            Project title
          </label>
          <input
            id="project-title"
            type="text"
            maxLength={120}
            value={title}
            disabled={phase === "uploading" || phase === "finalizing"}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Launch Hook v1"
            className="mt-1.5 w-full rounded-xl border border-ink/12 bg-inset px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none disabled:opacity-60"
          />
        </div>

        {/* Clear 3-Stage Status Card: Uploading -> Processing -> Ready */}
        {(isTransferActive || phase === "completed") && (
          <div
            data-testid={phase === "completed" ? "upload-complete-banner" : "upload-transfer-card"}
            className="cc-panel-enter mt-5 rounded-xl border border-ink/12 bg-inset p-4"
          >
            {/* 3-Step Progression Header */}
            <ol
              data-testid="upload-status-steps"
              aria-label="Upload and transcription status"
              className="mb-3.5 grid grid-cols-3 gap-2 border-b border-ink/10 pb-3 text-xs"
            >
              <li
                data-active={isTransferActive ? "true" : "false"}
                className={`flex items-center gap-1.5 font-semibold ${
                  phase === "completed"
                    ? "text-ink-secondary"
                    : "text-ink"
                }`}
              >
                {phase === "completed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                ) : phase === "uploading" || phase === "initializing" || phase === "finalizing" ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-amber-300" />
                )}
                <span>Uploading</span>
              </li>

              <li
                data-active={isTranscribing ? "true" : "false"}
                className={`flex items-center gap-1.5 font-semibold ${
                  isTranscribing
                    ? "text-ink"
                    : isTranscriptionReady
                      ? "text-ink-secondary"
                      : isTranscriptionFailed
                        ? "text-rose-200"
                        : "text-ink-muted"
                }`}
              >
                {isTranscriptionReady ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                ) : isTranscribing ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
                ) : isTranscriptionFailed ? (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-300" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-track" />
                )}
                <span>Processing</span>
              </li>

              <li
                data-active={isTranscriptionReady ? "true" : "false"}
                className={`flex items-center gap-1.5 font-semibold ${
                  isTranscriptionReady ? "text-ink" : "text-ink-muted"
                }`}
              >
                {isTranscriptionReady ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-track" />
                )}
                <span>Ready</span>
              </li>
            </ol>

            {/* Stage 1 Details: File Transfer */}
            {isTransferActive && (
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">
                    {phase === "initializing" && "Preparing private upload..."}
                    {phase === "uploading" && "Uploading file to private storage..."}
                    {phase === "paused" && "Upload paused — resume when ready"}
                    {phase === "finalizing" && "Verifying file transfer..."}
                    {phase === "error" && "File transfer interrupted"}
                  </span>
                  <span
                    data-testid="upload-percent"
                    className="font-mono font-semibold tabular-nums text-ink"
                  >
                    {percent}%
                  </span>
                </div>

                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-track">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-150"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between font-mono text-[11px] tabular-nums text-ink-muted">
                  <span>
                    {formatBytes(bytesUploaded)} / {formatBytes(bytesTotal)}
                  </span>
                  <span>Transferring file · Transcription starts next</span>
                </div>
              </div>
            )}

            {/* Stage 2 & 3 Details: File Transfer Done -> Processing / Ready */}
            {completed && phase === "completed" && (
              <div>
                {(() => {
                  const workerDetail = isTranscriptionReady
                    ? "Ready to edit"
                    : isTranscriptionFailed
                      ? liveJob?.error_message ||
                        liveProject?.last_error_message ||
                        "Caption processing failed"
                      : liveJob?.status === "probing"
                        ? "Processing · Probing media"
                        : liveJob?.status === "transcoding"
                          ? "Processing · Generating preview"
                          : liveJob?.status === "transcribing"
                            ? "Processing · Transcribing captions"
                            : "Processing · Queued for transcription";

                  return (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 text-xs">
                          <p className="font-semibold text-ink">
                            {isTranscriptionReady
                              ? `${completed.project.title} is ready to edit`
                              : isTranscriptionFailed
                                ? `${completed.project.title} — transcription needs retry`
                                : `File uploaded (${formatBytes(completed.asset.verifiedSizeBytes)}) — generating captions`}
                          </p>
                          <p className="mt-1 text-ink-secondary">
                            <span
                              data-testid="upload-live-stage"
                              className={`font-medium ${
                                isTranscriptionReady
                                  ? "text-ink"
                                  : isTranscriptionFailed
                                    ? "text-rose-200"
                                    : "text-ink-secondary"
                              }`}
                            >
                              {workerDetail}
                            </span>
                            <span className="mx-1.5 text-ink-muted">·</span>
                            <span
                              data-testid="upload-percent"
                              className="font-mono text-[11px] text-ink-muted"
                            >
                              100% uploaded
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Strictly ONE primary next action per state + quiet secondary links */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-3">
                        <div>
                          {isTranscriptionReady ? (
                            <Link
                              href={`/projects/${completed.project.id}/editor`}
                              data-testid="upload-open-editor-btn"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-page transition hover:bg-accent-hover"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Open editor</span>
                            </Link>
                          ) : isTranscriptionFailed ? (
                            <button
                              type="button"
                              disabled={retryingJob}
                              onClick={() => void retryWorkerProcessing()}
                              data-testid="upload-retry-processing-btn"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-page transition hover:bg-accent-hover disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`h-3.5 w-3.5 ${retryingJob ? "animate-spin" : ""}`}
                              />
                              <span>
                                {retryingJob ? "Restarting..." : "Retry processing"}
                              </span>
                            </button>
                          ) : (
                            <Link
                              href="/projects"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-ink/15 bg-panel px-4 py-2 text-xs font-semibold text-ink transition hover:border-ink/30 hover:bg-elevated"
                            >
                              <FolderKanban className="h-3.5 w-3.5 text-ink-secondary" />
                              <span>View in Projects</span>
                            </Link>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-ink-secondary">
                          {(isTranscriptionReady || isTranscriptionFailed) && (
                            <Link
                              href="/projects"
                              className="font-medium underline-offset-4 hover:text-ink hover:underline"
                            >
                              View in Projects
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => handleFilePicked(null)}
                            className="font-medium underline-offset-4 hover:text-ink hover:underline"
                          >
                            Upload another clip
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="cc-panel-enter mt-4 flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3.5 text-xs text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Controls (hidden once transfer completed, since status card owns next action) */}
        {phase !== "completed" && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <ShieldCheck className="h-4 w-4 text-ink-secondary" />
              <span>Private resumable upload</span>
            </div>

            <div className="flex items-center gap-2">
              {phase === "uploading" && (
                <button
                  type="button"
                  onClick={() => void pauseUpload()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-ink/15 bg-elevated px-4 py-2.5 text-xs font-semibold text-ink transition hover:border-ink/30"
                >
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause</span>
                </button>
              )}

              {(phase === "paused" || phase === "error") && (
                <button
                  type="button"
                  onClick={() => void resumeOrRetry()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-page transition hover:bg-accent-hover"
                >
                  {phase === "paused" ? (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>{phase === "paused" ? "Resume upload" : "Retry upload"}</span>
                </button>
              )}

              {(phase === "idle" || phase === "initializing") && (
                <button
                  type="button"
                  disabled={!selectedFile || phase === "initializing"}
                  onClick={() => void startUpload()}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-page transition hover:bg-accent-hover disabled:opacity-45"
                >
                  <Upload className="h-4 w-4" />
                  <span>
                    {phase === "initializing" ? "Preparing..." : "Start upload"}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
