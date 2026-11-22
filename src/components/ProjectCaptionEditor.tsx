"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Captions,
  CheckCircle2,
  Download,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  findActiveEditorCue,
  findActiveEditorWord,
  formatMsClock,
  hydrateEditorCues,
  normalizeCaptionStyle,
  reconcileCueWords,
  validateCaptionRevisionInput,
  type CaptionStyleConfig,
  type EditorCue,
} from "@/lib/caption-editor";
import { AccountMenu } from "@/components/AccountMenu";
import { EditorCaptionOverlay } from "@/components/EditorCaptionOverlay";
import { ProjectExportModal } from "@/components/ProjectExportModal";
import { StudioStylePanel } from "@/components/StudioStylePanel";
import { StudioTabs, type StudioMobileTab } from "@/components/StudioTabs";

type SaveStatus = "saved" | "saving" | "error" | "conflict";

interface ConflictRevisionPayload {
  id: string;
  revision_number: number;
  style?: Partial<CaptionStyleConfig> | null;
  cues?: unknown;
}

interface ProjectCaptionEditorProps {
  userEmail: string;
  projectId: string;
  projectTitle: string;
  mediaKind: "video" | "audio";
  previewUrl: string;
  durationMs: number;
  initialRevisionId: string | null;
  initialRevisionNumber: number;
  initialCues: EditorCue[];
  initialStyle: CaptionStyleConfig;
}

