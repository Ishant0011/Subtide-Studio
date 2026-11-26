"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Captions,
  Download,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  SAMPLE_CAPTIONS,
  SAMPLE_CLIP,
  formatTime,
} from "@/lib/captions";
import {
  DEFAULT_CAPTION_STYLE,
  findActiveEditorCue,
  findActiveEditorWord,
  formatMsClock,
  normalizeCaptionStyle,
  reconcileCueWords,
  type CaptionStyleConfig,
  type EditorCue,
} from "@/lib/caption-editor";
import { generateSrtFromCues } from "@/lib/exports";
import { ClipCaptionsMark } from "@/components/ClipCaptionsLogo";
import { EditorCaptionOverlay } from "@/components/EditorCaptionOverlay";
import { StudioStylePanel } from "@/components/StudioStylePanel";
import { StudioTabs, type StudioMobileTab } from "@/components/StudioTabs";

function buildInitialSampleEditorCues(): EditorCue[] {
  return SAMPLE_CAPTIONS.map((cue) => ({
    id: cue.id,
    start_ms: Math.round(cue.start * 1000),
    end_ms: Math.round(cue.end * 1000),
    text: cue.text,
    timing_mode: "word",
    words: cue.words.map((w) => ({
      id: w.id,
      text: w.text,
      start_ms: Math.round(w.start * 1000),
      end_ms: Math.round(w.end * 1000),
      confidence: 0.99,
    })),
  }));
}

