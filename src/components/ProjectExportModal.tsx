"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Film,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import {
  EXPORT_FORMATS,
  type ExportFormat,
  type ExportJobRow,
} from "@/lib/exports";
import { formatBytes } from "@/lib/uploads";

interface ProjectExportModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  mediaKind: "video" | "audio";
  savedRevisionId: string | null;
  savedRevisionNumber: number;
  hasUnsavedChanges: boolean;
  saveStatus: "saved" | "saving" | "error" | "conflict";
}

function FormatIcon({ format }: { format: ExportFormat }) {
  if (format === "srt") return <FileText className="h-4 w-4 text-accent" />;
  if (format === "mp4") return <Film className="h-4 w-4 text-accent" />;
  return <Layers className="h-4 w-4 text-accent" />;
}

function StatusBadge({ job }: { job: ExportJobRow }) {
  if (job.status === "queued") {
    return (
      <span
        data-testid={`export-status-${job.format}`}
        data-status="queued"
        className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200"
      >
        <Clock className="h-3 w-3" />
        <span>Queued</span>
      </span>
    );
  }
  if (job.status === "rendering") {
    return (
      <span
        data-testid={`export-status-${job.format}`}
        data-status="rendering"
        className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Rendering</span>
      </span>
    );
  }
  if (job.status === "ready") {
    return (
      <span
        data-testid={`export-status-${job.format}`}
        data-status="ready"
        className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent-hover"
      >
        <CheckCircle2 className="h-3 w-3" />
        <span>Ready</span>
      </span>
    );
  }
  return (
    <span
      data-testid={`export-status-${job.format}`}
      data-status="failed"
      className="inline-flex items-center gap-1 rounded-full border border-rose-400/35 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200"
    >
      <AlertCircle className="h-3 w-3" />
      <span>Failed</span>
    </span>
  );
}

