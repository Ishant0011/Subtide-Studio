"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Captions, Pause, Play, Volume2, VolumeX } from "lucide-react";
import {
  CAPTION_PRESETS,
  SAMPLE_CAPTIONS,
  SAMPLE_CLIP,
  formatTime,
  getActiveCue,
  getActiveWord,
  type CaptionPresetId,
} from "@/lib/captions";
import { CaptionOverlay } from "@/components/CaptionOverlay";

export function HomeHeroDemo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [preset, setPreset] = useState<CaptionPresetId>("word-highlight");
  const [currentTime, setCurrentTime] = useState(0.55);
  const [duration, setDuration] = useState(SAMPLE_CLIP.duration);
  const [initialized, setInitialized] = useState(false);

  const activeCue = useMemo(
    () => getActiveCue(SAMPLE_CAPTIONS, currentTime),
    [currentTime]
  );
  const activeWord = useMemo(
    () => getActiveWord(activeCue, currentTime),
    [activeCue, currentTime]
  );

  // Smooth 60fps caption word tracking while playing (strictly user-initiated playback)
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
      video.currentTime = 0.55;
      setCurrentTime(0.55);
      setInitialized(true);
    }
  }, [initialized]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      data-testid="home-hero-demo"
      className="relative mx-auto w-full max-w-[322px] rounded-[1.85rem] border border-accent/25 bg-panel p-3 shadow-[0_32px_90px_rgba(0,0,0,0.75),0_0_60px_rgba(167,139,250,0.12)] sm:max-w-[332px]"
    >
      {/* Top interactive bar: live cue state + Captions toggle */}
      <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
          <span
            className={`h-2 w-2 rounded-full ${
              isPlaying ? "animate-pulse bg-accent" : "bg-accent/70"
            }`}
          />
          <span>Live 9:16 preview</span>
        </span>

        <button
          type="button"
          data-testid="hero-captions-toggle"
          aria-pressed={captionsEnabled}
          onClick={() => setCaptionsEnabled((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
            captionsEnabled
              ? "border-accent/50 bg-accent-soft text-accent-hover"
              : "border-ink/15 bg-page text-ink-secondary hover:text-ink"
          }`}
        >
          <Captions className="h-3.5 w-3.5" />
          <span>{captionsEnabled ? "Captions on" : "Captions off"}</span>
        </button>
      </div>

      {/* Playable 9:16 Portrait Stage */}
      <div className="studio-stage-container relative aspect-[9/16] w-full overflow-hidden rounded-[1.45rem] border border-ink/12 bg-page">
        <video
          ref={videoRef}
          src={SAMPLE_CLIP.src}
          playsInline
          preload="auto"
          muted={isMuted}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={(e) => {
            if (!initialized && e.currentTarget.paused && e.currentTarget.currentTime === 0) {
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

        {/* Scrims for caption readability */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-page/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-page/88 via-page/32 to-transparent" />

        {/* Live Word-Synced Caption Overlay (toggleable, violet accent) */}
        {captionsEnabled && (
          <CaptionOverlay
            activeCue={activeCue}
            activeWord={activeWord}
            preset={preset}
            accent="violet"
            currentTime={currentTime}
          />
        )}

        {/* Non-focusable center play affordance */}
        {!isPlaying && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[43%] z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent/60 bg-page/75 text-accent shadow-2xl backdrop-blur-md"
          >
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          </div>
        )}
      </div>

      {/* User-controlled Playback Bar */}
      <div className="mt-3 rounded-xl border border-ink/10 bg-page px-3 py-2">
        <div className="relative flex h-5 items-center">
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

      {/* Live Preset Switcher (no sign-in required) */}
      <div
        role="group"
        aria-label="Demo caption style presets"
        data-testid="hero-preset-group"
        className="mt-2.5 grid grid-cols-3 gap-1.5"
      >
        {CAPTION_PRESETS.map((item) => {
          const selected = preset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setPreset(item.id);
                if (!captionsEnabled) setCaptionsEnabled(true);
              }}
              className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                selected
                  ? "border-accent bg-accent-soft text-accent-hover"
                  : "border-ink/10 bg-inset text-ink-secondary hover:border-ink/25 hover:text-ink"
              }`}
            >
              {item.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
