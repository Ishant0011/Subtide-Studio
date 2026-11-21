"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { CAPTION_PRESETS, type CaptionPresetId } from "@/lib/captions";
import {
  MAX_VERTICAL_POSITION,
  MIN_VERTICAL_POSITION,
  findActiveEditorCue,
  findActiveEditorWord,
  formatMsClock,
  hydrateEditorCues,
  normalizeCaptionStyle,
  reconcileCueWords,
  validateCaptionRevisionInput,
  type CaptionFontSize,
  type CaptionStyleConfig,
  type EditorCue,
} from "@/lib/caption-editor";
import { EditorCaptionOverlay } from "@/components/EditorCaptionOverlay";

type SaveStatus = "saved" | "saving" | "error" | "conflict";

interface ConflictRevisionPayload {
  id: string;
  revision_number: number;
  style?: Partial<CaptionStyleConfig> | null;
  cues?: unknown;
}

interface ProjectCaptionEditorProps {
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

const FONT_SIZE_OPTIONS: Array<{ id: CaptionFontSize; label: string }> = [
  { id: "sm", label: "Small" },
  { id: "md", label: "Medium" },
  { id: "lg", label: "Large" },
];

export function ProjectCaptionEditor({
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

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(
    initialCues[0] ? initialCues[0].start_ms : 0
  );
  const [clipDurationMs, setClipDurationMs] = useState(
    durationMs > 0 ? durationMs : 15000
  );
  const [hasInitializedSeek, setHasInitializedSeek] = useState(false);

  const [cues, setCues] = useState<EditorCue[]>(initialCues);
  const [style, setStyle] = useState<CaptionStyleConfig>(initialStyle);
  const [revisionNumber, setRevisionNumber] = useState(initialRevisionNumber);

  // Concurrency & autosave refs
  const baseRevisionIdRef = useRef<string | null>(initialRevisionId);
  const localVersionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const inFlightRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCuesRef = useRef<EditorCue[]>(initialCues);
  const latestStyleRef = useRef<CaptionStyleConfig>(initialStyle);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictRevision, setConflictRevision] =
    useState<ConflictRevisionPayload | null>(null);

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
  const activeWord = useMemo(
    () => findActiveEditorWord(activeCue, currentTimeMs),
    [activeCue, currentTimeMs]
  );

  const clientValidation = useMemo(
    () =>
      validateCaptionRevisionInput({
        cues,
        style,
        durationMs: clipDurationMs,
      }),
    [cues, style, clipDurationMs]
  );

  // 60fps media clock sync while playing
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
      setSaveStatus("error");
      setSaveError(check.error);
      return;
    }

