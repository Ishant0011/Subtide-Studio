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
      className="mx-auto w-full max-w-[356px] rounded-[2rem] border border-[#F5F1E8]/12 bg-[#0D131C] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.68)]"
    >
      {/* Top interactive bar: Captions toggle + format pill */}
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#B6B0A4]">
          <span
            className={`h-2 w-2 rounded-full ${
              isPlaying ? "animate-pulse bg-[#49E6B3]" : "bg-[#49E6B3]/60"
            }`}
          />
          <span>Interactive 9:16 demo</span>
        </span>

        <button
          type="button"
          data-testid="hero-captions-toggle"
          aria-pressed={captionsEnabled}
          onClick={() => setCaptionsEnabled((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
            captionsEnabled
              ? "border-[#49E6B3]/45 bg-[#102E28] text-[#49E6B3]"
              : "border-[#F5F1E8]/15 bg-[#070B10] text-[#B6B0A4] hover:text-[#F5F1E8]"
          }`}
        >
          <Captions className="h-3.5 w-3.5" />
          <span>{captionsEnabled ? "Captions on" : "Captions off"}</span>
        </button>
      </div>

      {/* Playable 9:16 Portrait Stage */}
      <div className="studio-stage-container relative aspect-[9/16] w-full overflow-hidden rounded-[1.45rem] border border-[#F5F1E8]/10 bg-[#070B10]">
        <video
          ref={videoRef}
          src={SAMPLE_CLIP.src}
          playsInline
          preload="auto"
          muted={isMuted}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onClick={() => void togglePlay()}
          className="h-full w-full cursor-pointer object-cover"
        />

        {/* Scrims for caption readability */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#070B10]/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#070B10]/85 via-[#070B10]/30 to-transparent" />

        {/* Live Word-Synced Caption Overlay (toggleable) */}
        {captionsEnabled && (
          <CaptionOverlay
            activeCue={activeCue}
            activeWord={activeWord}
            preset={preset}
            currentTime={currentTime}
          />
        )}

        {/* Non-focusable center play affordance */}
        {!isPlaying && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[43%] z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#49E6B3]/55 bg-[#070B10]/75 text-[#49E6B3] shadow-2xl backdrop-blur-md"
          >
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          </div>
        )}
      </div>

      {/* User-controlled Playback Bar */}
      <div className="mt-2.5 rounded-xl border border-[#F5F1E8]/10 bg-[#070B10] px-3 py-2">
        <div className="relative flex h-5 items-center">
          <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-[#1A2636]">
            <div
              className="h-full rounded-full bg-[#49E6B3]"
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#49E6B3] text-[#070B10] transition hover:bg-[#2FD49F]"
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#F5F1E8]/12 bg-[#0D131C] text-[#B6B0A4] transition hover:border-[#49E6B3]/40 hover:text-[#F5F1E8]"
            >
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <span className="font-mono text-[11px] font-medium tabular-nums text-[#B6B0A4]">
            <span className="text-[#F5F1E8]">{formatTime(currentTime)}</span>
            <span className="mx-1 text-[#8C887F]">/</span>
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
                  ? "border-[#49E6B3] bg-[#102E28] text-[#49E6B3]"
                  : "border-[#F5F1E8]/10 bg-[#0A1018] text-[#B6B0A4] hover:border-[#F5F1E8]/25 hover:text-[#F5F1E8]"
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
