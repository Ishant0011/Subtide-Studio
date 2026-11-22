"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AudioLines,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { computeCaptionLayout } from "@/lib/caption-editor";
import {
  formatBytes,
  type CaptionRevisionRow,
  type IngestJobRow,
  type NormalizedCaptionCue,
  type ProjectWithMedia,
} from "@/lib/uploads";

interface ProjectsListProps {
  initialProjects: ProjectWithMedia[];
}

interface PreviewState {
  url: string;
  title: string;
  mediaKind: "video" | "audio";
  revision: CaptionRevisionRow | null;
}

const ACTIVE_JOB_STATUSES = new Set([
  "queued",
  "probing",
  "transcoding",
  "transcribing",
]);

function formatErrorLabel(code: string | null | undefined): string {
  switch (code) {
    case "corrupt_media":
      return "Corrupt media";
    case "missing_audio":
      return "Missing audio track";
    case "duration_limit_exceeded":
      return "Exceeds 3-minute limit";
    case "bounds_exceeded":
      return "Exceeds media bounds";
    case "provider_failure":
      return "Transcription provider error";
    case "storage_error":
      return "Storage error";
    default:
      return "Processing failed";
  }
}

function getStageDisplay(
  project: ProjectWithMedia,
  job: IngestJobRow | null,
  revision: CaptionRevisionRow | null
): { label: string; tone: "accent" | "amber" | "rose" | "neutral"; spinning: boolean } {
  if (job) {
    if (job.status === "queued") {
      return {
        label: job.attempt_count > 0 ? `Retrying (${job.attempt_count}/${job.max_attempts})` : "Queued",
        tone: "amber",
        spinning: true,
      };
    }
    if (job.status === "probing") {
      return { label: "Probing media", tone: "amber", spinning: true };
    }
    if (job.status === "transcoding") {
      return { label: "Generating preview", tone: "amber", spinning: true };
    }
    if (job.status === "transcribing") {
      return { label: "Transcribing", tone: "amber", spinning: true };
    }
    if (job.status === "failed") {
      return { label: formatErrorLabel(job.error_code), tone: "rose", spinning: false };
    }
    if (job.status === "completed") {
      if (revision?.speech_status === "no_speech") {
        return { label: "Ready · No speech", tone: "accent", spinning: false };
      }
      return { label: "Ready", tone: "accent", spinning: false };
    }
  }

  if (project.status === "failed") {
    return {
      label: formatErrorLabel(project.last_error_code),
      tone: "rose",
      spinning: false,
    };
  }
  if (project.status === "ready") {
    return { label: "Uploaded", tone: "neutral", spinning: false };
  }
  return { label: project.status, tone: "neutral", spinning: false };
}

function findActiveCueMs(
  cues: NormalizedCaptionCue[],
  timeMs: number
): NormalizedCaptionCue | null {
  for (const cue of cues) {
    if (timeMs >= cue.start_ms && timeMs <= cue.end_ms) {
      return cue;
    }
  }
  return null;
}