export function StudioWorkspace() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(500);
  const [durationMs, setDurationMs] = useState(
    Math.round(SAMPLE_CLIP.duration * 1000)
  );
  const [cues, setCues] = useState<EditorCue[]>(buildInitialSampleEditorCues);
  const [style, setStyle] = useState<CaptionStyleConfig>(DEFAULT_CAPTION_STYLE);
  const [hasInitializedTime, setHasInitializedTime] = useState(false);
  const [mobileTab, setMobileTab] = useState<StudioMobileTab>("captions");
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [srtNotice, setSrtNotice] = useState<string | null>(null);

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

  // Sync playback at 60fps without disturbing active text editing
  useEffect(() => {
    if (!isPlaying) return;
    let frameId = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        setCurrentTimeMs(Math.round(video.currentTime * 1000));
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const seekToMs = useCallback(
    (nextMs: number) => {
      const clamped = Math.max(0, Math.min(durationMs, Math.round(nextMs)));
      const video = videoRef.current;
      if (video) {
        video.currentTime = clamped / 1000;
      }
      setCurrentTimeMs(clamped);
    },
    [durationMs]
  );

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      if (video.ended || video.currentTime * 1000 >= durationMs - 50) {
        video.currentTime = 0;
        setCurrentTimeMs(0);
      }
      try {
        await video.play();
      } catch {
        video.muted = true;
        setIsMuted(true);
        await video.play().catch(() => {});
      }
    } else {
      video.pause();
    }
  }, [durationMs]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      setDurationMs(Math.round(video.duration * 1000));
    }
    if (!hasInitializedTime) {
      video.currentTime = 0.5;
      setCurrentTimeMs(500);
      setHasInitializedTime(true);
    }
  }, [hasInitializedTime]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!hasInitializedTime && video.paused && video.currentTime === 0) return;
    setCurrentTimeMs(Math.round(video.currentTime * 1000));
  }, [hasInitializedTime]);

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
  };

  const updateStyle = (patch: Partial<CaptionStyleConfig>) => {
    setStyle((prev) => normalizeCaptionStyle({ ...prev, ...patch }));
  };

  const resetSample = () => {
    setCues(buildInitialSampleEditorCues());
    setStyle(DEFAULT_CAPTION_STYLE);
    setSrtNotice(null);
  };

  const downloadSampleSrt = () => {
    const srtText = generateSrtFromCues(cues);
    if (!srtText) return;
    const blob = new Blob([srtText], { type: "application/x-subrip;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clipcaptions-sample.srt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSrtNotice("Downloaded clipcaptions-sample.srt");
    setTimeout(() => setSrtNotice(null), 3500);
  };

  const progressPercent = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  return (
    <div className="min-h-screen overflow-x-clip bg-page text-ink">
      {/* Compact Sample Studio Header */}
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-page/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-3 py-2.5 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/12 bg-panel px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition hover:border-accent/50 hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Home</span>
            </Link>

            <div className="flex min-w-0 items-center gap-2">
              <ClipCaptionsMark size={26} className="shrink-0" />
              <h1 className="truncate text-sm font-bold tracking-tight text-ink">
                Clip<span className="text-accent">Captions</span>
              </h1>
              <span
                aria-hidden="true"
                className="hidden h-4 w-px bg-ink/12 md:inline-block"
              />
              <span className="hidden truncate text-xs text-ink-secondary md:inline">
                Guest Sample · No sign-in required
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-xs">
            <button
              type="button"
              data-testid="sample-download-srt-btn"
              onClick={downloadSampleSrt}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/45 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-hover transition hover:bg-accent hover:text-page"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download SRT</span>
            </button>

            <Link
              href="/upload"
              className="hidden items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-page transition hover:bg-accent-hover sm:inline-flex"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload a clip</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main 3-Zone Responsive Workspace */}
      <main className="mx-auto w-full max-w-[1400px] px-3 py-3 sm:px-5 lg:px-6 lg:py-4">
        {srtNotice && (
          <div
            role="status"
            data-testid="sample-srt-notice"
            className="mb-3 rounded-xl border border-accent/40 bg-accent-soft px-3.5 py-2 text-xs font-medium text-accent-hover"
          >
            {srtNotice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[304px_minmax(0,1fr)_300px] lg:items-start lg:gap-5 xl:grid-cols-[316px_minmax(0,1fr)_316px]">
          {/* Column 1: Portrait Preview + Playback directly under preview */}
          <section
            aria-label="Portrait video preview and playback"
            className="flex min-w-0 flex-col lg:sticky lg:top-[64px]"
          >
            <div className="flex justify-center rounded-2xl border border-ink/10 bg-inset p-2.5 sm:p-3 lg:border-0 lg:bg-transparent lg:p-0">
              <div className="studio-stage-container relative aspect-[9/16] w-[196px] overflow-hidden rounded-[1.35rem] border border-ink/12 bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.65)] sm:w-[236px] lg:w-[292px] lg:rounded-3xl xl:w-[304px]">
                <video
                  ref={videoRef}
                  src={SAMPLE_CLIP.src}
                  poster={SAMPLE_CLIP.poster}
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
                  className="h-full w-full cursor-pointer object-cover"
                />

                <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-page/55 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-page/85 via-page/35 to-transparent" />

                {/* Safe-Area Guide Overlay */}
                {showSafeArea && (
                  <div
                    aria-hidden="true"
                    data-testid="sample-safe-area-guide"
                    className="pointer-events-none absolute inset-0 z-10"
                  >
                    <div className="absolute inset-x-0 top-0 h-[12%] border-b border-dashed border-accent/60 bg-accent/10" />
                    <div className="absolute bottom-0 right-0 top-[12%] w-[16%] border-l border-dashed border-accent/60 bg-accent/10" />
                    <div className="absolute inset-x-0 bottom-0 h-[18%] border-t border-dashed border-accent/60 bg-accent/10" />
                  </div>
                )}

                <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-full border border-ink/15 bg-page/70 px-2 py-0.5 text-[10px] font-medium text-ink/90 backdrop-blur-md">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isPlaying ? "animate-pulse bg-accent" : "bg-ink-secondary"
                    }`}
                  />
                  <span>{isPlaying ? "Playing" : "Paused"}</span>
                </div>

                {/* Live Editable Caption Overlay */}
                <EditorCaptionOverlay
                  activeCue={activeCue}
                  activeWord={activeWord}
                  style={style}
                  currentTimeMs={currentTimeMs}
                />

                {!isPlaying && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-[56%] z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent/55 bg-page/75 text-accent shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md"
                  >
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  </div>
                )}
              </div>
            </div>

            {/* Playback & Cue Scrubber */}
            <div className="mt-2.5 rounded-2xl border border-ink/10 bg-panel p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div
                  data-testid="time-readout"
                  className="font-mono font-semibold tabular-nums text-ink-secondary"
                >
                  <span className="text-ink">
                    {formatTime(currentTimeMs / 1000)}
                  </span>
                  <span className="mx-1 text-ink-muted">/</span>
                  <span>{formatTime(durationMs / 1000)}</span>
                </div>

                <span
                  data-testid="sample-active-cue-indicator"
                  className={`truncate rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums ${
                    activeCueIndex >= 0
                      ? "border border-accent/35 bg-accent-soft text-accent-hover"
                      : "border border-ink/10 bg-elevated text-ink-muted"
                  }`}
                >
                  {activeCueIndex >= 0
                    ? `Cue #${activeCueIndex + 1} / ${cues.length}`
                    : `${cues.length} cues`}
                </span>
              </div>

              <div className="relative mt-2 flex h-7 items-center">
                <div className="pointer-events-none absolute inset-x-0 h-2 overflow-hidden rounded-full bg-track">
                  {cues.map((cue) => {
                    const leftPct =
                      durationMs > 0 ? (cue.start_ms / durationMs) * 100 : 0;
                    const widthPct =
                      durationMs > 0
                        ? ((cue.end_ms - cue.start_ms) / durationMs) * 100
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
                          isCueActive ? "bg-accent/55" : "bg-ink/18"
                        }`}
                      />
                    );
                  })}
                  <div
                    className="relative h-full rounded-full bg-accent"
                    style={{
                      width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={durationMs}
                  step={20}
                  value={currentTimeMs}
                  onChange={(e) => seekToMs(Number(e.target.value))}
                  aria-label="Seek timeline"
                  aria-valuetext={`${formatMsClock(currentTimeMs)} of ${formatMsClock(durationMs)}`}
                  className="studio-scrubber relative z-10 w-full"
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    ref={playButtonRef}
                    type="button"
                    data-testid="sample-play-pause-btn"
                    onClick={() => void togglePlay()}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-page transition hover:bg-accent-hover"
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
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-elevated text-ink-secondary transition hover:border-accent/45 hover:text-ink"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => seekToMs(currentTimeMs + 2000)}
                    aria-label="Forward 2 seconds"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-elevated text-ink-secondary transition hover:border-accent/45 hover:text-ink"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-elevated text-ink-secondary transition hover:border-accent/45 hover:text-ink"
                  >
                    {isMuted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="min-w-0 truncate text-right">
                  {activeWord ? (
                    <span
                      data-testid="sample-active-word-readout"
                      className="inline-block max-w-[110px] truncate rounded-md bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent-hover"
                    >
                      {activeWord.text}
                    </span>
                  ) : (
                    <span className="hidden text-[11px] text-ink-muted sm:inline">
                      Space · ←/→
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Mobile Accessible Captions / Style Tabs */}
          <StudioTabs
            activeTab={mobileTab}
            onChange={setMobileTab}
            cueCount={cues.length}
            activePresetName={activePresetShortLabel}
            idPrefix="sample"
          />

          {/* Column 2: Guest Editable Transcript + SRT Export */}
          <section
            id="sample-panel-captions"
            role="tabpanel"
            aria-labelledby="sample-tab-captions"
            data-testid="panel-captions"
            className={`min-w-0 flex-col ${
              mobileTab === "captions" ? "flex" : "hidden lg:flex"
            }`}
          >
            <div className="flex flex-col rounded-2xl border border-ink/10 bg-panel p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/8 pb-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft text-accent">
                    <Captions className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold tracking-tight text-ink">
                      Editable Sample Transcript
                    </h2>
                    <p className="text-[11px] text-ink-muted">
                      Edit any line live and export an SRT without creating an account.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetSample}
                  className="rounded-lg border border-ink/12 bg-elevated px-2.5 py-1 text-[11px] font-medium text-ink-secondary transition hover:border-accent/45 hover:text-ink"
                >
                  Reset sample
                </button>
              </div>

              <div className="studio-scroll mt-3 space-y-2.5 lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto lg:pr-1">
                {cues.map((cue, cueIndex) => {
                  const isCueActive = activeCue?.id === cue.id;
                  const hasWordSync =
                    cue.timing_mode === "word" && cue.words.length > 0;
                  return (
                    <div
                      key={cue.id}
                      data-testid={`cue-item-${cue.id}`}
                      data-active-cue={isCueActive ? "true" : "false"}
                      className={`relative overflow-hidden rounded-xl border px-3.5 py-3 transition ${
                        isCueActive
                          ? "border-accent/55 bg-elevated shadow-[0_8px_24px_rgba(0,0,0,0.32)]"
                          : "border-ink/8 bg-inset hover:border-ink/20"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-2.5 left-0 top-2.5 w-1 rounded-r-full transition ${
                          isCueActive ? "bg-accent" : "bg-transparent"
                        }`}
                      />

                      <div className="flex items-center justify-between gap-2 pl-1">
                        <button
                          type="button"
                          onClick={() => seekToMs(cue.start_ms)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-xs font-medium tabular-nums transition ${
                            isCueActive
                              ? "border-accent/45 bg-accent-soft text-accent-hover"
                              : "border-ink/10 bg-page text-ink-secondary hover:border-accent/45 hover:text-ink"
                          }`}
                        >
                          <span className="font-semibold">#{cueIndex + 1}</span>
                          <span aria-hidden="true" className="opacity-50">
                            ·
                          </span>
                          <span>
                            {formatMsClock(cue.start_ms)} –{" "}
                            {formatMsClock(cue.end_ms)}
                          </span>
                        </button>

                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-hover">
                          {cue.timing_mode === "word" ? "Word-synced" : "Cue-level"}
                        </span>
                      </div>

                      {hasWordSync && (
                        <div className="mt-2 flex flex-wrap items-center gap-1 pl-1">
                          {cue.words.map((word) => {
                            const isWordActive =
                              isCueActive && activeWord?.id === word.id;
                            const isWordPast =
                              isCueActive && currentTimeMs >= word.end_ms;
                            return (
                              <button
                                key={word.id}
                                type="button"
                                data-active-word={isWordActive ? "true" : "false"}
                                onClick={() => seekToMs(word.start_ms)}
                                title={`Seek to ${formatMsClock(word.start_ms)}`}
                                className={`rounded-md px-1.5 py-0.5 text-xs leading-snug transition ${
                                  isWordActive
                                    ? "bg-accent font-semibold text-page"
                                    : isWordPast
                                      ? "text-ink hover:bg-track"
                                      : "text-ink-secondary hover:bg-elevated hover:text-ink"
                                }`}
                              >
                                {word.text}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-2 pl-1">
                        <textarea
                          rows={2}
                          data-testid={`sample-cue-textarea-${cueIndex + 1}`}
                          aria-label={`Sample cue ${cueIndex + 1} text`}
                          value={cue.text}
                          onChange={(e) => updateCueText(cue.id, e.target.value)}
                          className="w-full resize-none rounded-lg border border-ink/12 bg-page px-3 py-1.5 text-xs leading-relaxed text-ink focus:border-accent focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Column 3: Style Inspector */}
          <aside
            id="sample-panel-style"
            role="tabpanel"
            aria-labelledby="sample-tab-style"
            data-testid="panel-style"
            className={`min-w-0 flex-col lg:sticky lg:top-[64px] ${
              mobileTab === "style" ? "flex" : "hidden lg:flex"
            }`}
          >
            <StudioStylePanel
              style={style}
              onUpdateStyle={updateStyle}
              showSafeArea={showSafeArea}
              onToggleSafeArea={setShowSafeArea}
              subtitle="Instant preview"
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
