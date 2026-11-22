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

  const percent =
    bytesTotal > 0 ? Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)) : 0;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Limits & Constraints Strip */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#F5F1E8]/10 bg-[#0D131C] p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#49E6B3]">
            <FileVideo className="h-3.5 w-3.5" />
            <span>Formats</span>
          </div>
          <p className="mt-1 text-xs text-[#B6B0A4]">MP4, MOV, MP3, and WAV</p>
        </div>

        <div className="rounded-xl border border-[#F5F1E8]/10 bg-[#0D131C] p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#49E6B3]">
            <Upload className="h-3.5 w-3.5" />
            <span>Max File Size</span>
          </div>
          <p className="mt-1 text-xs text-[#B6B0A4]">
            Up to {formatBytes(MAX_UPLOAD_BYTES)} (resumable TUS)
          </p>
        </div>

        <div className="rounded-xl border border-[#F5F1E8]/10 bg-[#0D131C] p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#49E6B3]">
            <Clock className="h-3.5 w-3.5" />
            <span>Processing Limit</span>
          </div>
          <p className="mt-1 text-xs text-[#B6B0A4]">
            Up to {MAX_DURATION_MINUTES} minutes per clip
          </p>
        </div>
      </div>

      {/* Main Upload Card */}
      <div className="rounded-2xl border border-[#F5F1E8]/12 bg-[#0D131C] p-5 sm:p-6">
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
          className={`rounded-2xl border border-dashed p-6 text-center transition ${
            isDragging
              ? "border-[#49E6B3] bg-[#102E28]/35"
              : "border-[#F5F1E8]/20 bg-[#070B10]/70 hover:border-[#49E6B3]/50"
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

          <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3]">
            <Upload className="h-5 w-5" />
          </div>

          <p className="mt-3 text-sm font-semibold text-[#F5F1E8]">
            {selectedFile ? selectedFile.name : "Drop an MP4, MOV, MP3, or WAV clip here"}
          </p>
          <p className="mt-1 text-xs text-[#7D7A72]">
            {selectedFile
              ? `${formatBytes(selectedFile.size)} · ${selectedFile.type || "media"}`
              : `MP4, MOV, MP3, or WAV up to ${formatBytes(MAX_UPLOAD_BYTES)} · ${MAX_DURATION_MINUTES}-minute processing limit`}
          </p>

          <button
            type="button"
            disabled={phase === "uploading" || phase === "initializing" || phase === "finalizing"}
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#F5F1E8]/15 bg-[#131C28] px-4 py-2 text-xs font-semibold text-[#F5F1E8] transition hover:border-[#49E6B3]/50 hover:text-[#49E6B3] disabled:opacity-50"
          >
            <span>{selectedFile ? "Choose a different file" : "Select media file"}</span>
          </button>
        </div>

        {/* Project Title */}
        <div className="mt-5">
          <label
            htmlFor="project-title"
            className="block text-xs font-medium text-[#B6B0A4]"
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
            className="mt-1.5 w-full rounded-xl border border-[#F5F1E8]/12 bg-[#070B10] px-3.5 py-2.5 text-sm text-[#F5F1E8] placeholder:text-[#7D7A72] focus:border-[#49E6B3] focus:outline-none disabled:opacity-60"
          />
        </div>

        {/* Progress Bar */}
        {(phase === "uploading" ||
          phase === "paused" ||
          phase === "finalizing" ||
          phase === "completed" ||
          (phase === "error" && bytesTotal > 0)) && (
          <div className="mt-5 rounded-xl border border-[#F5F1E8]/10 bg-[#070B10] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#F5F1E8]">
                {phase === "uploading" && "Uploading directly to private storage..."}
                {phase === "paused" && "Upload paused — ready to resume"}
                {phase === "finalizing" && "Verifying ownership and stored file size..."}
                {phase === "completed" && "Upload verified and saved to Projects"}
                {phase === "error" && "Upload interrupted"}
              </span>
              <span
                data-testid="upload-percent"
                className="font-mono font-semibold tabular-nums text-[#49E6B3]"
              >
                {percent}%
              </span>
            </div>

            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#131C28]">
              <div
                className="h-full rounded-full bg-[#49E6B3] transition-all duration-150"
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between font-mono text-[11px] tabular-nums text-[#7D7A72]">
              <span>
                {formatBytes(bytesUploaded)} / {formatBytes(bytesTotal)}
              </span>
              <span>Resumable TUS · No overwrite</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3.5 text-xs text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Completion & Live Processing Handoff Banner */}
        {completed && phase === "completed" && (
          <div
            data-testid="upload-complete-banner"
            className="mt-4 rounded-xl border border-[#49E6B3]/40 bg-[#102E28]/70 p-4"
          >
            {(() => {
              const liveJob = liveProject?.ingest_jobs?.[0] ?? null;
              const isReady = liveProject?.status === "ready";
              const isFailed =
                liveProject?.status === "failed" || liveJob?.status === "failed";
              const stageLabel = isReady
                ? "Ready to edit"
                : isFailed
                  ? liveJob?.error_message ||
                    liveProject?.last_error_message ||
                    "Processing failed"
                  : liveJob?.status === "probing"
                    ? "Probing media"
                    : liveJob?.status === "transcoding"
                      ? "Generating preview"
                      : liveJob?.status === "transcribing"
                        ? "Transcribing captions"
                        : "Queued for worker";

              return (
                <>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      {isReady ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#49E6B3]" />
                      ) : isFailed ? (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                      ) : (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#49E6B3]" />
                      )}
                      <div className="text-xs">
                        <p className="font-semibold text-[#F5F1E8]">
                          {completed.project.title} —{" "}
                          {isReady
                            ? "captions are ready!"
                            : isFailed
                              ? "processing needs attention"
                              : "uploaded & processing"}
                        </p>
                        <p className="mt-1 font-mono text-[#B6B0A4]">
                          Verified size:{" "}
                          {formatBytes(completed.asset.verifiedSizeBytes)} ·{" "}
                          <span
                            data-testid="upload-live-stage"
                            className={
                              isReady
                                ? "text-[#49E6B3]"
                                : isFailed
                                  ? "text-rose-200"
                                  : "text-amber-200"
                            }
                          >
                            {stageLabel}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 flex flex-wrap gap-2.5">
                    {isReady && (
                      <Link
                        href={`/projects/${completed.project.id}/editor`}
                        data-testid="upload-open-editor-btn"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#49E6B3] px-3.5 py-2 text-xs font-semibold text-[#070B10] transition hover:bg-[#2FD49F]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Open editor</span>
                      </Link>
                    )}
                    <Link
                      href="/projects"
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                        isReady
                          ? "border border-[#F5F1E8]/15 bg-[#0D131C] text-[#F5F1E8] hover:border-[#49E6B3]/50"
                          : "bg-[#49E6B3] text-[#070B10] hover:bg-[#2FD49F]"
                      }`}
                    >
                      <FolderKanban className="h-3.5 w-3.5" />
                      <span>View in Projects</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleFilePicked(null)}
                      className="rounded-lg border border-[#F5F1E8]/15 bg-[#0D131C] px-3.5 py-2 text-xs font-medium text-[#F5F1E8] hover:border-[#F5F1E8]/30"
                    >
                      Upload another clip
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#7D7A72]">
            <ShieldCheck className="h-4 w-4 text-[#49E6B3]" />
            <span>Server-assigned private object key</span>
          </div>

          <div className="flex items-center gap-2">
            {phase === "uploading" && (
              <button
                type="button"
                onClick={() => void pauseUpload()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#F5F1E8]/15 bg-[#131C28] px-4 py-2.5 text-xs font-semibold text-[#F5F1E8] transition hover:border-[#49E6B3]/50"
              >
                <Pause className="h-3.5 w-3.5" />
                <span>Pause</span>
              </button>
            )}

            {(phase === "paused" || phase === "error") && (
              <button
                type="button"
                onClick={() => void resumeOrRetry()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#49E6B3] px-4 py-2.5 text-xs font-semibold text-[#070B10] transition hover:bg-[#2FD49F]"
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
                className="inline-flex items-center gap-2 rounded-xl bg-[#49E6B3] px-5 py-2.5 text-sm font-semibold text-[#070B10] transition hover:bg-[#2FD49F] disabled:opacity-45"
              >
                <Upload className="h-4 w-4" />
                <span>
                  {phase === "initializing" ? "Preparing..." : "Start upload"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