export function ProjectsList({ initialProjects }: ProjectsListProps) {
  const [projects, setProjects] = useState<ProjectWithMedia[]>(initialProjects);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewTimeMs, setPreviewTimeMs] = useState(0);
  const [loadingAssetId, setLoadingAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasActiveJobs = useMemo(
    () =>
      projects.some((p) => {
        if (p.status === "queued" || p.status === "processing") return true;
        return (p.ingest_jobs ?? []).some((j) => ACTIVE_JOB_STATUSES.has(j.status));
      }),
    [projects]
  );

  // Authenticated polling with exponential backoff while any job is active
  useEffect(() => {
    if (!hasActiveJobs) return;

    let cancelled = false;
    let delayMs = 2000;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.projects)) {
            setProjects(data.projects as ProjectWithMedia[]);
          }
        }
      } catch {
        // Backoff handles transient poll errors gracefully
      }

      if (!cancelled) {
        delayMs = Math.min(8000, Math.round(delayMs * 1.4));
        timerId = setTimeout(poll, delayMs);
      }
    };

    timerId = setTimeout(poll, delayMs);
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [hasActiveJobs]);

  async function saveTitle(projectId: string) {
    const trimmed = draftTitle.trim();
    if (!trimmed) return;
    setSavingId(projectId);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not rename project.");
        return;
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, title: data.project.title } : p))
      );
      setEditingId(null);
    } catch {
      setError("Network error while renaming project.");
    } finally {
      setSavingId(null);
    }
  }

  async function startProcessing(projectId: string) {
    setStartingId(projectId);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/process`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start processing.");
        return;
      }

      // Immediately refresh projects list so polling kicks in
      const listRes = await fetch("/api/projects", { cache: "no-store" });
      if (listRes.ok) {
        const listData = await listRes.json();
        if (Array.isArray(listData.projects)) {
          setProjects(listData.projects as ProjectWithMedia[]);
        }
      }
    } catch {
      setError("Network error while starting processing.");
    } finally {
      setStartingId(null);
    }
  }

  async function openPreview(
    assetId: string,
    project: ProjectWithMedia,
    revision: CaptionRevisionRow | null
  ) {
    setLoadingAssetId(assetId);
    setError(null);
    try {
      const query = project.preview_object_key ? "?kind=preview" : "";
      const res = await fetch(`/api/media/${assetId}/signed-url${query}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load private media preview.");
        return;
      }
      const primaryAsset = project.media_assets?.[0];
      const isAudio =
        project.media_kind === "audio" ||
        primaryAsset?.mime_type?.startsWith("audio/");

      setPreviewTimeMs(0);
      setPreview({
        url: data.signedUrl,
        title: project.title,
        mediaKind: isAudio ? "audio" : "video",
        revision,
      });
    } catch {
      setError("Network error while requesting signed media URL.");
    } finally {
      setLoadingAssetId(null);
    }
  }

  const activePreviewCue = useMemo(() => {
    if (!preview?.revision?.cues?.length) return null;
    return findActiveCueMs(preview.revision.cues, previewTimeMs);
  }, [preview, previewTimeMs]);

  const previewAccentHex = useMemo(
    () => computeCaptionLayout(preview?.revision?.style).accentHex,
    [preview]
  );

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
        >
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-panel/70 px-6 py-14 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/35 bg-accent-soft text-accent">
            <Film className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-ink">
            No projects yet
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-secondary">
            Upload an MP4, MOV, MP3, or WAV clip (up to 150 MB, 3-minute
            processing limit) to create your first project. Track processing
            progress here, then click <strong className="font-semibold text-ink">Open editor</strong> once it&apos;s ready.
          </p>
          <Link
            href="/upload"
            data-testid="new-project-empty-btn"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-page transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            <span>New project</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const primaryAsset = project.media_assets?.[0] ?? null;
            const job = project.ingest_jobs?.[0] ?? null;
            const revision =
              (project.caption_revisions ?? []).find(
                (r) => r.id === project.active_revision_id
              ) ??
              project.caption_revisions?.[0] ??
              null;

            const stage = getStageDisplay(project, job, revision);
            const isAssetUploaded = primaryAsset?.status === "uploaded";
            const canStartProcessing =
              isAssetUploaded && (!job || job.status === "failed");
            const isEditing = editingId === project.id;

            const badgeClass =
              stage.tone === "accent"
                ? "border border-accent/40 bg-accent-soft text-accent-hover"
                : stage.tone === "amber"
                  ? "border border-amber-400/35 bg-amber-400/10 text-amber-200"
                  : stage.tone === "rose"
                    ? "border border-rose-400/35 bg-rose-500/10 text-rose-200"
                    : "border border-ink/12 bg-elevated text-ink-secondary";

            const isAudio =
              project.media_kind === "audio" ||
              primaryAsset?.mime_type?.startsWith("audio/");
            const durationSec = project.duration_ms
              ? `${Math.floor(project.duration_ms / 60000)}:${String(
                  Math.floor((project.duration_ms % 60000) / 1000)
                ).padStart(2, "0")}`
              : null;

            return (
              <article
                key={project.id}
                data-testid={`project-card-${project.id}`}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-ink/10 bg-panel transition hover:border-accent/30"
              >
                {/* Project Visual Thumbnail / Audio Artwork */}
                <div className="relative h-40 w-full overflow-hidden border-b border-ink/8 bg-page">
                  {isAudio ? (
                    <div
                      data-testid={`project-audio-artwork-${project.id}`}
                      className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#1A1530] via-[#11121F] to-page px-4"
                    >
                      <div className="flex items-end gap-1.5">
                        {[14, 28, 42, 22, 48, 34, 20, 38, 26, 16].map((h, i) => (
                          <span
                            key={i}
                            style={{ height: `${h}px` }}
                            className={`w-1.5 rounded-full ${
                              i % 3 === 1 ? "bg-accent" : "bg-accent/35"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent/35 bg-accent-soft/90 px-2.5 py-0.5 text-[11px] font-medium text-accent-hover">
                        <AudioLines className="h-3 w-3" />
                        <span>Audio · 9:16 Portrait Stage</span>
                      </span>
                    </div>
                  ) : project.thumbnail_url ? (
                    <div
                      data-testid={`project-video-thumbnail-${project.id}`}
                      className="relative flex h-full w-full items-center justify-center bg-page"
                    >
                      <video
                        src={`${project.thumbnail_url}#t=0.5`}
                        muted
                        playsInline
                        preload="metadata"
                        aria-hidden="true"
                        className="h-full w-full object-contain"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-page/70 via-transparent to-transparent" />
                    </div>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-elevated to-page text-ink-muted">
                      <Film className="h-7 w-7 text-accent/70" />
                      <span className="mt-1.5 text-[11px]">
                        {stage.spinning ? "Generating preview..." : "Video clip"}
                      </span>
                    </div>
                  )}

                  {/* Top overlay status pill */}
                  <span
                    data-testid={`project-stage-${project.id}`}
                    className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md ${badgeClass}`}
                  >
                    {stage.spinning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : stage.tone === "accent" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : stage.tone === "rose" ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    <span>{stage.label}</span>
                  </span>

                  {durationSec && (
                    <span className="absolute bottom-2.5 right-3 rounded-md border border-ink/15 bg-page/80 px-2 py-0.5 font-mono text-[11px] tabular-nums text-ink">
                      {durationSec}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      {isEditing ? (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="text"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            maxLength={120}
                            aria-label="Project title"
                            className="w-full rounded-lg border border-accent/60 bg-page px-2.5 py-1.5 text-sm text-ink focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={savingId === project.id}
                            onClick={() => void saveTitle(project.id)}
                            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-page hover:bg-accent-hover"
                          >
                            {savingId === project.id ? "..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-ink/12 px-2 py-1.5 text-xs text-ink-secondary hover:text-ink"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex min-w-0 items-center gap-2">
                          <h2 className="truncate text-base font-semibold tracking-tight text-ink">
                            {project.title}
                          </h2>
                          <button
                            type="button"
                            aria-label={`Rename ${project.title}`}
                            onClick={() => {
                              setEditingId(project.id);
                              setDraftTitle(project.title);
                            }}
                            className="shrink-0 rounded-md p-1 text-ink-muted transition hover:bg-elevated hover:text-ink"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Error details when failed */}
                    {(job?.error_message || project.last_error_message) &&
                      (job?.status === "failed" || project.status === "failed") && (
                        <p className="mt-2.5 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                          {job?.error_message || project.last_error_message}
                        </p>
                      )}

                    {primaryAsset && (
                      <dl className="mt-3.5 grid grid-cols-2 gap-2.5 rounded-xl border border-ink/8 bg-page/75 p-3 text-xs">
                        <div>
                          <dt className="text-ink-muted">File</dt>
                          <dd className="mt-0.5 truncate font-medium text-ink">
                            {primaryAsset.original_filename}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">Verified size</dt>
                          <dd className="mt-0.5 font-mono tabular-nums text-ink">
                            {formatBytes(
                              primaryAsset.verified_size_bytes ??
                                primaryAsset.expected_size_bytes
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">Media</dt>
                          <dd className="mt-0.5 font-mono text-ink-secondary">
                            {isAudio
                              ? "Audio · 9:16 stage"
                              : project.preview_width && project.preview_height
                                ? `${project.preview_width}×${project.preview_height}`
                                : primaryAsset.mime_type}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">Captions</dt>
                          <dd className="mt-0.5 tabular-nums text-ink-secondary">
                            {revision
                              ? revision.speech_status === "no_speech"
                                ? "No speech detected"
                                : `${revision.cues.length} cues (${revision.words.length} words)`
                              : job?.stage_message || "Waiting for worker"}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-ink/8 pt-3.5">
                    <span className="font-mono text-[11px] text-ink-muted">
                      {revision
                        ? `Rev #${revision.revision_number} · ${revision.source}`
                        : stage.spinning
                          ? "Processing in worker"
                          : "Ready for processing"}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {canStartProcessing && (
                        <button
                          type="button"
                          disabled={startingId === project.id}
                          onClick={() => void startProcessing(project.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-elevated px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent/55 hover:text-accent-hover disabled:opacity-60"
                        >
                          {startingId === project.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : job?.status === "failed" ? (
                            <RefreshCw className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5 fill-current" />
                          )}
                          <span>
                            {job?.status === "failed"
                              ? "Retry processing"
                              : "Start processing"}
                          </span>
                        </button>
                      )}

                      {primaryAsset && isAssetUploaded && project.status === "ready" && (
                        <Link
                          href={`/projects/${project.id}/editor`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-page transition hover:bg-accent-hover"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Open editor</span>
                        </Link>
                      )}

                      {primaryAsset && isAssetUploaded && (
                        <button
                          type="button"
                          disabled={loadingAssetId === primaryAsset.id}
                          onClick={() => void openPreview(primaryAsset.id, project, revision)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-hover transition hover:bg-accent hover:text-page disabled:opacity-60"
                        >
                          {loadingAssetId === primaryAsset.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3.5 w-3.5" />
                          )}
                          <span>Preview clip</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Owner-only Signed Media Preview Modal (Video + Audio Portrait Stage) */}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${preview.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-ink/15 bg-panel p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-ink">
                {preview.title}
              </h3>
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setPreview(null)}
                className="rounded-lg border border-ink/12 p-1.5 text-ink-secondary hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {preview.mediaKind === "audio" ? (
              <div className="flex flex-col items-center">
                <div
                  data-testid="audio-portrait-stage"
                  className="relative flex aspect-[9/16] w-full max-w-[290px] flex-col items-center justify-between overflow-hidden rounded-2xl border border-ink/12 bg-gradient-to-b from-[#1A1530] via-[#11121F] to-page p-5"
                >
                  <span className="rounded-full border border-accent/35 bg-accent-soft/90 px-3 py-1 text-[11px] font-medium text-accent-hover">
                    Audio · 9:16 Stage
                  </span>

                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/40 bg-accent-soft text-accent">
                      <AudioLines className="h-7 w-7" />
                    </span>
                    <p className="text-xs font-medium text-ink-secondary">
                      {preview.title}
                    </p>
                  </div>

                  <div className="min-h-[64px] w-full text-center">
                    {preview.revision?.speech_status === "no_speech" ? (
                      <p className="text-xs text-ink-muted">
                        No speech detected in audio
                      </p>
                    ) : activePreviewCue ? (
                      <p className="flex flex-wrap justify-center gap-1 text-sm font-bold text-ink">
                        {activePreviewCue.words.map((w) => {
                          const isWordActive =
                            previewTimeMs >= w.start_ms && previewTimeMs <= w.end_ms;
                          return (
                            <span
                              key={w.id}
                              style={
                                isWordActive
                                  ? { backgroundColor: previewAccentHex, color: "#070B10" }
                                  : undefined
                              }
                              className={`rounded px-1.5 py-0.5 ${
                                isWordActive ? "" : "text-ink"
                              }`}
                            >
                              {w.text}
                            </span>
                          );
                        })}
                      </p>
                    ) : null}
                  </div>
                </div>

                <audio
                  src={preview.url}
                  controls
                  onTimeUpdate={(e) =>
                    setPreviewTimeMs(Math.round(e.currentTarget.currentTime * 1000))
                  }
                  className="mt-4 w-full"
                />
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl bg-page">
                <video
                  src={preview.url}
                  controls
                  playsInline
                  onTimeUpdate={(e) =>
                    setPreviewTimeMs(Math.round(e.currentTarget.currentTime * 1000))
                  }
                  className="max-h-[70vh] w-full rounded-xl bg-page"
                />
                {activePreviewCue && (
                  <div className="pointer-events-none absolute inset-x-4 bottom-12 flex justify-center">
                    <p className="flex flex-wrap justify-center gap-1 rounded-xl bg-page/80 px-3 py-1.5 text-center text-sm font-bold text-ink backdrop-blur-sm">
                      {activePreviewCue.words.map((w) => {
                        const isWordActive =
                          previewTimeMs >= w.start_ms && previewTimeMs <= w.end_ms;
                        return (
                          <span
                            key={w.id}
                            style={
                              isWordActive
                                ? { backgroundColor: previewAccentHex, color: "#070B10" }
                                : undefined
                            }
                            className={`rounded px-1 ${
                              isWordActive ? "" : "text-ink"
                            }`}
                          >
                            {w.text}
                          </span>
                        );
                      })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {preview.revision?.speech_status === "no_speech" && (
              <p className="mt-3 text-center text-xs text-ink-secondary">
                Audio is valid, but no speech was detected for captions.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
