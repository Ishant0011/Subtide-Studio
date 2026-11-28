"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpDown,
  AudioLines,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Film,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
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

type ProjectFilterStatus = "all" | "ready" | "processing" | "failed" | "uploaded";
type ProjectSortOrder = "newest" | "oldest" | "title_asc" | "duration_desc";

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

function getRealFilterBucket(project: ProjectWithMedia): Exclude<ProjectFilterStatus, "all"> {
  const job = project.ingest_jobs?.[0] ?? null;
  if (job) {
    if (ACTIVE_JOB_STATUSES.has(job.status)) return "processing";
    if (job.status === "failed") return "failed";
    if (job.status === "completed") return "ready";
  }
  if (project.status === "failed") return "failed";
  if (project.status === "queued" || project.status === "processing") return "processing";
  if (project.status === "ready" && (project.active_revision_id || project.preview_object_key)) {
    return "ready";
  }
  return "uploaded";
}

function formatLastEdited(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Edited just now";
  if (diffMins < 60) return `Edited ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Edited ${diffHours}h ago`;
  return `Edited ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function getStageDisplay(
  project: ProjectWithMedia,
  job: IngestJobRow | null,
  revision: CaptionRevisionRow | null
): {
  label: string;
  tone: "accent" | "amber" | "rose" | "neutral";
  spinning: boolean;
  kind: "queued" | "transcribing" | "ready" | "failed" | "uploading";
} {
  const primaryAsset = project.media_assets?.[0] ?? null;
  if (primaryAsset && primaryAsset.status !== "uploaded" && !job) {
    return {
      label: "Uploading",
      tone: "amber",
      spinning: true,
      kind: "uploading",
    };
  }

  if (job) {
    if (job.status === "queued") {
      return {
        label:
          job.attempt_count > 0
            ? `Waiting to transcribe · Retry ${job.attempt_count}/${job.max_attempts}`
            : "Waiting to transcribe",
        tone: "amber",
        spinning: false,
        kind: "queued",
      };
    }
    if (job.status === "probing") {
      return {
        label: "Transcribing · Probing",
        tone: "amber",
        spinning: true,
        kind: "transcribing",
      };
    }
    if (job.status === "transcoding") {
      return {
        label: "Transcribing · Preview",
        tone: "amber",
        spinning: true,
        kind: "transcribing",
      };
    }
    if (job.status === "transcribing") {
      return {
        label: "Transcribing...",
        tone: "amber",
        spinning: true,
        kind: "transcribing",
      };
    }
    if (job.status === "failed") {
      return {
        label: `Failed · ${formatErrorLabel(job.error_code)}`,
        tone: "rose",
        spinning: false,
        kind: "failed",
      };
    }
    if (job.status === "completed") {
      if (revision?.speech_status === "no_speech") {
        return {
          label: "Ready · No speech",
          tone: "accent",
          spinning: false,
          kind: "ready",
        };
      }
      return { label: "Ready", tone: "accent", spinning: false, kind: "ready" };
    }
  }

  if (project.status === "failed") {
    return {
      label: `Failed · ${formatErrorLabel(project.last_error_code)}`,
      tone: "rose",
      spinning: false,
      kind: "failed",
    };
  }
  if (project.status === "ready") {
    return {
      label: project.active_revision_id ? "Ready" : "Uploaded",
      tone: project.active_revision_id ? "accent" : "neutral",
      spinning: false,
      kind: "ready",
    };
  }
  if (project.status === "queued") {
    return {
      label: "Waiting to transcribe",
      tone: "amber",
      spinning: false,
      kind: "queued",
    };
  }
  if (project.status === "processing") {
    return {
      label: "Transcribing...",
      tone: "amber",
      spinning: true,
      kind: "transcribing",
    };
  }
  return { label: "Uploading", tone: "neutral", spinning: false, kind: "uploading" };
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectFilterStatus>("all");
  const [sortOrder, setSortOrder] = useState<ProjectSortOrder>("newest");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewTimeMs, setPreviewTimeMs] = useState(0);
  const [loadingAssetId, setLoadingAssetId] = useState<string | null>(null);
  const [openingEditorId, setOpeningEditorId] = useState<string | null>(null);
  const [failedThumbIds, setFailedThumbIds] = useState<Record<string, boolean>>({});
  const [newlyReadyIds, setNewlyReadyIds] = useState<Record<string, boolean>>({});
  const prevBucketsRef = useRef<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Highlight Processing -> Ready transitions once so status completion is immediately noticeable
  useEffect(() => {
    const prev = prevBucketsRef.current;
    const nextBuckets: Record<string, string> = {};
    const transitioned: string[] = [];
    for (const project of projects) {
      const bucket = getRealFilterBucket(project);
      nextBuckets[project.id] = bucket;
      if (prev[project.id] === "processing" && bucket === "ready") {
        transitioned.push(project.id);
      }
    }
    prevBucketsRef.current = nextBuckets;
    if (transitioned.length > 0) {
      setNewlyReadyIds((curr) => {
        const updated = { ...curr };
        for (const id of transitioned) updated[id] = true;
        return updated;
      });
    }
  }, [projects]);

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

  const statusCounts = useMemo(() => {
    const counts: Record<ProjectFilterStatus, number> = {
      all: projects.length,
      ready: 0,
      processing: 0,
      failed: 0,
      uploaded: 0,
    };
    for (const project of projects) {
      counts[getRealFilterBucket(project)] += 1;
    }
    return counts;
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = projects.filter((project) => {
      if (statusFilter !== "all" && getRealFilterBucket(project) !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const filename = project.media_assets?.[0]?.original_filename?.toLowerCase() ?? "";
      return project.title.toLowerCase().includes(q) || filename.includes(q);
    });

    return [...list].sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at).getTime();
      const bTime = new Date(b.updated_at || b.created_at).getTime();
      if (sortOrder === "oldest") {
        return aTime - bTime;
      }
      if (sortOrder === "title_asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === "duration_desc") {
        return (b.duration_ms ?? 0) - (a.duration_ms ?? 0);
      }
      return bTime - aTime;
    });
  }, [projects, searchQuery, statusFilter, sortOrder]);

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

  const previewLayout = useMemo(
    () => computeCaptionLayout(preview?.revision?.style),
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

      {/* Search, Real-Status Filters & Sort Bar */}
      {projects.length > 0 && (
        <div
          data-testid="projects-controls"
          className="mb-5 flex flex-col gap-3 rounded-2xl border border-ink/10 bg-panel p-3 sm:p-3.5"
        >
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Search by title or filename */}
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-ink/12 bg-page px-3 py-2 focus-within:border-accent">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
              <input
                type="text"
                data-testid="projects-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects by title or filename..."
                aria-label="Search projects"
                className="min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear project search"
                  className="text-ink-muted hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Sort dropdown */}
            <label className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-ink/12 bg-inset px-3 py-2 text-xs text-ink-secondary">
              <ArrowUpDown className="h-3.5 w-3.5 text-ink-muted" />
              <span className="sr-only">Sort projects</span>
              <select
                data-testid="projects-sort-select"
                aria-label="Sort projects"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as ProjectSortOrder)}
                className="bg-inset text-xs font-medium text-ink focus:outline-none"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title_asc">Title (A–Z)</option>
                <option value="duration_desc">Longest clip</option>
              </select>
            </label>
          </div>

          {/* Real-status filter chips */}
          <div
            role="group"
            aria-label="Filter projects by status"
            className="flex flex-wrap items-center gap-1.5"
          >
            {(
              [
                { id: "all", label: "All" },
                { id: "ready", label: "Ready" },
                { id: "processing", label: "Processing" },
                { id: "failed", label: "Failed" },
                { id: "uploaded", label: "Uploaded" },
              ] as const
            ).map((chip) => {
              const active = statusFilter === chip.id;
              const count = statusCounts[chip.id];
              if (chip.id === "uploaded" && count === 0) return null;
              return (
                <button
                  key={chip.id}
                  type="button"
                  data-testid={`projects-filter-${chip.id}`}
                  aria-pressed={active}
                  onClick={() => setStatusFilter(chip.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "border-accent bg-accent text-page"
                      : "border-ink/10 bg-inset text-ink-secondary hover:border-ink/25 hover:text-ink"
                  }`}
                >
                  <span>{chip.label}</span>
                  <span className="font-mono text-[10px] opacity-80">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
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
            progress here, then click{" "}
            <strong className="font-semibold text-ink">Open editor</strong> once
            it&apos;s ready.
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
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-panel/70 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-ink">
            No matching projects
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Try clearing your search or switching back to all statuses.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            className="mt-4 rounded-xl border border-accent/45 bg-accent-soft px-4 py-2 text-xs font-semibold text-accent-hover hover:bg-accent hover:text-page"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div
          data-testid="projects-grid"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredProjects.map((project) => {
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

            const isReadyForEditor =
              Boolean(primaryAsset) &&
              isAssetUploaded &&
              project.status === "ready" &&
              !canStartProcessing;

            const badgeClass =
              stage.tone === "accent"
                ? "border border-ink/20 bg-page/85 text-ink"
                : stage.tone === "amber"
                  ? "border border-amber-400/35 bg-amber-400/12 text-amber-200"
                  : stage.tone === "rose"
                    ? "border border-rose-400/35 bg-rose-500/15 text-rose-200"
                    : "border border-ink/12 bg-elevated text-ink-secondary";

            const isAudio =
              project.media_kind === "audio" ||
              primaryAsset?.mime_type?.startsWith("audio/");
            const thumbFailed = Boolean(failedThumbIds[project.id]);
            const durationSec = project.duration_ms
              ? `${Math.floor(project.duration_ms / 60000)}:${String(
                  Math.floor((project.duration_ms % 60000) / 1000)
                ).padStart(2, "0")}`
              : null;
            const lastEditedLabel = formatLastEdited(
              project.updated_at || project.created_at
            );

            return (
              <article
                key={project.id}
                data-testid={`project-card-${project.id}`}
                data-project-title={project.title}
                data-project-stage={stage.kind}
                className={`cc-panel-enter cc-card-interactive flex flex-col justify-between overflow-hidden rounded-2xl border border-ink/10 bg-panel hover:border-ink/22 ${
                  newlyReadyIds[project.id] ? "cc-status-ready-flash" : ""
                }`}
              >
                {/* Project Visual Poster / Intentional Placeholder */}
                <div className="relative h-40 w-full overflow-hidden border-b border-ink/8 bg-inset">
                  {isAudio ? (
                    <div
                      data-testid={`project-audio-artwork-${project.id}`}
                      className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-demo-frame/45 to-inset px-4"
                    >
                      <div className="flex items-end gap-1.5">
                        {[14, 28, 42, 22, 48, 34, 20, 38, 26, 16].map((h, i) => (
                          <span
                            key={i}
                            style={{ height: `${h}px` }}
                            className={`w-1.5 rounded-full ${
                              i % 3 === 1 ? "bg-accent" : "bg-ink/25"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-panel/90 px-2.5 py-0.5 text-[11px] font-medium text-ink-secondary">
                        <AudioLines className="h-3 w-3 text-accent" />
                        <span>Audio · 9:16 Stage</span>
                      </span>
                    </div>
                  ) : project.thumbnail_url && !thumbFailed ? (
                    <div
                      data-testid={`project-video-thumbnail-${project.id}`}
                      className="relative flex h-full w-full items-center justify-center bg-inset"
                    >
                      <video
                        src={`${project.thumbnail_url}#t=0.5`}
                        muted
                        playsInline
                        preload="metadata"
                        aria-hidden="true"
                        onError={() =>
                          setFailedThumbIds((prev) => ({
                            ...prev,
                            [project.id]: true,
                          }))
                        }
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-page/75 via-transparent to-page/25" />
                    </div>
                  ) : (
                    <div
                      data-testid={`project-placeholder-${project.id}`}
                      className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-elevated/70 to-inset px-4 text-center text-ink-muted"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink/12 bg-panel text-ink-secondary">
                        {stage.kind === "failed" ? (
                          <AlertCircle className="h-5 w-5 text-rose-300" />
                        ) : stage.spinning ? (
                          <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        ) : (
                          <Film className="h-5 w-5" />
                        )}
                      </span>
                      <span className="mt-2 text-[11px] font-medium text-ink-secondary">
                        {thumbFailed
                          ? "Preview unavailable"
                          : stage.kind === "queued"
                            ? "Waiting for worker"
                            : stage.kind === "transcribing"
                              ? "Generating preview..."
                              : stage.kind === "failed"
                                ? "Processing stopped"
                                : "Video clip"}
                      </span>
                    </div>
                  )}

                  <span
                    data-testid={`project-stage-${project.id}`}
                    className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md ${badgeClass}`}
                  >
                    {stage.spinning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : stage.tone === "accent" ? (
                      <CheckCircle2 className="h-3 w-3 text-accent" />
                    ) : stage.tone === "rose" ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    <span>{stage.label}</span>
                  </span>

                  {durationSec && (
                    <span
                      data-testid={`project-duration-${project.id}`}
                      className="absolute bottom-2.5 right-3 rounded-md border border-ink/15 bg-page/85 px-2 py-0.5 font-mono text-[11px] tabular-nums text-ink"
                    >
                      {durationSec}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
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
                            className="w-full rounded-lg border border-accent bg-inset px-2.5 py-1.5 text-sm text-ink focus:outline-none"
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h2 className="truncate text-sm font-semibold tracking-tight text-ink">
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
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                          {lastEditedLabel && (
                            <p
                              data-testid={`project-updated-${project.id}`}
                              className="mt-0.5 text-[11px] text-ink-muted"
                            >
                              {lastEditedLabel}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {(job?.error_message || project.last_error_message) &&
                      (job?.status === "failed" || project.status === "failed") && (
                        <p className="mt-2.5 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                          {job?.error_message || project.last_error_message}
                        </p>
                      )}
                  </div>

                  {/* Strictly ONE Primary Action per Project Card */}
                  <div
                    data-testid={`project-primary-actions-${project.id}`}
                    className="mt-4 flex items-center justify-between gap-2"
                  >
                    {isReadyForEditor ? (
                      <Link
                        href={`/projects/${project.id}/editor`}
                        prefetch={false}
                        onClick={() => setOpeningEditorId(project.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-page transition hover:bg-accent-hover"
                      >
                        {openingEditorId === project.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Pencil className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {openingEditorId === project.id
                            ? "Opening..."
                            : "Open editor"}
                        </span>
                      </Link>
                    ) : canStartProcessing ? (
                      <button
                        type="button"
                        disabled={startingId === project.id}
                        onClick={() => void startProcessing(project.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-page transition hover:bg-accent-hover disabled:opacity-60"
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
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-ink/12 bg-inset px-3.5 py-2 text-xs font-medium text-ink-secondary">
                        {stage.kind === "queued" ? (
                          <Clock className="h-3.5 w-3.5 text-amber-300" />
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                        )}
                        <span>
                          {primaryAsset?.status !== "uploaded"
                            ? "Uploading clip..."
                            : stage.kind === "queued"
                              ? "Waiting to transcribe"
                              : "Transcribing..."}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Collapsible Technical & Media Details */}
                  {primaryAsset && (
                    <details
                      data-testid={`project-details-${project.id}`}
                      className="group mt-3.5 border-t border-ink/8 pt-2.5"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-ink-secondary transition hover:text-ink [&::-webkit-details-marker]:hidden">
                        <span>Details</span>
                        <ChevronDown className="h-3.5 w-3.5 text-ink-muted transition-transform group-open:rotate-180" />
                      </summary>

                      <dl className="cc-details-body mt-2.5 grid grid-cols-2 gap-2.5 rounded-xl border border-ink/8 bg-inset p-3 text-xs">
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
                        <div className="col-span-2 flex items-center justify-between gap-2 border-t border-ink/8 pt-2">
                          <div className="min-w-0">
                            <dt className="text-ink-muted">Revision &amp; source</dt>
                            <dd className="mt-0.5 truncate font-mono text-[11px] text-ink-secondary">
                              {revision
                                ? `Rev #${revision.revision_number} · ${revision.source}`
                                : stage.spinning
                                  ? "Processing in worker"
                                  : "Ready for processing"}
                            </dd>
                          </div>

                          {isAssetUploaded && (
                            <button
                              type="button"
                              disabled={loadingAssetId === primaryAsset.id}
                              onClick={() =>
                                void openPreview(primaryAsset.id, project, revision)
                              }
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink/12 bg-panel px-2.5 py-1 text-[11px] font-medium text-ink-secondary transition hover:border-ink/25 hover:text-ink disabled:opacity-60"
                            >
                              {loadingAssetId === primaryAsset.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ExternalLink className="h-3 w-3" />
                              )}
                              <span>Preview clip</span>
                            </button>
                          )}
                        </div>
                      </dl>
                    </details>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Owner-only Signed Media Preview Modal */}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${preview.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="cc-modal-enter w-full max-w-md rounded-2xl border border-ink/15 bg-panel p-4 shadow-2xl">
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
                                  ? {
                                      backgroundColor: previewLayout.activeWordColor,
                                      color: previewLayout.activeWordContrastText,
                                    }
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
                                ? {
                                    backgroundColor: previewLayout.activeWordColor,
                                    color: previewLayout.activeWordContrastText,
                                  }
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