export function ProjectCaptionEditor({
  userEmail,
  projectId,
  projectTitle,
  mediaKind,
  previewUrl,
  durationMs,
  initialRevisionId,
  initialRevisionNumber,
  initialCues,
  initialStyle,
}: ProjectCaptionEditorProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(
    initialCues[0] ? initialCues[0].start_ms : 0
  );
  const [clipDurationMs, setClipDurationMs] = useState(
    durationMs > 0 ? durationMs : 15000
  );
  const [hasInitializedSeek, setHasInitializedSeek] = useState(false);
  const [mobileTab, setMobileTab] = useState<StudioMobileTab>("captions");

  const [cues, setCues] = useState<EditorCue[]>(initialCues);
  const [style, setStyle] = useState<CaptionStyleConfig>(initialStyle);
  const [revisionNumber, setRevisionNumber] = useState(initialRevisionNumber);
  const [savedRevisionId, setSavedRevisionId] = useState<string | null>(
    initialRevisionId
  );
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Concurrency & autosave refs
  const baseRevisionIdRef = useRef<string | null>(initialRevisionId);
  const localVersionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const inFlightRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCuesRef = useRef<EditorCue[]>(initialCues);
  const latestStyleRef = useRef<CaptionStyleConfig>(initialStyle);
  const saveStatusRef = useRef<SaveStatus>("saved");

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictRevision, setConflictRevision] =
    useState<ConflictRevisionPayload | null>(null);

  const setSaveStatusSynced = useCallback((next: SaveStatus) => {
    saveStatusRef.current = next;
    setSaveStatus(next);
  }, []);

  useEffect(() => {
    latestCuesRef.current = cues;
  }, [cues]);

  useEffect(() => {
    latestStyleRef.current = style;
  }, [style]);

  const activeCue = useMemo(
    () => findActiveEditorCue(cues, currentTimeMs),
    [cues, currentTimeMs]
  );
  const activeCueIndex = useMemo(
    () => (activeCue ? cues.findIndex((c) => c.id === activeCue.id) : -1),
    [activeCue, cues]
  );
  const activeWord = useMemo(
    () => findActiveEditorWord(activeCue, currentTimeMs),
    [activeCue, currentTimeMs]
  );
  const activePresetShortLabel = useMemo(() => {
    if (style.preset === "word-highlight") return "Highlight";
    if (style.preset === "boxed") return "Boxed";
    return "Clean";
  }, [style.preset]);

  const clientValidation = useMemo(
    () =>
      validateCaptionRevisionInput({
        cues,
        style,
        durationMs: clipDurationMs,
      }),
    [cues, style, clipDurationMs]
  );

  // 60fps media clock sync while playing (does not alter keyboard focus)
  useEffect(() => {
    if (!isPlaying) return;
    let frameId = 0;
    const tick = () => {
      const el = mediaRef.current;
      if (el) {
        setCurrentTimeMs(Math.round(el.currentTime * 1000));
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const seekToMs = useCallback(
    (nextMs: number) => {
      const clamped = Math.max(0, Math.min(clipDurationMs, Math.round(nextMs)));
      const el = mediaRef.current;
      if (el) {
        el.currentTime = clamped / 1000;
      }
      setCurrentTimeMs(clamped);
    },
    [clipDurationMs]
  );

  const togglePlay = useCallback(async () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      if (el.ended || el.currentTime * 1000 >= clipDurationMs - 50) {
        el.currentTime = 0;
        setCurrentTimeMs(0);
      }
      try {
        await el.play();
      } catch {
        el.muted = true;
        setIsMuted(true);
        await el.play().catch(() => {});
      }
    } else {
      el.pause();
    }
  }, [clipDurationMs]);

  const toggleMute = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setIsMuted(el.muted);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setClipDurationMs(Math.round(el.duration * 1000));
    }
    if (!hasInitializedSeek && initialCues[0]) {
      el.currentTime = initialCues[0].start_ms / 1000;
      setCurrentTimeMs(initialCues[0].start_ms);
      setHasInitializedSeek(true);
    }
  }, [hasInitializedSeek, initialCues]);

  const handleTimeUpdate = useCallback(() => {
    const el = mediaRef.current;
    if (el) {
      setCurrentTimeMs(Math.round(el.currentTime * 1000));
    }
  }, []);

  // Keyboard shortcuts when focus is outside interactive controls
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "BUTTON" ||
          target.tagName === "SELECT" ||
          target.tagName === "A" ||
          target.getAttribute("role") === "tab" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        void togglePlay();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekToMs(currentTimeMs - 1000);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        seekToMs(currentTimeMs + 1000);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentTimeMs, seekToMs, togglePlay]);

  // Core save runner preserving newer local edits across in-flight saves, conflicts, and failures
  const performSave = useCallback(async () => {
    if (inFlightRef.current) return;

    const snapshotVersion = localVersionRef.current;
    const snapshotCues = latestCuesRef.current;
    const snapshotStyle = latestStyleRef.current;

    const check = validateCaptionRevisionInput({
      cues: snapshotCues,
      style: snapshotStyle,
      durationMs: clipDurationMs,
    });

    if (!check.ok) {
      setSaveStatusSynced("error");
      setSaveError(check.error);
      return;
    }

    inFlightRef.current = true;
    setSaveStatusSynced("saving");
    setSaveError(null);
    let didSucceed = false;

    try {
      const res = await fetch(`/api/projects/${projectId}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseRevisionId: baseRevisionIdRef.current,
          cues: check.normalizedCues,
          style: check.normalizedStyle,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // Stale base revision: keep local edits untouched and surface conflict resolution
        setConflictRevision(
          (data.currentRevision as ConflictRevisionPayload | null) ?? null
        );
        setSaveStatusSynced("conflict");
        setSaveError(
          data.error || "This project was updated in another tab."
        );
        return;
      }

      if (!res.ok) {
        setSaveStatusSynced("error");
        setSaveError(data.error || `Save failed (HTTP ${res.status}).`);
        return;
      }

      const savedRev = data.revision as {
        id: string;
        revision_number: number;
      };
      baseRevisionIdRef.current = savedRev.id;
      savedVersionRef.current = snapshotVersion;
      didSucceed = true;
      setSavedRevisionId(savedRev.id);
      setRevisionNumber(savedRev.revision_number);
      setConflictRevision(null);

      // If newer local edits arrived while this save was in flight, keep them and save again
      if (localVersionRef.current > snapshotVersion) {
        setSaveStatusSynced("saving");
      } else {
        setSaveStatusSynced("saved");
      }
    } catch {
      setSaveStatusSynced("error");
      setSaveError(
        "Network error while saving. Your local edits are preserved."
      );
    } finally {
      inFlightRef.current = false;
      if (
        didSucceed &&
        localVersionRef.current > savedVersionRef.current &&
        saveStatusRef.current !== "conflict"
      ) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          void performSave();
        }, 350);
      }
    }
  }, [clipDurationMs, projectId, setSaveStatusSynced]);

  const scheduleAutosave = useCallback(() => {
    localVersionRef.current += 1;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    // Do not auto-overwrite a conflict; user explicitly chooses Reload or Save as new
    if (saveStatusRef.current === "conflict") {
      return;
    }
    setSaveStatusSynced("saving");
    setSaveError(null);
    debounceTimerRef.current = setTimeout(() => {
      void performSave();
    }, 650);
  }, [performSave, setSaveStatusSynced]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const updateCueText = (cueId: string, nextText: string) => {
    setCues((prev) =>
      prev.map((cue) => {
        if (cue.id !== cueId) return cue;
        const reconciled = reconcileCueWords(
          cue,
          nextText,
          cue.start_ms,
          cue.end_ms
        );
        return {
          ...cue,
          text: nextText,
          words: reconciled.words,
          timing_mode: reconciled.timing_mode,
        };
      })
    );
    scheduleAutosave();
  };

  const updateCueTiming = (
    cueId: string,
    field: "start_ms" | "end_ms",
    secondsStr: string
  ) => {
    const parsedSec = Number.parseFloat(secondsStr);
    if (!Number.isFinite(parsedSec)) return;
    const nextMs = Math.round(parsedSec * 1000);

    setCues((prev) =>
      prev.map((cue) => {
        if (cue.id !== cueId) return cue;
        const nextStart = field === "start_ms" ? nextMs : cue.start_ms;
        const nextEnd = field === "end_ms" ? nextMs : cue.end_ms;
        const reconciled =
          nextEnd > nextStart
            ? reconcileCueWords(cue, cue.text, nextStart, nextEnd)
            : { words: cue.words, timing_mode: cue.timing_mode };
        return {
          ...cue,
          start_ms: nextStart,
          end_ms: nextEnd,
          words: reconciled.words,
          timing_mode: reconciled.timing_mode,
        };
      })
    );
    scheduleAutosave();
  };

  const updateStyle = (patch: Partial<CaptionStyleConfig>) => {
    setStyle((prev) => normalizeCaptionStyle({ ...prev, ...patch }));
    scheduleAutosave();
  };

  const reloadLatestFromConflict = () => {
    if (!conflictRevision) return;
    const nextCues = hydrateEditorCues(conflictRevision.cues);
    const nextStyle = normalizeCaptionStyle(conflictRevision.style);
    baseRevisionIdRef.current = conflictRevision.id;
    setSavedRevisionId(conflictRevision.id);
    setRevisionNumber(conflictRevision.revision_number);
    setCues(nextCues);
    setStyle(nextStyle);
    savedVersionRef.current = localVersionRef.current;
    setConflictRevision(null);
    setSaveError(null);
    setSaveStatusSynced("saved");
  };

  const saveLocalOverConflict = () => {
    if (!conflictRevision) return;
    baseRevisionIdRef.current = conflictRevision.id;
    setConflictRevision(null);
    setSaveError(null);
    setSaveStatusSynced("saving");
    void performSave();
  };

  const progressPercent =
    clipDurationMs > 0 ? (currentTimeMs / clipDurationMs) * 100 : 0;

  return (
    <div className="min-h-screen overflow-x-clip bg-[#070B10] text-[#F5F1E8]">
      {/* Compact Project Header (single semantic DOM tree for mobile & desktop) */}
      <header className="sticky top-0 z-30 border-b border-[#F5F1E8]/10 bg-[#070B10]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-5 sm:py-2.5 lg:px-6">
          {/* Back link */}
          <Link
            href="/projects"
            className="order-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#F5F1E8]/12 bg-[#0D131C] px-2.5 py-1.5 text-xs font-medium text-[#B6B0A4] transition hover:border-[#49E6B3]/50 hover:text-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Projects</span>
          </Link>

          {/* Project Title & Metadata (second row on phones, middle on desktop) */}
          <div className="order-3 flex w-full min-w-0 items-center justify-between gap-2 sm:order-2 sm:w-auto sm:flex-1 sm:justify-start">
            <span
              aria-hidden="true"
              className="hidden h-4 w-px shrink-0 bg-[#F5F1E8]/12 sm:inline-block"
            />
            <h1 className="truncate text-sm font-bold tracking-tight text-[#F5F1E8] lg:text-base">
              {projectTitle}
            </h1>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-full border border-[#F5F1E8]/10 bg-[#0D131C] px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#B6B0A4]">
                Rev #{revisionNumber}
              </span>
              <span className="rounded-full border border-[#49E6B3]/25 bg-[#102E28]/70 px-2 py-0.5 text-[11px] font-medium text-[#49E6B3]">
                {mediaKind === "audio" ? "Audio 9:16" : "Video 9:16"}
              </span>
            </div>
          </div>

          {/* Save Status Pill + Retry + AccountMenu */}
          <div className="order-2 flex shrink-0 items-center gap-1.5 sm:order-3 sm:gap-2">
            <span
              role="status"
              aria-live="polite"
              data-testid="autosave-status"
              data-status={saveStatus}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs ${
                saveStatus === "saved"
                  ? "border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3]"
                  : saveStatus === "saving"
                    ? "border border-amber-400/35 bg-amber-400/10 text-amber-200"
                    : "border border-rose-400/35 bg-rose-500/10 text-rose-200"
              }`}
            >
              {saveStatus === "saving" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {saveStatus === "saved" && (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {saveStatus === "error" && (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {saveStatus === "conflict" && (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              <span>
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                    ? "Saved"
                    : saveStatus === "conflict"
                      ? "Conflict"
                      : "Save failed"}
              </span>
            </span>

            {saveStatus === "error" && (
              <button
                type="button"
                onClick={() => void performSave()}
                className="inline-flex items-center gap-1 rounded-lg border border-[#F5F1E8]/15 bg-[#131C28] px-2.5 py-1 text-xs font-medium text-[#F5F1E8] transition hover:border-[#49E6B3]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3]"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry</span>
              </button>
            )}

            <button
              type="button"
              data-testid="open-export-btn"
              onClick={() => setExportModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#49E6B3] px-2.5 py-1.5 text-xs font-semibold text-[#070B10] transition hover:bg-[#2FD49F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3] sm:px-3"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>

            <AccountMenu userEmail={userEmail} />
          </div>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main className="mx-auto w-full max-w-[1400px] px-3 py-3 sm:px-5 lg:px-6 lg:py-4">
        {/* Conflict Banner (keeps newer local edits intact!) */}
        {saveStatus === "conflict" && (
          <div
            role="alert"
            data-testid="conflict-banner"
            className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-100"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div>
                <p className="font-semibold">
                  {saveError || "This project was updated in another tab."}
                </p>
                <p className="mt-0.5 text-amber-200/80">
                  Your local edits have been preserved. Choose whether to reload
                  the latest revision or save your edits as a new revision.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {conflictRevision && (
                <button
                  type="button"
                  onClick={reloadLatestFromConflict}
                  className="rounded-lg border border-amber-300/35 bg-[#0D131C] px-3 py-1.5 font-semibold text-amber-100 transition hover:bg-[#131C28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  Reload latest (Rev #{conflictRevision.revision_number})
                </button>
              )}
              {conflictRevision && (
                <button
                  type="button"
                  onClick={saveLocalOverConflict}
                  className="rounded-lg bg-[#49E6B3] px-3 py-1.5 font-semibold text-[#070B10] transition hover:bg-[#2FD49F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3]"
                >
                  Save my edits as new
                </button>
              )}
            </div>
          </div>
        )}

        {/* Validation / Save Error Banner */}
        {(saveStatus === "error" || !clientValidation.ok) &&
          saveStatus !== "conflict" && (
            <div
              role="alert"
              data-testid="editor-error-banner"
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {!clientValidation.ok ? clientValidation.error : saveError}
                </span>
              </div>
              {clientValidation.ok && (
                <button
                  type="button"
                  onClick={() => void performSave()}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-300/30 bg-[#0D131C] px-2.5 py-1 text-xs font-semibold text-rose-100 hover:border-[#49E6B3]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3]"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry save</span>
                </button>
              )}
            </div>
          )}

        {/* 3-Zone Desktop Grid: Preview+Playback | Editable Captions (Main) | Style Panel */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[304px_minmax(0,1fr)_280px] lg:items-start lg:gap-5 xl:grid-cols-[316px_minmax(0,1fr)_296px]">
          {/* Column 1: Preview Stage + Playback & Timeline directly underneath */}
          <section
            aria-label="Caption preview and playback"
            className="flex min-w-0 flex-col lg:sticky lg:top-[68px]"
          >
            {/* Stage Well */}
            <div className="flex justify-center rounded-2xl border border-[#F5F1E8]/10 bg-[#0A1018] p-2.5 sm:p-3 lg:border-0 lg:bg-transparent lg:p-0">
              <div className="studio-stage-container relative aspect-[9/16] w-[196px] overflow-hidden rounded-[1.35rem] border border-[#F5F1E8]/12 bg-[#0D131C] shadow-[0_20px_60px_rgba(0,0,0,0.65)] sm:w-[236px] lg:w-[292px] lg:rounded-3xl xl:w-[304px]">
                {mediaKind === "video" ? (
                  <video
                    ref={(el) => {
                      mediaRef.current = el;
                    }}
                    src={previewUrl}
                    playsInline
                    preload="auto"
                    muted={isMuted}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onSeeked={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onClick={() => void togglePlay()}
                    className="h-full w-full cursor-pointer bg-[#070B10] object-contain"
                  />
                ) : (
                  <div
                    data-testid="editor-audio-stage"
                    onClick={() => void togglePlay()}
                    className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center bg-gradient-to-b from-[#112635] via-[#0B1722] to-[#070B10] p-5 text-center"
                  >
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3] shadow-[0_0_24px_rgba(73,230,179,0.2)]">
                      <AudioLines className="h-7 w-7" />
                    </span>
                    <p className="mt-3 max-w-full truncate text-xs font-semibold text-[#F5F1E8]">
                      {projectTitle}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#7D7A72]">
                      Audio portrait stage
                    </p>
                    <audio
                      ref={(el) => {
                        mediaRef.current = el;
                      }}
                      src={previewUrl}
                      preload="auto"
                      muted={isMuted}
                      onLoadedMetadata={handleLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      onSeeked={handleTimeUpdate}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />
                  </div>
                )}

                {/* Top playback status badge */}
                <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-full border border-[#F5F1E8]/15 bg-[#070B10]/70 px-2 py-0.5 text-[10px] font-medium text-[#F5F1E8]/90 backdrop-blur-md">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isPlaying ? "animate-pulse bg-[#49E6B3]" : "bg-[#B6B0A4]"
                    }`}
                  />
                  <span>{isPlaying ? "Playing" : "Paused"}</span>
                </div>

                {/* Subtle scrim for caption readability */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#070B10]/85 via-[#070B10]/30 to-transparent" />

                {/* Live Caption Overlay */}
                <EditorCaptionOverlay
                  activeCue={activeCue}
                  activeWord={activeWord}
                  style={style}
                  currentTimeMs={currentTimeMs}
                />

                {/* Non-focusable center play affordance so keyboard focus never drops on play */}
                {!isPlaying && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-[42%] z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#49E6B3]/50 bg-[#070B10]/70 text-[#49E6B3] shadow-xl backdrop-blur-md"
                  >
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  </div>
                )}
              </div>
            </div>

            {/* Playback & Segmented Cue Timeline directly under Preview */}
            <div className="mt-2.5 rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-3">
              {/* Scannable Time + Active Cue Readout */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div
                  data-testid="editor-time-readout"
                  className="font-mono font-semibold tabular-nums text-[#B6B0A4]"
                >
                  <span className="text-[#F5F1E8]">
                    {formatMsClock(currentTimeMs)}
                  </span>
                  <span className="mx-1 text-[#7D7A72]">/</span>
                  <span>{formatMsClock(clipDurationMs)}</span>
                </div>

                <span
                  data-testid="active-cue-indicator"
                  className={`truncate rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums ${
                    activeCueIndex >= 0
                      ? "border border-[#49E6B3]/30 bg-[#102E28] text-[#49E6B3]"
                      : "border border-[#F5F1E8]/10 bg-[#131C28] text-[#7D7A72]"
                  }`}
                >
                  {activeCueIndex >= 0
                    ? `Cue #${activeCueIndex + 1} / ${cues.length}`
                    : `${cues.length} cues`}
                </span>
              </div>

              {/* Segmented Cue Timeline Scrubber */}
              <div className="relative mt-2 flex h-7 items-center">
                <div className="pointer-events-none absolute inset-x-0 h-2 overflow-hidden rounded-full bg-[#16202E]">
                  {/* Cue segments */}
                  {cues.map((cue) => {
                    const leftPct =
                      clipDurationMs > 0
                        ? (cue.start_ms / clipDurationMs) * 100
                        : 0;
                    const widthPct =
                      clipDurationMs > 0
                        ? ((cue.end_ms - cue.start_ms) / clipDurationMs) * 100
                        : 0;
                    const isCueActive = activeCue?.id === cue.id;
                    return (
                      <span
                        key={cue.id}
                        style={{
                          left: `${Math.min(100, Math.max(0, leftPct))}%`,
                          width: `${Math.max(1.2, Math.min(100 - leftPct, widthPct))}%`,
                        }}
                        className={`absolute top-0 h-full rounded-sm transition-colors ${
                          isCueActive
                            ? "bg-[#49E6B3]/50"
                            : "bg-[#F5F1E8]/18"
                        }`}
                      />
                    );
                  })}
                  {/* Playhead progress bar */}
                  <div
                    className="relative h-full rounded-full bg-[#49E6B3]"
                    style={{
                      width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={clipDurationMs}
                  step={20}
                  value={currentTimeMs}
                  onChange={(e) => seekToMs(Number(e.target.value))}
                  aria-label="Seek timeline"
                  aria-valuetext={`${formatMsClock(currentTimeMs)} of ${formatMsClock(clipDurationMs)}`}
                  className="studio-scrubber relative z-10 w-full"
                />
              </div>

              {/* Transport Controls */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    ref={playButtonRef}
                    type="button"
                    data-testid="play-pause-btn"
                    onClick={() => void togglePlay()}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#49E6B3] text-[#070B10] transition hover:bg-[#2FD49F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D131C]"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="ml-0.5 h-4 w-4 fill-current" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => seekToMs(currentTimeMs - 2000)}
                    aria-label="Rewind 2 seconds"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#F5F1E8]/10 bg-[#131C28] text-[#B6B0A4] transition hover:border-[#49E6B3]/40 hover:text-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3]"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => seekToMs(currentTimeMs + 2000)}
                    aria-label="Forward 2 seconds"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#F5F1E8]/10 bg-[#131C28] text-[#B6B0A4] transition hover:border-[#49E6B3]/40 hover:text-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3]"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#F5F1E8]/10 bg-[#131C28] text-[#B6B0A4] transition hover:border-[#49E6B3]/40 hover:text-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3]"
                  >
                    {isMuted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Active word quick pill */}
                <div className="min-w-0 truncate text-right">
                  {activeWord ? (
                    <span
                      data-testid="active-word-readout"
                      className="inline-block max-w-[110px] truncate rounded-md bg-[#102E28] px-2 py-1 text-[11px] font-semibold text-[#49E6B3]"
                    >
                      {activeWord.text}
                    </span>
                  ) : (
                    <span className="hidden text-[11px] text-[#7D7A72] sm:inline">
                      Space · ←/→
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Mobile Accessible Captions / Style Tab Switcher */}
          <StudioTabs
            activeTab={mobileTab}
            onChange={setMobileTab}
            cueCount={cues.length}
            activePresetName={activePresetShortLabel}
            idPrefix="editor"
          />

          {/* Column 2: Main Editable Captions Workspace */}
          <section
            id="editor-panel-captions"
            role="tabpanel"
            aria-labelledby="editor-tab-captions"
            data-testid="panel-captions"
            className={`min-w-0 flex-col ${
              mobileTab === "captions" ? "flex" : "hidden lg:flex"
            }`}
          >
            <div className="flex flex-col rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-3.5 sm:p-4">
              {/* Captions Panel Header */}
              <div className="flex items-start justify-between gap-2 border-b border-[#F5F1E8]/8 pb-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#49E6B3]/30 bg-[#102E28] text-[#49E6B3]">
                    <Captions className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold tracking-tight text-[#F5F1E8]">
                      Editable Captions
                    </h2>
                    <p className="text-[11px] text-[#7D7A72]">
                      Tap a timestamp or word to seek. Changes autosave.
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-[#F5F1E8]/10 bg-[#131C28] px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-[#B6B0A4]">
                  {cues.length} {cues.length === 1 ? "cue" : "cues"}
                </span>
              </div>

              {cues.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-[#F5F1E8]/12 bg-[#070B10] px-4 py-8 text-center text-xs text-[#7D7A72]">
                  No speech cues were detected for this clip.
                </p>
              ) : (
                <div className="studio-scroll mt-3 space-y-3 lg:max-h-[calc(100vh-164px)] lg:overflow-y-auto lg:pr-1">
                  {cues.map((cue, idx) => {
                    const isActive = activeCue?.id === cue.id;
                    const hasWordSync =
                      cue.timing_mode === "word" && cue.words.length > 0;

                    return (
                      <div
                        key={cue.id}
                        data-testid={`editor-cue-${idx + 1}`}
                        data-active-cue={isActive ? "true" : "false"}
                        data-timing-mode={cue.timing_mode}
                        className={`relative overflow-hidden rounded-xl border p-3 transition ${
                          isActive
                            ? "border-[#49E6B3]/55 bg-[#131C28] shadow-[0_8px_24px_rgba(0,0,0,0.32)]"
                            : "border-[#F5F1E8]/10 bg-[#0A1018] hover:border-[#F5F1E8]/20"
                        }`}
                      >
                        {/* Active left accent bar */}
                        <span
                          aria-hidden="true"
                          className={`absolute bottom-2.5 left-0 top-2.5 w-1 rounded-r-full transition ${
                            isActive ? "bg-[#49E6B3]" : "bg-transparent"
                          }`}
                        />

                        {/* Scannable Timestamp & Status Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pl-1">
                          <button
                            type="button"
                            onClick={() => seekToMs(cue.start_ms)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-xs font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3] ${
                              isActive
                                ? "border-[#49E6B3]/40 bg-[#102E28] text-[#49E6B3]"
                                : "border-[#F5F1E8]/10 bg-[#070B10] text-[#B6B0A4] hover:border-[#49E6B3]/40 hover:text-[#F5F1E8]"
                            }`}
                          >
                            <span className="font-semibold">#{idx + 1}</span>
                            <span aria-hidden="true" className="opacity-50">
                              ·
                            </span>
                            <span>
                              {formatMsClock(cue.start_ms)} –{" "}
                              {formatMsClock(cue.end_ms)}
                            </span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            {isActive && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#49E6B3]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#49E6B3]">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full bg-[#49E6B3] ${
                                    isPlaying ? "animate-pulse" : ""
                                  }`}
                                />
                                Active
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                cue.timing_mode === "word"
                                  ? "bg-[#102E28] text-[#49E6B3]"
                                  : "bg-[#1A2636] text-[#B6B0A4]"
                              }`}
                            >
                              {cue.timing_mode === "word"
                                ? "Word-synced"
                                : "Cue-level"}
                            </span>
                          </div>
                        </div>

                        {/* Scannable Click-to-Seek Word Strip */}
                        {hasWordSync && (
                          <div
                            aria-label={`Cue ${idx + 1} word timing`}
                            className="mt-2 flex flex-wrap items-center gap-1 pl-1"
                          >
                            {cue.words.map((word) => {
                              const isWordActive =
                                isActive && activeWord?.id === word.id;
                              const isWordPast =
                                isActive && currentTimeMs >= word.end_ms;
                              return (
                                <button
                                  key={word.id}
                                  type="button"
                                  data-active-word={
                                    isWordActive ? "true" : "false"
                                  }
                                  onClick={() => seekToMs(word.start_ms)}
                                  title={`Seek to ${formatMsClock(word.start_ms)}`}
                                  className={`rounded-md px-1.5 py-0.5 text-xs leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3] ${
                                    isWordActive
                                      ? "bg-[#49E6B3] font-semibold text-[#070B10] shadow-[0_0_12px_rgba(73,230,179,0.35)]"
                                      : isWordPast
                                        ? "bg-[#1A2636]/70 text-[#F5F1E8] hover:bg-[#1A2636]"
                                        : isActive
                                          ? "bg-[#070B10]/60 text-[#B6B0A4] hover:text-[#F5F1E8]"
                                          : "text-[#B6B0A4]/85 hover:bg-[#131C28] hover:text-[#F5F1E8]"
                                  }`}
                                >
                                  {word.text}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Editable Caption Text */}
                        <div className="mt-2 pl-1">
                          <textarea
                            rows={2}
                            aria-label={`Cue ${idx + 1} text`}
                            value={cue.text}
                            onChange={(e) =>
                              updateCueText(cue.id, e.target.value)
                            }
                            className="w-full resize-none rounded-lg border border-[#F5F1E8]/12 bg-[#070B10] px-3 py-2 text-sm leading-relaxed text-[#F5F1E8] transition placeholder:text-[#7D7A72] focus:border-[#49E6B3] focus:outline-none focus:ring-1 focus:ring-[#49E6B3]/50"
                          />
                        </div>

                        {/* Compact Inline Start / End Timing Controls */}
                        <div className="mt-2 grid grid-cols-2 gap-2 pl-1">
                          <label className="flex items-center justify-between gap-2 rounded-lg border border-[#F5F1E8]/10 bg-[#070B10]/85 px-2.5 py-1 text-[11px] text-[#7D7A72] focus-within:border-[#49E6B3]">
                            <span className="shrink-0 font-medium">
                              Start (s)
                            </span>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max={(clipDurationMs / 1000).toFixed(2)}
                              aria-label={`Cue ${idx + 1} start seconds`}
                              value={(cue.start_ms / 1000).toFixed(2)}
                              onChange={(e) =>
                                updateCueTiming(
                                  cue.id,
                                  "start_ms",
                                  e.target.value
                                )
                              }
                              className="w-20 bg-transparent text-right font-mono text-xs tabular-nums text-[#F5F1E8] focus:outline-none"
                            />
                          </label>

                          <label className="flex items-center justify-between gap-2 rounded-lg border border-[#F5F1E8]/10 bg-[#070B10]/85 px-2.5 py-1 text-[11px] text-[#7D7A72] focus-within:border-[#49E6B3]">
                            <span className="shrink-0 font-medium">
                              End (s)
                            </span>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max={(clipDurationMs / 1000).toFixed(2)}
                              aria-label={`Cue ${idx + 1} end seconds`}
                              value={(cue.end_ms / 1000).toFixed(2)}
                              onChange={(e) =>
                                updateCueTiming(
                                  cue.id,
                                  "end_ms",
                                  e.target.value
                                )
                              }
                              className="w-20 bg-transparent text-right font-mono text-xs tabular-nums text-[#F5F1E8] focus:outline-none"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Column 3: Separate Style Controls Panel */}
          <aside
            id="editor-panel-style"
            role="tabpanel"
            aria-labelledby="editor-tab-style"
            data-testid="panel-style"
            className={`min-w-0 flex-col lg:sticky lg:top-[68px] ${
              mobileTab === "style" ? "flex" : "hidden lg:flex"
            }`}
          >
            <StudioStylePanel
              style={style}
              onUpdateStyle={updateStyle}
              subtitle="Autosaves"
            />
          </aside>
        </div>
      </main>

      <ProjectExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        projectId={projectId}
        projectTitle={projectTitle}
        mediaKind={mediaKind}
        savedRevisionId={savedRevisionId}
        savedRevisionNumber={revisionNumber}
        hasUnsavedChanges={saveStatus !== "saved"}
        saveStatus={saveStatus}
      />
    </div>
  );
}
