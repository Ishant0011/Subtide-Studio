"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Film,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import {
  computeDisplaySourceDimensions,
  formatResolutionTierLabel,
  getDefaultResolutionTier,
  getResolutionOptionsForSource,
  type ExportJobRow,
  type ExportResolutionTier,
} from "@/lib/exports";
import { formatBytes } from "@/lib/uploads";

interface ProjectExportModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  mediaKind: "video" | "audio";
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  sourceRotationDeg?: number | null;
  savedRevisionId: string | null;
  savedRevisionNumber: number;
  hasUnsavedChanges: boolean;
  saveStatus: "saved" | "saving" | "error" | "conflict";
  jobs: ExportJobRow[];
  loadingList: boolean;
  onJobsUpdated: (nextJobs: ExportJobRow[]) => void;
  onRefreshJobs: () => Promise<void>;
}

function StatusBadge({
  job,
  testIdPrefix,
}: {
  job: ExportJobRow;
  testIdPrefix?: string;
}) {
  const testId = testIdPrefix
    ? `${testIdPrefix}-${job.resolution_tier || job.format}`
    : undefined;

  if (job.status === "queued") {
    return (
      <span
        data-testid={testId}
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
        data-testid={testId}
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
        data-testid={testId}
        data-status="ready"
        className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent-hover"
      >
        <CheckCircle2 className="h-3 w-3" />
        <span>Ready to download</span>
      </span>
    );
  }
  return (
    <span
      data-testid={testId}
      data-status="failed"
      className="inline-flex items-center gap-1 rounded-full border border-rose-400/35 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200"
    >
      <AlertCircle className="h-3 w-3" />
      <span>Failed</span>
    </span>
  );
}

function getActionableFailureText(job: ExportJobRow): string {
  if (job.error_code === "bounds_exceeded") {
    return (
      job.error_message ||
      "This resolution exceeded worker output limits. Try a lower resolution tier."
    );
  }
  if (job.error_code === "corrupt_media") {
    return (
      job.error_message ||
      "Source media could not be read cleanly for rendering. Try re-uploading the clip."
    );
  }
  if (job.error_code === "storage_error") {
    return (
      job.error_message ||
      "Temporary storage error while reading or saving the MP4. Click Retry to run again."
    );
  }
  return (
    job.error_message ||
    "MP4 rendering stopped unexpectedly. Click Retry to re-queue the same export job."
  );
}

