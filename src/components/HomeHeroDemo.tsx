"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import {
  SAMPLE_CAPTIONS,
  SAMPLE_CLIP,
  formatTime,
  getActiveCue,
  getActiveWord,
} from "@/lib/captions";
import {
  BUILTIN_STYLE_TEMPLATES,
  type BuiltInStyleTemplate,
} from "@/lib/caption-editor";
import { CaptionOverlay } from "@/components/CaptionOverlay";

type CompareMode = "split" | "after" | "before";

export function HomeHeroDemo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode>("after");
  const [splitPercent, setSplitPercent] = useState(34);
  const [templateId, setTemplateId] = useState<string>(
    BUILTIN_STYLE_TEMPLATES[0].id
  );
  const [currentTime, setCurrentTime] = useState(0.5);
  const [duration, setDuration] = useState(SAMPLE_CLIP.duration);
  const [initialized, setInitialized] = useState(false);

  const selectedTemplate: BuiltInStyleTemplate = useMemo(
    () =>
      BUILTIN_STYLE_TEMPLATES.find((t) => t.id === templateId) ??
      BUILTIN_STYLE_TEMPLATES[0],
    [templateId]
  );

  const activeCue = useMemo(
    () => getActiveCue(SAMPLE_CAPTIONS, currentTime),
    [currentTime]
  );
  const activeWord = useMemo(
    () => getActiveWord(activeCue, currentTime),
    [activeCue, currentTime]
  );

  // Smooth 60fps word tracking while playing (strictly user-initiated playback)
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) setCurrentTime(video.currentTime);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying]);

  const seekTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(duration, next));
      const video = videoRef.current;
      if (video) video.currentTime = clamped;
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
    if (!initialized) {
      video.currentTime = 0.5;
      setCurrentTime(0.5);
      setInitialized(true);
    }
  }, [initialized]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const showCaptionsLayer = compareMode !== "before";
  const clipStyle =
    compareMode === "split"
      ? { clipPath: `inset(0 0 0 ${splitPercent}%)` }
      : undefined;

  return (
    <div
      data-testid="home-hero-demo"
      className="relative mx-auto w-full max-w-[292px] rounded-[1.6rem] border border-accent/25 bg-panel p-2.5 shadow-[0_32px_90px_rgba(0,0,0,0.75),0_0_60px_rgba(167,139,250,0.12)] sm:max-w-[350px] sm:rounded-[1.85rem] sm:p-3 lg:max-w-[clamp(17.5rem,37svh,23rem)]"
    >
      {/* Top Synchronized Before / After Switcher */}
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5 sm:mb-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
          <span
            className={`h-2 w-2 rounded-full ${
              isPlaying ? "animate-pulse bg-accent" : "bg-accent/70"
            }`}
          />
          <span>Before / After</span>
        </span>

        <div
          role="group"
          aria-label="Before and after caption comparison mode"
          className="inline-flex rounded-full border border-ink/12 bg-page p-0.5 text-[10px] font-semibold"
        >
          {(
            [
              { id: "before", label: "Before" },
              { id: "split", label: "Split" },
              { id: "after", label: "After" },
            ] as const
          ).map((mode) => {
            const active = compareMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                data-testid={`before-after-mode-${mode.id}`}
                aria-pressed={active}
                onClick={() => setCompareMode(mode.id)}
                className={`min-h-7 rounded-full px-2.5 py-1 transition sm:px-3 ${
                  active
                    ? "bg-accent text-page"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Synchronized Single-Video 9:16 Stage */}
      <div className="studio-stage-container relative aspect-[9/16] w-full overflow-hidden rounded-[1.25rem] border border-ink/12 bg-page sm:rounded-[1.45rem]">
        <video
          ref={videoRef}
          src={SAMPLE_CLIP.src}
          poster={SAMPLE_CLIP.poster}
          playsInline
          preload="auto"
          muted={isMuted}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={(e) => {
            if (
              !initialized &&
              e.currentTarget.paused &&
              e.currentTarget.currentTime === 0
            ) {
              return;
            }
            setCurrentTime(e.currentTarget.currentTime);
          }}
          onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onClick={() => void togglePlay()}
          className="h-full w-full cursor-pointer object-cover"
        />

        {/* Scrims for caption legibility */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-page/65 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-page/85 via-page/30 to-transparent" />

        {/* Before / After Corner Labels */}
        <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-20 flex items-center justify-between text-[10px] font-semibold">
          {compareMode !== "after" ? (
            <span className="rounded-full border border-ink/15 bg-page/80 px-2 py-0.5 text-ink-secondary backdrop-blur-md">
              Before · Raw
            </span>
          ) : (
            <span />
          )}
          {compareMode !== "before" && (
            <span className="rounded-full border border-accent/45 bg-accent-soft/90 px-2 py-0.5 text-accent-hover backdrop-blur-md">
              After · {selectedTemplate.name}
            </span>
          )}
        </div>

        {/* Synchronized Caption Overlay Layer (clipped live in Split mode) */}
        {showCaptionsLayer && (
          <div
            data-testid="before-after-captioned-layer"
            style={clipStyle}
            className="pointer-events-none absolute inset-0 z-20"
          >
            <CaptionOverlay
              activeCue={activeCue}
              activeWord={activeWord}
              preset={selectedTemplate.style.preset}
              fontSize={selectedTemplate.style.fontSize}
              verticalPosition={selectedTemplate.style.verticalPosition}
              accent={selectedTemplate.style.accent}
              styleConfig={selectedTemplate.style}
              currentTime={currentTime}
            />
          </div>
        )}

        {/* Split Divider Line in Split mode */}
        {compareMode === "split" && (
          <div
            aria-hidden="true"
            style={{ left: `${splitPercent}%` }}
            className="pointer-events-none absolute bottom-0 top-0 z-30 -translate-x-1/2"
          >
            <div className="h-full w-0.5 bg-accent shadow-[0_0_12px_rgba(167,139,250,0.9)]" />
            <div className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent bg-page text-[9px] font-bold text-accent-hover shadow-lg">
              ↔
            </div>
          </div>
        )}

        {/* Center play affordance (positioned below face over chest) */}
        {!isPlaying && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[56%] z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent/60 bg-page/75 text-accent shadow-2xl backdrop-blur-md"
          >
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </div>
        )}
      </div>

      {/* Accessible Split Position Slider (shown in Split mode) */}
      {compareMode === "split" && (
        <div className="mt-2 flex items-center gap-2 px-1">
          <span className="text-[10px] font-medium text-ink-muted">Before</span>
          <input
            type="range"
            min={5}
            max={95}
            step={1}
            value={splitPercent}
            data-testid="before-after-slider"
            onChange={(e) => setSplitPercent(Number(e.target.value))}
            aria-label="Adjust before and after split position"
            className="studio-scrubber h-4 flex-1"
          />
          <span className="text-[10px] font-medium text-accent-hover">
            After
          </span>
        </div>
      )}

      {/* Playback Bar */}
      <div className="mt-2 rounded-xl border border-ink/10 bg-page px-3 py-2">
        <div className="relative flex h-4 items-center">
          <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            aria-label="Seek demo video"
            className="studio-scrubber relative z-10 w-full"
          />
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="hero-play-btn"
              onClick={() => void togglePlay()}
              aria-label={isPlaying ? "Pause demo clip" : "Play demo clip"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-page transition hover:bg-accent-hover"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute demo clip" : "Mute demo clip"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink/12 bg-panel text-ink-secondary transition hover:border-accent/50 hover:text-ink"
            >
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <span className="font-mono text-[11px] font-medium tabular-nums text-ink-secondary">
            <span className="text-ink">{formatTime(currentTime)}</span>
            <span className="mx-1 text-ink-muted">/</span>
            <span>{formatTime(duration)}</span>
          </span>
        </div>
      </div>

      {/* Live Style Preset Switcher (no sign-in required) */}
      <div
        role="group"
        aria-label="Demo caption style presets"
        data-testid="hero-preset-group"
        className="mt-2 flex flex-wrap gap-1.5"
      >
        {BUILTIN_STYLE_TEMPLATES.map((tpl) => {
          const selected = templateId === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setTemplateId(tpl.id);
                if (compareMode === "before") setCompareMode("after");
              }}
              className={`flex-1 basis-[30%] rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition ${
                selected
                  ? "border-accent bg-accent-soft text-accent-hover"
                  : "border-ink/10 bg-inset text-ink-secondary hover:border-ink/25 hover:text-ink"
              }`}
            >
              {tpl.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
