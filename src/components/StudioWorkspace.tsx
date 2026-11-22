"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Captions,
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
  getActiveCue,
  getActiveWord,
} from "@/lib/captions";
import {
  DEFAULT_CAPTION_STYLE,
  normalizeCaptionStyle,
  type CaptionStyleConfig,
} from "@/lib/caption-editor";
import { CaptionOverlay } from "@/components/CaptionOverlay";
import { ClipCaptionsMark } from "@/components/ClipCaptionsLogo";
import { StudioStylePanel } from "@/components/StudioStylePanel";
import { StudioTabs, type StudioMobileTab } from "@/components/StudioTabs";

export function StudioWorkspace() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0.55);
  const [duration, setDuration] = useState(SAMPLE_CLIP.duration);
  const [style, setStyle] = useState<CaptionStyleConfig>(DEFAULT_CAPTION_STYLE);
  const [hasInitializedTime, setHasInitializedTime] = useState(false);
  const [mobileTab, setMobileTab] = useState<StudioMobileTab>("captions");

  const activeCue = useMemo(
    () => getActiveCue(SAMPLE_CAPTIONS, currentTime),
    [currentTime]
  );
  const activeCueIndex = useMemo(
    () =>
      activeCue ? SAMPLE_CAPTIONS.findIndex((c) => c.id === activeCue.id) : -1,
    [activeCue]
  );
  const activeWord = useMemo(
    () => getActiveWord(activeCue, currentTime),
    [activeCue, currentTime]
  );
  const activePresetShortLabel = useMemo(() => {
    if (style.preset === "word-highlight") return "Highlight";
    if (style.preset === "boxed") return "Boxed";
    return "Clean";
  }, [style.preset]);

  // Sync media playback time at 60fps while playing without stealing keyboard focus
  useEffect(() => {
    if (!isPlaying) return;

    let frameId = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        setCurrentTime(video.currentTime);
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const seekTo = useCallback(
    (nextTime: number) => {
      const clamped = Math.max(0, Math.min(duration, nextTime));
      const video = videoRef.current;
      if (video) {
        video.currentTime = clamped;
      }
      setCurrentTime(clamped);
    },
    [duration]
  );

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      if (video.ended || video.currentTime >= duration - 0.05) {
        video.currentTime = 0;
        setCurrentTime(0);
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
  }, [duration]);

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
      setDuration(video.duration);
    }
    if (!hasInitializedTime) {
      video.currentTime = 0.55;
      setCurrentTime(0.55);
      setHasInitializedTime(true);
    }
  }, [hasInitializedTime]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!hasInitializedTime && video.paused && video.currentTime === 0) return;
    setCurrentTime(video.currentTime);
  }, [hasInitializedTime]);

  // Keyboard shortcuts: Space to play/pause, Left/Right arrows to nudge 1s
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
        seekTo(currentTime - 1);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        seekTo(currentTime + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentTime, seekTo, togglePlay]);

  const updateStyle = (patch: Partial<CaptionStyleConfig>) => {
    setStyle((prev) => normalizeCaptionStyle({ ...prev, ...patch }));
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen overflow-x-clip bg-page text-ink">
      {/* Compact Sample Studio Header */}
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-page/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-3 py-2.5 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/12 bg-panel px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition hover:border-accent/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                {SAMPLE_CLIP.title}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="rounded-full border border-accent/35 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-hover">
              Sample · {SAMPLE_CLIP.aspectLabel}
            </span>
            <Link
              href="/upload"
              className="hidden items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-page transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:inline-flex"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload a clip</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main 3-Zone Responsive Workspace */}
      <main className="mx-auto w-full max-w-[1400px] px-3 py-3 sm:px-5 lg:px-6 lg:py-4">
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[304px_minmax(0,1fr)_280px] lg:items-start lg:gap-5 xl:grid-cols-[316px_minmax(0,1fr)_296px]">
          {/* Column 1: Portrait Preview + Playback & Timeline directly under preview */}
          <section
            aria-label="Portrait video preview and playback"
            className="flex min-w-0 flex-col lg:sticky lg:top-[64px]"
          >
            <div className="flex justify-center rounded-2xl border border-ink/10 bg-inset p-2.5 sm:p-3 lg:border-0 lg:bg-transparent lg:p-0">
              <div className="studio-stage-container relative aspect-[9/16] w-[196px] overflow-hidden rounded-[1.35rem] border border-ink/12 bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.65)] sm:w-[236px] lg:w-[292px] lg:rounded-3xl xl:w-[304px]">
                <video
                  ref={videoRef}
                  src={SAMPLE_CLIP.src}
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

                {/* Top & bottom readability scrims */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-page/55 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-page/85 via-page/35 to-transparent" />

                {/* Top Viewport Status Pill */}
                <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-full border border-ink/15 bg-page/70 px-2 py-0.5 text-[10px] font-medium text-ink/90 backdrop-blur-md">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isPlaying ? "animate-pulse bg-accent" : "bg-ink-secondary"
                    }`}
                  />
                  <span>{isPlaying ? "Playing" : "Paused"}</span>
                </div>

                {/* Live Caption Overlay */}
                <CaptionOverlay
                  activeCue={activeCue}
                  activeWord={activeWord}
                  preset={style.preset}
                  fontSize={style.fontSize}
                  verticalPosition={style.verticalPosition}
                  accent={style.accent}
                  currentTime={currentTime}
                />

                {/* Non-focusable visual play hint so keyboard focus never drops on play */}
                {!isPlaying && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-[42%] z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent/55 bg-page/75 text-accent shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md"
                  >
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  </div>
                )}
              </div>
            </div>

            {/* Playback & Segmented Cue Timeline directly under Preview */}
            <div className="mt-2.5 rounded-2xl border border-ink/10 bg-panel p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div
                  data-testid="time-readout"
                  className="font-mono font-semibold tabular-nums text-ink-secondary"
                >
                  <span className="text-ink">
                    {formatTime(currentTime)}
                  </span>
                  <span className="mx-1 text-ink-muted">/</span>
                  <span>{formatTime(duration)}</span>
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
                    ? `Cue #${activeCueIndex + 1} / ${SAMPLE_CAPTIONS.length}`
                    : `${SAMPLE_CAPTIONS.length} cues`}
                </span>
              </div>

              {/* Timeline Scrubber with Cue Segments */}
              <div className="relative mt-2 flex h-7 items-center">
                <div className="pointer-events-none absolute inset-x-0 h-2 overflow-hidden rounded-full bg-track">
                  {SAMPLE_CAPTIONS.map((cue) => {
                    const leftPct =
                      duration > 0 ? (cue.start / duration) * 100 : 0;
                    const widthPct =
                      duration > 0
                        ? ((cue.end - cue.start) / duration) * 100
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
                            ? "bg-accent/55"
                            : "bg-ink/18"
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
                  max={duration}
                  step={0.01}
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  aria-label="Seek timeline"
                  aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
                  className="studio-scrubber relative z-10 w-full"
                />
              </div>

              {/* Transport Controls */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    ref={playButtonRef}
                    type="button"
                    data-testid="sample-play-pause-btn"
                    onClick={() => void togglePlay()}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-page transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="ml-0.5 h-4 w-4 fill-current" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => seekTo(currentTime - 2)}
                    aria-label="Rewind 2 seconds"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-elevated text-ink-secondary transition hover:border-accent/45 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => seekTo(currentTime + 2)}
                    aria-label="Forward 2 seconds"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-elevated text-ink-secondary transition hover:border-accent/45 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-elevated text-ink-secondary transition hover:border-accent/45 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
            cueCount={SAMPLE_CAPTIONS.length}
            activePresetName={activePresetShortLabel}
            idPrefix="sample"
          />

          {/* Column 2: Main Captions Workspace */}
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
              <div className="flex items-start justify-between gap-2 border-b border-ink/8 pb-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft text-accent">
                    <Captions className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold tracking-tight text-ink">
                      Transcript
                    </h2>
                    <p className="text-[11px] text-ink-muted">
                      Tap any timestamp or word to jump straight to that moment.
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-ink/10 bg-elevated px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-ink-secondary">
                  {SAMPLE_CAPTIONS.length} cues
                </span>
              </div>

              <div className="studio-scroll mt-3 space-y-2.5 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto lg:pr-1">
                {SAMPLE_CAPTIONS.map((cue, cueIndex) => {
                  const isCueActive = activeCue?.id === cue.id;
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
                      {/* Active left accent bar */}
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-2.5 left-0 top-2.5 w-1 rounded-r-full transition ${
                          isCueActive ? "bg-accent" : "bg-transparent"
                        }`}
                      />

                      <div className="flex items-center justify-between gap-2 pl-1">
                        <button
                          type="button"
                          onClick={() => seekTo(cue.start)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-xs font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
                            {formatTime(cue.start)} – {formatTime(cue.end)}
                          </span>
                        </button>

                        {isCueActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-hover">
                            <span
                              className={`h-1.5 w-1.5 rounded-full bg-accent ${
                                isPlaying ? "animate-pulse" : ""
                              }`}
                            />
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1 pl-1">
                        {cue.words.map((word) => {
                          const isWordActive =
                            isCueActive && activeWord?.id === word.id;
                          const isWordPast =
                            isCueActive && currentTime >= word.end;
                          return (
                            <button
                              key={word.id}
                              type="button"
                              data-active-word={
                                isWordActive ? "true" : "false"
                              }
                              onClick={() => seekTo(word.start)}
                              title={`Seek to ${formatTime(word.start)}`}
                              className={`rounded-md px-1.5 py-0.5 text-sm leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                isWordActive
                                  ? "bg-accent font-semibold text-page shadow-[0_0_12px_rgba(167,139,250,0.4)]"
                                  : isWordPast
                                    ? "text-ink hover:bg-track"
                                    : isCueActive
                                      ? "text-ink/85 hover:bg-track"
                                      : "text-ink-secondary hover:bg-elevated hover:text-ink"
                              }`}
                            >
                              {word.text}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Column 3: Separate Style Panel */}
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
              subtitle="Instant preview"
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