    inFlightRef.current = true;
    setSaveStatus("saving");
    setSaveError(null);

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
        setSaveStatus("conflict");
        setSaveError(
          data.error || "This project was updated in another tab."
        );
        return;
      }

      if (!res.ok) {
        setSaveStatus("error");
        setSaveError(data.error || `Save failed (HTTP ${res.status}).`);
        return;
      }

      const savedRev = data.revision as {
        id: string;
        revision_number: number;
      };
      baseRevisionIdRef.current = savedRev.id;
      savedVersionRef.current = snapshotVersion;
      setRevisionNumber(savedRev.revision_number);
      setConflictRevision(null);

      // If newer local edits arrived while this save was in flight, keep them and save again
      if (localVersionRef.current > snapshotVersion) {
        setSaveStatus("saving");
      } else {
        setSaveStatus("saved");
      }
    } catch {
      setSaveStatus("error");
      setSaveError("Network error while saving. Your local edits are preserved.");
    } finally {
      inFlightRef.current = false;
      if (
        localVersionRef.current > savedVersionRef.current &&
        saveStatus !== "conflict"
      ) {
        // Queue follow-up save for newer local edits made during in-flight request
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          void performSave();
        }, 350);
      }
    }
  }, [clipDurationMs, projectId, saveStatus]);

  const scheduleAutosave = useCallback(() => {
    localVersionRef.current += 1;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    // Do not auto-overwrite a conflict; user explicitly chooses Reload or Save as new
    if (saveStatus === "conflict") {
      return;
    }
    setSaveStatus("saving");
    setSaveError(null);
    debounceTimerRef.current = setTimeout(() => {
      void performSave();
    }, 650);
  }, [performSave, saveStatus]);

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
    setRevisionNumber(conflictRevision.revision_number);
    setCues(nextCues);
    setStyle(nextStyle);
    savedVersionRef.current = localVersionRef.current;
    setConflictRevision(null);
    setSaveError(null);
    setSaveStatus("saved");
  };

  const saveLocalOverConflict = () => {
    if (!conflictRevision) return;
    baseRevisionIdRef.current = conflictRevision.id;
    setConflictRevision(null);
    setSaveError(null);
    void performSave();
  };

  const progressPercent =
    clipDurationMs > 0 ? (currentTimeMs / clipDurationMs) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:py-7">
      {/* Editor Header Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#F5F1E8]/12 bg-[#0D131C] px-3 py-1.5 text-xs font-medium text-[#B6B0A4] transition hover:border-[#49E6B3]/50 hover:text-[#F5F1E8]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Projects</span>
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#F5F1E8] sm:text-xl">
              {projectTitle}
            </h1>
            <p className="text-xs text-[#7D7A72]">
              Rev #{revisionNumber} ·{" "}
              {mediaKind === "audio" ? "Audio portrait stage" : "Video preview"}
            </p>
          </div>
        </div>

        {/* Autosave Status Pill */}
        <div className="flex items-center gap-2">
          <span
            data-testid="autosave-status"
            data-status={saveStatus}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
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
            {saveStatus === "saved" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {saveStatus === "error" && <AlertCircle className="h-3.5 w-3.5" />}
            {saveStatus === "conflict" && (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            <span>
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved"
                  ? "Saved"
                  : saveStatus === "conflict"
                    ? "Save conflict"
                    : "Save failed"}
            </span>
          </span>

          {saveStatus === "error" && (
            <button
              type="button"
              onClick={() => void performSave()}
              className="inline-flex items-center gap-1 rounded-lg border border-[#F5F1E8]/15 bg-[#131C28] px-2.5 py-1 text-xs font-medium text-[#F5F1E8] hover:border-[#49E6B3]/50"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>

      {/* Conflict Banner (keeps newer local edits intact!) */}
      {saveStatus === "conflict" && (
        <div
          role="alert"
          data-testid="conflict-banner"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-100"
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

          <div className="flex items-center gap-2">
            {conflictRevision && (
              <button
                type="button"
                onClick={reloadLatestFromConflict}
                className="rounded-lg border border-amber-300/35 bg-[#0D131C] px-3 py-1.5 font-semibold text-amber-100 hover:bg-[#131C28]"
              >
                Reload latest (Rev #{conflictRevision.revision_number})
              </button>
            )}
            {conflictRevision && (
              <button
                type="button"
                onClick={saveLocalOverConflict}
                className="rounded-lg bg-[#49E6B3] px-3 py-1.5 font-semibold text-[#070B10] hover:bg-[#2FD49F]"
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
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {!clientValidation.ok ? clientValidation.error : saveError}
            </span>
          </div>
        )}

      {/* Main Responsive Grid: Preview beside Cue List on desktop, stacked on phones */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(320px,380px)_1fr] lg:items-start lg:gap-8">
        {/* Preview & Transport Column */}
        <section
          aria-label="Caption preview"
          className="flex flex-col items-center lg:sticky lg:top-20"
        >
          <div className="w-full max-w-[340px] sm:max-w-[360px] lg:max-w-none">
            {/* 9:16 Stage */}
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-3xl border border-[#F5F1E8]/12 bg-[#0D131C] shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
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
                  className="h-full w-full cursor-pointer object-contain bg-[#070B10]"
                />
              ) : (
                <div
                  data-testid="editor-audio-stage"
                  onClick={() => void togglePlay()}
                  className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center bg-gradient-to-b from-[#112635] via-[#0B1722] to-[#070B10] p-6"
                >
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3]">
                    <AudioLines className="h-8 w-8" />
                  </span>
                  <p className="mt-3 text-xs font-medium text-[#B6B0A4]">
                    {projectTitle}
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

              {/* Subtle scrim for readability */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#070B10]/80 via-[#070B10]/25 to-transparent" />

              {/* Live Caption Overlay (shared layout logic) */}
              <EditorCaptionOverlay
                activeCue={activeCue}
                activeWord={activeWord}
                style={style}
                currentTimeMs={currentTimeMs}
              />

              {!isPlaying && (
                <button
                  type="button"
                  onClick={() => void togglePlay()}
                  aria-label="Play preview"
                  className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#49E6B3]/50 bg-[#070B10]/70 text-[#49E6B3] shadow-xl backdrop-blur-md transition hover:scale-105 hover:bg-[#49E6B3] hover:text-[#070B10]"
                >
                  <Play className="ml-0.5 h-6 w-6 fill-current" />
                </button>
              )}
            </div>

            {/* Scrubber & Transport */}
            <div className="mt-4 rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-3.5">
              <div className="relative flex h-6 items-center">
                <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-[#1A2636]">
                  <div
                    className="h-full rounded-full bg-[#49E6B3]"
                    style={{
                      width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                    }}
                  />
                </div>
                <div className="pointer-events-none absolute inset-x-0 h-1.5">
                  {cues.map((cue) => {
                    const leftPct =
                      clipDurationMs > 0
                        ? (cue.start_ms / clipDurationMs) * 100
                        : 0;
                    return (
                      <span
                        key={cue.id}
                        style={{ left: `${Math.min(100, Math.max(0, leftPct))}%` }}
                        className="absolute top-0 h-1.5 w-0.5 bg-[#F5F1E8]/35"
                      />
                    );
                  })}
                </div>
                <input
                  type="range"
                  min={0}
                  max={clipDurationMs}
                  step={20}
                  value={currentTimeMs}
                  onChange={(e) => seekToMs(Number(e.target.value))}
                  aria-label="Seek timeline"
                  className="studio-scrubber relative z-10 w-full"
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void togglePlay()}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#49E6B3] text-[#070B10] transition hover:bg-[#2FD49F]"
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
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#F5F1E8]/10 bg-[#131C28] text-[#B6B0A4] hover:border-[#49E6B3]/40 hover:text-[#F5F1E8]"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => seekToMs(currentTimeMs + 2000)}
                    aria-label="Forward 2 seconds"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#F5F1E8]/10 bg-[#131C28] text-[#B6B0A4] hover:border-[#49E6B3]/40 hover:text-[#F5F1E8]"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#F5F1E8]/10 bg-[#131C28] text-[#B6B0A4] hover:border-[#49E6B3]/40 hover:text-[#F5F1E8]"
                  >
                    {isMuted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div
                  data-testid="editor-time-readout"
                  className="font-mono text-xs font-medium tabular-nums text-[#B6B0A4]"
                >
                  <span className="text-[#F5F1E8]">
                    {formatMsClock(currentTimeMs)}
                  </span>
                  <span className="mx-1 text-[#7D7A72]">/</span>
                  <span>{formatMsClock(clipDurationMs)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Style Controls + Cue Editor Column */}
        <section className="flex min-w-0 flex-col gap-6">
          {/* Style Panel */}
          <div className="rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#49E6B3]" />
              <h2 className="text-sm font-semibold tracking-tight text-[#F5F1E8]">
                Caption Style
              </h2>
            </div>

            {/* Presets */}
            <div
              role="group"
              aria-label="Caption presets"
              className="mt-3.5 grid grid-cols-3 gap-2"
            >
              {CAPTION_PRESETS.map((item) => {
                const selected = style.preset === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updateStyle({ preset: item.id as CaptionPresetId })}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                      selected
                        ? "border-[#49E6B3] bg-[#102E28] text-[#49E6B3]"
                        : "border-[#F5F1E8]/10 bg-[#131C28]/70 text-[#F5F1E8] hover:border-[#F5F1E8]/25"
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>

            {/* Font Size & Vertical Position */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="block text-xs font-medium text-[#B6B0A4]">
                  Font size
                </span>
                <div
                  role="group"
                  aria-label="Font size"
                  className="mt-1.5 grid grid-cols-3 gap-1.5"
                >
                  {FONT_SIZE_OPTIONS.map((opt) => {
                    const selected = style.fontSize === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => updateStyle({ fontSize: opt.id })}
                        className={`rounded-lg border py-1.5 text-xs font-medium transition ${
                          selected
                            ? "border-[#49E6B3] bg-[#102E28] text-[#49E6B3]"
                            : "border-[#F5F1E8]/10 bg-[#070B10] text-[#B6B0A4] hover:text-[#F5F1E8]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="vertical-position-slider"
                    className="font-medium text-[#B6B0A4]"
                  >
                    Vertical position
                  </label>
                  <span className="font-mono tabular-nums text-[#49E6B3]">
                    {style.verticalPosition}%
                  </span>
                </div>
                <input
                  id="vertical-position-slider"
                  type="range"
                  min={MIN_VERTICAL_POSITION}
                  max={MAX_VERTICAL_POSITION}
                  step={1}
                  value={style.verticalPosition}
                  onChange={(e) =>
                    updateStyle({ verticalPosition: Number(e.target.value) })
                  }
                  aria-label="Vertical position"
                  className="studio-scrubber mt-3 w-full"
                />
              </div>
            </div>
          </div>

          {/* Cue Editor List */}
          <div className="rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-[#F5F1E8]">
                  Caption Cues
                </h2>
                <p className="mt-0.5 text-xs text-[#7D7A72]">
                  Click a cue header to seek. Edits autosave as immutable
                  revisions.
                </p>
              </div>
              <span className="rounded-full border border-[#F5F1E8]/10 bg-[#131C28] px-2.5 py-1 font-mono text-[11px] tabular-nums text-[#B6B0A4]">
                {cues.length} cues
              </span>
            </div>

            {cues.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[#F5F1E8]/12 bg-[#070B10] px-4 py-6 text-center text-xs text-[#7D7A72]">
                No speech cues were detected for this clip.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {cues.map((cue, idx) => {
                  const isActive = activeCue?.id === cue.id;
                  return (
                    <div
                      key={cue.id}
                      data-testid={`editor-cue-${idx + 1}`}
                      data-active-cue={isActive ? "true" : "false"}
                      data-timing-mode={cue.timing_mode}
                      className={`rounded-xl border p-3.5 transition ${
                        isActive
                          ? "border-[#49E6B3]/55 bg-[#131C28]"
                          : "border-[#F5F1E8]/10 bg-[#070B10]/80"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => seekToMs(cue.start_ms)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-medium tabular-nums text-[#B6B0A4] transition hover:text-[#49E6B3]"
                        >
                          <span className={isActive ? "text-[#49E6B3]" : ""}>
                            #{idx + 1}
                          </span>
                          <span>·</span>
                          <span>
                            {formatMsClock(cue.start_ms)} –{" "}
                            {formatMsClock(cue.end_ms)}
                          </span>
                        </button>

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

                      <textarea
                        rows={2}
                        aria-label={`Cue ${idx + 1} text`}
                        value={cue.text}
                        onChange={(e) => updateCueText(cue.id, e.target.value)}
                        className="mt-2.5 w-full resize-none rounded-lg border border-[#F5F1E8]/12 bg-[#070B10] px-3 py-2 text-sm text-[#F5F1E8] focus:border-[#49E6B3] focus:outline-none"
                      />

                      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                        <label className="flex flex-col gap-1 text-[11px] text-[#7D7A72]">
                          <span>Start (s)</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max={(clipDurationMs / 1000).toFixed(2)}
                            aria-label={`Cue ${idx + 1} start seconds`}
                            value={(cue.start_ms / 1000).toFixed(2)}
                            onChange={(e) =>
                              updateCueTiming(cue.id, "start_ms", e.target.value)
                            }
                            className="rounded-lg border border-[#F5F1E8]/12 bg-[#070B10] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#F5F1E8] focus:border-[#49E6B3] focus:outline-none"
                          />
                        </label>

                        <label className="flex flex-col gap-1 text-[11px] text-[#7D7A72]">
                          <span>End (s)</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max={(clipDurationMs / 1000).toFixed(2)}
                            aria-label={`Cue ${idx + 1} end seconds`}
                            value={(cue.end_ms / 1000).toFixed(2)}
                            onChange={(e) =>
                              updateCueTiming(cue.id, "end_ms", e.target.value)
                            }
                            className="rounded-lg border border-[#F5F1E8]/12 bg-[#070B10] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#F5F1E8] focus:border-[#49E6B3] focus:outline-none"
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
      </div>
    </div>
  );
}