export function ProjectExportModal({
  open,
  onClose,
  projectId,
  projectTitle,
  mediaKind,
  sourceWidth = null,
  sourceHeight = null,
  sourceRotationDeg = 0,
  savedRevisionId,
  savedRevisionNumber,
  hasUnsavedChanges,
  saveStatus,
  jobs,
  loadingList,
  onJobsUpdated,
  onRefreshJobs,
}: ProjectExportModalProps) {
  const resolutionOptions = useMemo(
    () =>
      getResolutionOptionsForSource({
        mediaKind,
        sourceWidth,
        sourceHeight,
        sourceRotationDeg,
      }),
    [mediaKind, sourceWidth, sourceHeight, sourceRotationDeg]
  );

  const defaultTier = useMemo(
    () => getDefaultResolutionTier(resolutionOptions),
    [resolutionOptions]
  );

  const displaySource = useMemo(
    () =>
      computeDisplaySourceDimensions({
        mediaKind,
        sourceWidth,
        sourceHeight,
        sourceRotationDeg,
      }),
    [mediaKind, sourceWidth, sourceHeight, sourceRotationDeg]
  );

  const [selectedTier, setSelectedTier] =
    useState<ExportResolutionTier>(defaultTier);
  const [requestingTier, setRequestingTier] =
    useState<ExportResolutionTier | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Sync default tier when source options change
  useEffect(() => {
    const currentOpt = resolutionOptions.find(
      (o) => o.tier === selectedTier && o.enabled
    );
    if (!currentOpt) {
      setSelectedTier(defaultTier);
    }
  }, [resolutionOptions, selectedTier, defaultTier]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void onRefreshJobs();
  }, [open, onRefreshJobs]);

  // Tick every 2s while open and any job is queued so long-queue wait notice updates accurately
  const hasQueuedJob = useMemo(
    () => jobs.some((j) => j.status === "queued"),
    [jobs]
  );
  useEffect(() => {
    if (!open || !hasQueuedJob) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 2000);
    return () => clearInterval(timer);
  }, [open, hasQueuedJob]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const currentRevMp4JobsByTier = useMemo(() => {
    const map: Partial<Record<ExportResolutionTier, ExportJobRow>> = {};
    if (!savedRevisionId) return map;
    for (const job of jobs) {
      if (job.revision_id === savedRevisionId && job.format === "mp4") {
        const tier = (job.resolution_tier || "1080p") as ExportResolutionTier;
        if (!map[tier]) map[tier] = job;
      }
    }
    return map;
  }, [jobs, savedRevisionId]);

  const selectedOption = useMemo(
    () =>
      resolutionOptions.find((o) => o.tier === selectedTier) ??
      resolutionOptions.find((o) => o.enabled) ??
      resolutionOptions[0],
    [resolutionOptions, selectedTier]
  );

  const selectedTierJob = currentRevMp4JobsByTier[selectedTier] ?? null;

  // All other jobs (other tiers on current rev + earlier revisions + any legacy SRT/MOV history)
  const historyJobs = useMemo(() => {
    return jobs.filter((j) => j.id !== selectedTierJob?.id);
  }, [jobs, selectedTierJob?.id]);

  const requestMp4Export = async (tier: ExportResolutionTier) => {
    if (hasUnsavedChanges || !savedRevisionId) return;
    setRequestingTier(tier);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revisionId: savedRevisionId,
          format: "mp4",
          resolutionTier: tier,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not start MP4 export.");
        return;
      }

      const nextJob = data.job as ExportJobRow;
      onJobsUpdated([nextJob, ...jobs.filter((j) => j.id !== nextJob.id)]);
    } catch {
      setError("Network error while requesting MP4 export.");
    } finally {
      setRequestingTier(null);
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
      link.download =
        (data.filename as string) || job.output_filename || "clipcaptions.mp4";
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
  const queuedSeconds =
    selectedTierJob?.status === "queued"
      ? Math.max(
          0,
          Math.floor(
            (nowMs - new Date(selectedTierJob.updated_at).getTime()) / 1000
          )
        )
      : 0;
  const isLongQueueWait =
    selectedTierJob?.status === "queued" && queuedSeconds >= 10;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export video"
      data-testid="export-modal"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none sm:items-center sm:p-4"
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
                Export video
              </h2>
              <span
                data-testid="export-bound-revision"
                className="rounded-full border border-ink/15 bg-inset px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-ink-secondary"
              >
                {savedRevisionId
                  ? `Saved Rev #${savedRevisionNumber}`
                  : "No saved revision"}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-ink-secondary">
              {projectTitle} ·{" "}
              {mediaKind === "audio"
                ? "Audio-only 9:16 portrait MP4"
                : `Source ${displaySource.width}×${displaySource.height} · H.264 MP4`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink/12 bg-inset text-ink-secondary transition hover:border-ink/30 hover:text-ink"
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
                  ? "Autosave is still saving your latest edits. Once the header shows Saved, exports will bind to that revision."
                  : saveStatus === "conflict"
                    ? "Resolve the save conflict in the editor first so your export binds to a confirmed saved revision."
                    : saveStatus === "error"
                      ? "Your latest edits have not been saved yet. Retry saving before exporting."
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

        {/* MP4 Resolution Selector */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink">
              MP4 Resolution
            </span>
            <span className="text-[11px] text-ink-muted">
              Preserves aspect ratio &amp; audio
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="MP4 output resolution"
            data-testid="export-resolution-list"
            className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2"
          >
            {resolutionOptions.map((opt) => {
              const isSelected = selectedTier === opt.tier;
              const tierJob = currentRevMp4JobsByTier[opt.tier] ?? null;

              return (
                <button
                  key={opt.tier}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={!opt.enabled}
                  data-testid={`export-tier-${opt.tier}`}
                  data-enabled={opt.enabled ? "true" : "false"}
                  data-dimensions={`${opt.width}x${opt.height}`}
                  onClick={() => opt.enabled && setSelectedTier(opt.tier)}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
                    !opt.enabled
                      ? "cursor-not-allowed border-ink/8 bg-inset/50 opacity-50"
                      : isSelected
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-ink/10 bg-inset text-ink hover:border-ink/25"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-semibold ${
                          isSelected ? "text-accent-hover" : "text-ink"
                        }`}
                      >
                        {opt.label}
                      </span>
                      {tierJob && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            tierJob.status === "ready"
                              ? "bg-accent text-page"
                              : tierJob.status === "failed"
                                ? "bg-rose-500/20 text-rose-200"
                                : "bg-amber-400/15 text-amber-200"
                          }`}
                        >
                          {tierJob.status === "ready"
                            ? "Ready"
                            : tierJob.status === "rendering"
                              ? "Rendering"
                              : tierJob.status === "failed"
                                ? "Failed"
                                : "Queued"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-ink-muted">
                      {opt.enabled
                        ? `${opt.width} × ${opt.height} px`
                        : opt.disabledReason}
                    </p>
                  </div>

                  {opt.enabled && (
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-secondary">
                      {opt.width}×{opt.height}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Resolution Action & Live Status Card */}
        {selectedOption && (
          <div
            data-testid="export-selected-tier-card"
            data-selected-tier={selectedOption.tier}
            className="mt-4 rounded-xl border border-ink/12 bg-inset p-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink/12 bg-panel text-accent">
                  <Film className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    MP4 · {selectedOption.label}
                  </p>
                  <p className="font-mono text-[11px] tabular-nums text-ink-secondary">
                    {selectedOption.width}×{selectedOption.height} · Rev #
                    {savedRevisionNumber}
                    {selectedTierJob?.output_size_bytes
                      ? ` · ${formatBytes(selectedTierJob.output_size_bytes)}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {selectedTierJob && (
                  <StatusBadge
                    job={selectedTierJob}
                    testIdPrefix="export-status"
                  />
                )}

                {!selectedTierJob && (
                  <button
                    type="button"
                    disabled={
                      !canExportCurrentDraft ||
                      !selectedOption.enabled ||
                      requestingTier !== null
                    }
                    data-testid="export-trigger-mp4"
                    onClick={() => void requestMp4Export(selectedOption.tier)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-page transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {requestingTier === selectedOption.tier ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>Export MP4</span>
                  </button>
                )}

                {selectedTierJob?.status === "ready" && (
                  <button
                    type="button"
                    disabled={downloadingId === selectedTierJob.id}
                    data-testid="export-download-mp4"
                    onClick={() => void downloadExport(selectedTierJob)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-page transition hover:bg-accent-hover disabled:opacity-60"
                  >
                    {downloadingId === selectedTierJob.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>Download MP4</span>
                  </button>
                )}

                {selectedTierJob?.status === "failed" && (
                  <button
                    type="button"
                    disabled={
                      !canExportCurrentDraft || requestingTier !== null
                    }
                    data-testid="export-retry-mp4"
                    onClick={() => void requestMp4Export(selectedOption.tier)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-ink/15 bg-elevated px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-accent/55 hover:text-accent-hover disabled:opacity-45"
                  >
                    {requestingTier === selectedOption.tier ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    <span>Retry</span>
                  </button>
                )}
              </div>
            </div>

            {/* Measured Status Detail / Long Queue Wait Explanation / Actionable Failure */}
            {selectedTierJob && (
              <div className="mt-2.5 border-t border-ink/8 pt-2.5 text-xs">
                {selectedTierJob.status === "queued" && (
                  <div className="space-y-1 text-ink-secondary">
                    <p>
                      {selectedTierJob.stage_message ||
                        "Queued for MP4 render."}
                    </p>
                    {isLongQueueWait && (
                      <p
                        data-testid="export-long-queue-note"
                        className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-200"
                      >
                        Rendering has not started yet ({queuedSeconds}s in
                        queue). Your job is saved and will begin as soon as a
                        render worker claims it — you can close this dialog and
                        keep editing.
                      </p>
                    )}
                  </div>
                )}

                {selectedTierJob.status === "rendering" && (
                  <p className="text-ink-secondary">
                    {selectedTierJob.stage_message ||
                      "Rendering MP4 with burned-in captions..."}{" "}
                    You can close this dialog; status stays visible in the
                    editor header.
                  </p>
                )}

                {selectedTierJob.status === "ready" && (
                  <p className="text-ink-secondary">
                    Ready to download · Private 60-second signed link · Bound to
                    Rev #{selectedTierJob.revision_number}.
                  </p>
                )}

                {selectedTierJob.status === "failed" && (
                  <p
                    data-testid="export-failure-detail"
                    className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200"
                  >
                    {getActionableFailureText(selectedTierJob)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Export History (Other Tiers + Earlier Revisions + Preserved Legacy SRT/MOV Artifacts) */}
        {historyJobs.length > 0 && (
          <div
            data-testid="export-history-section"
            className="mt-4 border-t border-ink/10 pt-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Saved Exports
              </h3>
              <span className="text-[11px] text-ink-muted">
                Pinned to saved revisions
              </span>
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              {historyJobs.map((job) => (
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
                      {job.format === "mp4"
                        ? `MP4 · ${formatResolutionTierLabel(job.resolution_tier)}`
                        : job.format === "srt"
                          ? "SRT (legacy)"
                          : "Transparent MOV (legacy)"}
                    </span>
                    {job.output_width && job.output_height && (
                      <span className="font-mono text-[10px] tabular-nums text-ink-muted">
                        {job.output_width}×{job.output_height}
                      </span>
                    )}
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
                        className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-panel px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:border-accent/55 hover:text-accent-hover"
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
