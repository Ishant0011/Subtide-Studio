"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Pause,
  Play,
  RefreshCw,
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
import { BUILTIN_STYLE_TEMPLATES } from "@/lib/caption-editor";
import { CaptionOverlay } from "@/components/CaptionOverlay";

type ComparisonView = "original" | "captioned";

const DEFAULT_HERO_TEMPLATE =
  BUILTIN_STYLE_TEMPLATES.find((t) => t.id === "word-highlight") ??
  BUILTIN_STYLE_TEMPLATES[0];

export function HomeHeroDemo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [comparison, setComparison] = useState<ComparisonView>("captioned");
  const [currentTime, setCurrentTime] = useState(0.72);
  const [duration, setDuration] = useState(SAMPLE_CLIP.duration);
  const [initialized, setInitialized] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const activeCue = useMemo(
    () => getActiveCue(SAMPLE_CAPTIONS, currentTime),
    [currentTime]
  );
  const activeWord = useMemo(
    () => getActiveWord(activeCue, currentTime),
    [activeCue, currentTime]
  );

  // Smooth 60fps word tracking during user-initiated playback
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
      video.currentTime = 0.72;
      setCurrentTime(0.72);
      setInitialized(true);
    }
  }, [initialized]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      data-testid="home-hero-demo"
      className="cc-stage-frame relative mx-auto w-full max-w-[316px] rounded-[1.75rem] border border-white/10 p-3 text-ink shadow-[0_28px_72px_rgba(0,0,0,0.56)] sm:max-w-[356px] sm:rounded-[2rem] sm:p-4 lg:max-w-[380px] lg:p-5"
    >
      {/* Quiet Header Bar: Original / Captioned toggle on the same clip without resetting playback */}
      <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
        <span className="text-[11px] font-semibold tracking-tight text-ink/90">
          {comparison === "captioned" ? "Captioned preview" : "Original clip"}
        </span>

        <div
          role="group"
          aria-label="Compare original and captioned video"
          data-testid="hero-compare-group"
          className="inline-flex rounded-full border border-white/12 bg-[#101116]/65 p-0.5 text-[11px] font-semibold"
        >
          <button
            type="button"
            data-testid="hero-compare-original"
            aria-pressed={comparison === "original"}
            onClick={() => setComparison("original")}
            className={`rounded-full px-2.5 py-1 transition ${
              comparison === "original"
                ? "bg-accent text-page shadow-sm"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Original
          </button>
          <button
            type="button"
            data-testid="hero-compare-captioned"
            aria-pressed={comparison === "captioned"}
            onClick={() => setComparison("captioned")}
            className={`rounded-full px-2.5 py-1 transition ${
              comparison === "captioned"
                ? "bg-accent text-page shadow-sm"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Captioned
          </button>
        </div>
      </div>

      {/* Large 9:16 Footage Stage — footage and captions dominate the visual hierarchy */}
      <div className="studio-stage-container relative mx-auto aspect-[9/16] w-full max-w-[244px] overflow-hidden rounded-[1.25rem] bg-[#101116] shadow-[0_18px_42px_rgba(16,17,22,0.5)] sm:max-w-[288px] lg:max-w-[308px]">
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

        {/* Bottom legibility scrim */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        {/* Captioned Layer (toggles without touching video playback or currentTime) */}
        {comparison === "captioned" && (
          <div
            data-testid="hero-captioned-layer"
            className="pointer-events-none absolute inset-0 z-20"
          >
            <CaptionOverlay
              activeCue={activeCue}
              activeWord={activeWord}
              preset={DEFAULT_HERO_TEMPLATE.style.preset}
              fontSize={DEFAULT_HERO_TEMPLATE.style.fontSize}
              verticalPosition={DEFAULT_HERO_TEMPLATE.style.verticalPosition}
              accent={DEFAULT_HERO_TEMPLATE.style.accent}
              styleConfig={DEFAULT_HERO_TEMPLATE.style}
              currentTime={currentTime}
            />
          </div>
        )}

        {/* Discreet center Play affordance when paused */}
        {!isPlaying && (
          <button
            type="button"
            onClick={() => void togglePlay()}
            aria-label="Play captioned demo video"
            className="absolute left-1/2 top-[54%] z-20 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-[#0D0E12]/75 text-ink shadow-xl backdrop-blur-md transition hover:scale-105 hover:bg-[#0D0E12]/90 motion-reduce:transition-none"
          >
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </button>
        )}
      </div>

      {/* Media Error / Retry Alert */}
      {mediaError && (
        <div
          role="alert"
          data-testid="hero-media-error"
          className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-rose-600/30 bg-rose-950/90 px-3 py-2 text-[11px] text-rose-100"
        >
          <span className="inline-flex items-center gap-1.5 truncate">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{mediaError}</span>
          </span>
          <button
            type="button"
            onClick={retryMedia}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-300/30 bg-rose-900 px-2 py-0.5 font-semibold text-white hover:bg-rose-800"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Whisper-quiet Transport Bar */}
      <div className="mx-auto mt-2.5 flex w-full max-w-[244px] items-center gap-2 rounded-xl bg-[#0D0E12]/90 px-2.5 py-1.5 text-ink sm:max-w-[288px] lg:max-w-[308px]">
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

        <div className="relative flex h-5 min-w-0 flex-1 items-center">
          <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-white/15">
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

        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute demo clip" : "Mute demo clip"}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-white/10 hover:text-ink"
        >
          {isMuted ? (
            <VolumeX className="h-3.5 w-3.5" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
