"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Pause, Play, RefreshCw, Volume2, VolumeX } from "lucide-react";
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

const HERO_FEATURED_PRESETS: Array<{ id: string; shortLabel: string }> = [
  { id: "word-highlight", shortLabel: "Highlight" },
  { id: "minimal", shortLabel: "Minimal" },
  { id: "broadcast", shortLabel: "Broadcast" },
  { id: "editorial-serif", shortLabel: "Editorial" },
];

export function HomeHeroDemo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode>("after");
  const [splitPercent, setSplitPercent] = useState(38);
  const [templateId, setTemplateId] = useState<string>(
    HERO_FEATURED_PRESETS[0].id
  );
  const [currentTime, setCurrentTime] = useState(0.5);
  const [duration, setDuration] = useState(SAMPLE_CLIP.duration);
  const [initialized, setInitialized] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const featuredTemplates: Array<{
    tpl: BuiltInStyleTemplate;
    shortLabel: string;
  }> = useMemo(
    () =>
      HERO_FEATURED_PRESETS.map((entry) => ({
        tpl:
          BUILTIN_STYLE_TEMPLATES.find((t) => t.id === entry.id) ??
          BUILTIN_STYLE_TEMPLATES[0],
        shortLabel: entry.shortLabel,
      })),
    []
  );

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
    setMediaError(null);
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
        try {
          await video.play();
        } catch {
          setMediaError("Demo clip could not start playback.");
        }
      }
    } else {
      video.pause();
    }
  }, [duration]);

  const retryMedia = useCallback(() => {
    const video = videoRef.current;
    setMediaError(null);
    if (!video) return;
    video.load();
    void togglePlay();
  }, [togglePlay]);

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
      className="relative mx-auto w-full max-w-[262px] rounded-[1.45rem] border border-ink/12 bg-panel p-2.5 shadow-[0_24px_64px_rgba(0,0,0,0.55)] sm:max-w-[284px] sm:rounded-[1.6rem] sm:p-3 lg:max-w-[300px] xl:max-w-[314px]"
    >
      {/* Top Synchronized Before / After Switcher */}
      <div className="mb-2 flex items-center justify-between gap-1.5 px-0.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
          <span
            className={`h-2 w-2 rounded-full ${
              isPlaying ? "animate-pulse bg-accent" : "bg-ink-muted"
            }`}
          />
          <span>{selectedTemplate.name}</span>
        </span>

        <div
          role="group"
          aria-label="Before and after caption comparison mode"
          className="inline-flex rounded-full border border-ink/12 bg-inset p-0.5 text-[10px] font-semibold"
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
                className={`rounded-full px-2 py-0.5 transition sm:px-2.5 ${
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
      <div className="studio-stage-container relative aspect-[9/16] w-full overflow-hidden rounded-[1.15rem] border border-ink/12 bg-inset sm:rounded-[1.25rem]">
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
          onPlay={() => {
            setMediaError(null);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={() => setMediaError("Could not load demo video.")}
          onClick={() => void togglePlay()}
          className="h-full w-full cursor-pointer object-cover"
        />

        {/* Scrims for caption legibility */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/50 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        {/* Quiet comparison indicators only when comparing Before / Split */}
        {compareMode !== "after" && (
          <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-center justify-between text-[10px] font-semibold">
            <span className="rounded-full border border-ink/15 bg-page/80 px-2 py-0.5 text-ink-secondary backdrop-blur-md">
              Original
            </span>
            {compareMode === "split" && (
              <span className="rounded-full border border-ink/20 bg-page/85 px-2 py-0.5 text-ink backdrop-blur-md">
                Captioned
              </span>
            )}
          </div>
        )}

        {/* Synchronized Caption Overlay Layer */}
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
            <div className="h-full w-0.5 bg-ink/90 shadow-md" />
            <div className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink/30 bg-page text-[9px] font-bold text-ink shadow-lg">
              ↔
            </div>
          </div>
        )}

        {/* Center play affordance positioned below speaker's face */}
        {!isPlaying && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[56%] z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink/25 bg-page/80 text-ink shadow-2xl backdrop-blur-md"
          >
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </div>
        )}
      </div>

      {/* Accessible Split Position Slider (shown in Split mode) */}
      {compareMode === "split" && (
        <div className="mt-1.5 flex items-center gap-2 px-1">
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
          <span className="text-[10px] font-medium text-ink">After</span>
        </div>
      )}

      {/* Media Error / Retry Alert */}
      {mediaError && (
        <div
          role="alert"
          data-testid="hero-media-error"
          className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-rose-400/35 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200"
        >
          <span className="inline-flex items-center gap-1.5 truncate">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{mediaError}</span>
          </span>
          <button
            type="button"
            onClick={retryMedia}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-300/30 bg-panel px-2 py-0.5 font-semibold text-rose-100 hover:border-ink/40"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Compact Single-Row Transport Bar (Play, Mute, Scrubber, Time) */}
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-ink/10 bg-inset px-2 py-1.5">
        <button
          type="button"
          data-testid="hero-play-btn"
          onClick={() => void togglePlay()}
          aria-label={isPlaying ? "Pause demo clip" : "Play demo clip"}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-page transition hover:bg-accent-hover"
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
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-ink/12 bg-panel text-ink-secondary transition hover:border-ink/25 hover:text-ink"
        >
          {isMuted ? (
            <VolumeX className="h-3.5 w-3.5" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </button>

        <div className="relative flex h-5 min-w-0 flex-1 items-center">
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

        <span className="shrink-0 font-mono text-[10px] font-medium tabular-nums text-ink-secondary">
          <span className="text-ink">{formatTime(currentTime)}</span>
          <span className="mx-0.5 text-ink-muted">/</span>
          <span>{formatTime(duration)}</span>
        </span>
      </div>

      {/* Live Style Preset Switcher across distinct categories */}
      <div
        role="group"
        aria-label="Demo caption style presets"
        data-testid="hero-preset-group"
        className="mt-1.5 grid grid-cols-4 gap-1"
      >
        {featuredTemplates.map(({ tpl, shortLabel }) => {
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
              className={`whitespace-nowrap rounded-lg border px-1 py-1 text-[10px] font-semibold transition sm:px-1.5 sm:text-[11px] ${
                selected
                  ? "border-accent bg-accent text-page"
                  : "border-ink/10 bg-inset text-ink-secondary hover:border-ink/25 hover:text-ink"
              }`}
            >
              {shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