export function ProjectExportModal({
  open,
  onClose,
  projectId,
  projectTitle,
  mediaKind,
  savedRevisionId,
  savedRevisionNumber,
  hasUnsavedChanges,
  saveStatus,
}: ProjectExportModalProps) {
  const [jobs, setJobs] = useState<ExportJobRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [requestingFormat, setRequestingFormat] = useState<ExportFormat | null>(
    null
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchExports = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/exports`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.exports)) {
        setJobs(data.exports as ExportJobRow[]);
      }
    } catch {
      // Transient poll error; will retry next cycle
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    setLoadingList(true);
    setError(null);
    void fetchExports().finally(() => setLoadingList(false));
  }, [open, fetchExports]);

  const hasActiveJobs = useMemo(
    () =>
      jobs.some((j) => j.status === "queued" || j.status === "rendering"),
    [jobs]
  );

  // Poll while modal is open and any video render is queued/rendering
  useEffect(() => {
    if (!open || !hasActiveJobs) return;
    const timer = setInterval(() => {
      void fetchExports();
    }, 2000);
    return () => clearInterval(timer);
  }, [open, hasActiveJobs, fetchExports]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const currentRevJobsByFormat = useMemo(() => {
    const map: Partial<Record<ExportFormat, ExportJobRow>> = {};
    if (!savedRevisionId) return map;
    for (const job of jobs) {
      if (job.revision_id === savedRevisionId && !map[job.format]) {
        map[job.format] = job;
      }
    }
    return map;
  }, [jobs, savedRevisionId]);

  const previousRevJobs = useMemo(() => {
    if (!savedRevisionId) return jobs;
    return jobs.filter((j) => j.revision_id !== savedRevisionId);
  }, [jobs, savedRevisionId]);

  const requestExport = async (format: ExportFormat) => {
    if (hasUnsavedChanges || !savedRevisionId) return;
    setRequestingFormat(format);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revisionId: savedRevisionId,
          format,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not start export.");
        return;
      }

      const nextJob = data.job as ExportJobRow;
      setJobs((prev) => {
        const filtered = prev.filter((j) => j.id !== nextJob.id);
        return [nextJob, ...filtered];
      });
    } catch {
      setError("Network error while requesting export.");
    } finally {
      setRequestingFormat(null);
    }
  };

  const downloadExport = async (job: ExportJobRow) => {
    setDownloadingId(job.id);
    setError(null);

    try {
      const res = await fetch(`/api/exports/${job.id}/download`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.signedUrl) {
        setError(data.error || "Could not create short-lived download link.");
        return;
      }

      const link = document.createElement("a");
      link.href = data.signedUrl as string;
      link.download = (data.filename as string) || job.output_filename || "export";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("Network error while downloading export.");
    } finally {
      setDownloadingId(null);
    }
  };

  if (!open) return null;

  const canExportCurrentDraft = !hasUnsavedChanges && Boolean(savedRevisionId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export captions and video"
      data-testid="export-modal"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-ink/15 bg-panel p-4 shadow-[0_24px_80px_rgba(0,0,0,0.75)] sm:rounded-2xl sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 pb-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-ink">
                Export Project
              </h2>
              <span
                data-testid="export-bound-revision"
                className="rounded-full border border-accent/40 bg-accent-soft px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-accent-hover"
              >
                {savedRevisionId
                  ? `Saved Rev #${savedRevisionNumber}`
                  : "No saved revision"}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-ink-secondary">
              {projectTitle} ·{" "}
              {mediaKind === "audio"
                ? "Audio-only 9:16 portrait stage"
                : "Preserves source aspect ratio"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink/12 bg-page text-ink-secondary transition hover:border-accent/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Unsaved Draft Notice */}
        {!canExportCurrentDraft && (
          <div
            role="alert"
            data-testid="export-unsaved-notice"
            className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-3 text-xs text-amber-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="font-semibold">
                Save your current draft before exporting
              </p>
              <p className="mt-0.5 leading-relaxed text-amber-200/85">
                {saveStatus === "saving"
                  ? "Autosave is still saving your latest edits. Once the header shows Saved, exports will bind to that new saved revision."
                  : saveStatus === "conflict"
                    ? "Resolve the save conflict in the editor first so your export binds to a confirmed saved revision."
                    : saveStatus === "error"
                      ? "Your latest edits have not been saved yet. Fix or retry saving before exporting."
                      : "This project needs a saved caption revision before exporting."}
              </p>
            </div>
          </div>
        )}

        {/* API / Download Error */}
        {error && (
          <div
            role="alert"
            data-testid="export-error-banner"
            className="mt-3.5 flex items-start gap-2 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Three Export Formats bound to current saved revision */}
        <div className="mt-4 flex flex-col gap-2.5">
          {EXPORT_FORMATS.map((fmt) => {
            const job = currentRevJobsByFormat[fmt.id] ?? null;
            const isRequesting = requestingFormat === fmt.id;
            const isDownloading = Boolean(job && downloadingId === job.id);
            const isBusy =
              isRequesting ||
              job?.status === "queued" ||
              job?.status === "rendering";

            return (
              <div
                key={fmt.id}
                data-testid={`export-format-${fmt.id}`}
                data-revision-number={String(savedRevisionNumber)}
                className="rounded-xl border border-ink/10 bg-inset p-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft">
                      <FormatIcon format={fmt.id} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm font-semibold text-ink">
                          {fmt.label}
                        </h3>
                        <span className="rounded-md border border-ink/10 bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary">
                          {fmt.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                        {fmt.id === "mp4" && mediaKind === "audio"
                          ? "9:16 portrait stage with your styled captions burned in and source audio preserved."
                          : fmt.description}
                      </p>
                    </div>
                  </div>

                  {/* Action / State */}
                  <div className="flex shrink-0 items-center gap-2">
                    {job && <StatusBadge job={job} />}

                    {!job && (
                      <button
                        type="button"
                        disabled={!canExportCurrentDraft || isRequesting}
                        data-testid={`export-trigger-${fmt.id}`}
                        onClick={() => void requestExport(fmt.id)}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-page transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {isRequesting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        <span>Export {fmt.extension.toUpperCase().slice(1)}</span>
                      </button>
                    )}

                    {job?.status === "ready" && (
                      <button
                        type="button"
                        disabled={isDownloading}
                        data-testid={`export-download-${fmt.id}`}
                        onClick={() => void downloadExport(job)}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-page transition hover:bg-accent-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {isDownloading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        <span>Download</span>
                      </button>
                    )}

                    {job?.status === "failed" && (
                      <button
                        type="button"
                        disabled={!canExportCurrentDraft || isRequesting}
                        data-testid={`export-retry-${fmt.id}`}
                        onClick={() => void requestExport(fmt.id)}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-ink/15 bg-elevated px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent/55 hover:text-accent-hover disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {isRequesting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress / Metadata / Failure subline */}
                {job && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-ink/8 pt-2 text-[11px] text-ink-muted">
                    <span className="font-mono tabular-nums">
                      Rev #{job.revision_number}
                      {job.output_width && job.output_height
                        ? ` · ${job.output_width}×${job.output_height}`
                        : ""}
                      {job.output_size_bytes
                        ? ` · ${formatBytes(job.output_size_bytes)}`
                        : ""}
                    </span>

                    <span className="truncate">
                      {job.status === "failed"
                        ? job.error_message || "Render failed"
                        : isBusy
                          ? job.stage_message || "Working..."
                          : "Private short-lived download (60s)"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Earlier Revision Exports (immutable history) */}
        {previousRevJobs.length > 0 && (
          <div
            data-testid="export-history-section"
            className="mt-4 border-t border-ink/10 pt-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Earlier Saved Revisions
              </h3>
              <span className="text-[11px] text-ink-muted">
                Immutable snapshots
              </span>
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              {previousRevJobs.map((job) => (
                <div
                  key={job.id}
                  data-testid={`export-history-item-${job.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/8 bg-page/80 px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-secondary">
                      Rev #{job.revision_number}
                    </span>
                    <span className="font-medium text-ink">
                      {job.format === "srt"
                        ? "SRT"
                        : job.format === "mp4"
                          ? "MP4"
                          : "Transparent MOV"}
                    </span>
                    {job.output_size_bytes && (
                      <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                        {formatBytes(job.output_size_bytes)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge job={job} />
                    {job.status === "ready" && (
                      <button
                        type="button"
                        disabled={downloadingId === job.id}
                        onClick={() => void downloadExport(job)}
                        className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent-hover transition hover:bg-accent hover:text-page"
                      >
                        <Download className="h-3 w-3" />
                        <span>Download</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingList && jobs.length === 0 && (
          <p className="mt-3 text-center text-xs text-ink-muted">
            Loading export status...
          </p>
        )}
      </div>
    </div>
  );
}
