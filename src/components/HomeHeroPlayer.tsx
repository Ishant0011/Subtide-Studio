"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
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

type CaptionViewMode = "captioned" | "original";

const OPENING_POSTER_TIME = 0.72;

export function HomeHeroPlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userPausedRef = useRef(false);
  const hasPlayedOnceRef = useRef(false);

  const [viewMode, setViewMode] = useState<CaptionViewMode>("captioned");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [ended, setEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(OPENING_POSTER_TIME);
  const [duration, setDuration] = useState(SAMPLE_CLIP.duration);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Derive active cue & word strictly from media time (null during silence once playing;
  // opening cue visible before playback starts so poster has one complete readable caption;
  // final cue held intentionally when playback ends)
  const activeCue = useMemo(() => {
    if (ended) {
      return SAMPLE_CAPTIONS[SAMPLE_CAPTIONS.length - 1];
    }
    if (!hasPlayedOnceRef.current && !isPlaying && currentTime === OPENING_POSTER_TIME) {
      return SAMPLE_CAPTIONS[0];
    }
    return getActiveCue(SAMPLE_CAPTIONS, currentTime);
  }, [currentTime, ended, isPlaying]);

  const activeWord = useMemo(() => {
    if (!activeCue) return null;
    if (ended) {
      return activeCue.words[activeCue.words.length - 1] ?? null;
    }
    return getActiveWord(activeCue, currentTime);
  }, [activeCue, currentTime, ended]);

  // Smooth 60fps word tracking while playing
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) setCurrentTime(v.currentTime);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying]);

  // Attempt muted inline autoplay on mount unless reduced motion is preferred.
  // Never leave a spinner over a usable poster if autoplay is refused.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) {
      setReducedMotion(true);
      return;
    }

    const v = videoRef.current;
    if (!v) return;
    if (v.error || v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
      setIsPlaying(false);
      setMediaError("Could not load the sample video.");
      return;
    }
    v.muted = true;
    const p = v.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        setAutoplayBlocked(false);
      }).catch((err: unknown) => {
        const name = err instanceof Error ? err.name : "";
        if (
          v.error ||
          v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE ||
          name === "NotSupportedError"
        ) {
          setMediaError("Could not load the sample video.");
        } else {
          setAutoplayBlocked(true);
        }
        setIsPlaying(false);
      });
    }
  }, []);

  // Pause hero player if visitor plays a clip lower on the page
  useEffect(() => {
    const onPauseTour = () => {
      const v = videoRef.current;
      if (v && !v.paused) {
        userPausedRef.current = true;
        v.pause();
      }
    };
    window.addEventListener("clipcaptions:pause-tour", onPauseTour);
    return () =>
      window.removeEventListener("clipcaptions:pause-tour", onPauseTour);
  }, []);

  const togglePlayPause = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    setMediaError(null);

    if (!v.paused && !v.ended) {
      userPausedRef.current = true;
      v.pause();
      return;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clipcaptions:pause-gallery"));
    }
    userPausedRef.current = false;
    if (v.ended || ended || v.currentTime >= duration - 0.05) {
      v.currentTime = 0;
      setCurrentTime(0);
      setEnded(false);
    }

    try {
      await v.play();
      setAutoplayBlocked(false);
    } catch {
      // If unmuted play was rejected, retry muted so user still gets playback
      v.muted = true;
      setIsMuted(true);
      try {
        await v.play();
        setAutoplayBlocked(false);
      } catch {
        setAutoplayBlocked(true);
      }
    }
  }, [duration, ended]);

  const replayClip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    setMediaError(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clipcaptions:pause-gallery"));
    }
    userPausedRef.current = false;
    setEnded(false);
    v.currentTime = 0;
    setCurrentTime(0);
    try {
      await v.play();
      setAutoplayBlocked(false);
    } catch {
      v.muted = true;
      setIsMuted(true);
      try {
        await v.play();
        setAutoplayBlocked(false);
      } catch {
        setAutoplayBlocked(true);
      }
    }
  }, []);

  const toggleSound = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const nextMuted = !v.muted;
    v.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  const seekTo = useCallback(
    (nextSec: number) => {
      const clamped = Math.max(0, Math.min(duration, nextSec));
      const v = videoRef.current;
      if (v) v.currentTime = clamped;
      setCurrentTime(clamped);
      if (clamped < duration - 0.05) setEnded(false);
    },
    [duration]
  );

  const retryMedia = useCallback(() => {
    const v = videoRef.current;
    setMediaError(null);
    if (!v) return;
    v.load();
    void togglePlayPause();
  }, [togglePlayPause]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      data-testid="home-hero-player"
      data-view-mode={viewMode}
      data-media-playing={isPlaying ? "true" : "false"}
      data-media-muted={isMuted ? "true" : "false"}
      data-autoplay-blocked={autoplayBlocked ? "true" : "false"}
      className="w-full"
    >
      {/* Charcoal #181B25 Film Frame — intentionally frames the 9:16 portrait without stretching */}
      <div className="relative overflow-hidden rounded-2xl bg-[#181B25] p-2.5 shadow-[0_24px_60px_rgba(24,27,37,0.18)] sm:rounded-[1.5rem] sm:p-3.5">
        {/* Top Row: Original / Captioned toggle — updates ONLY caption layer, never remounts <video> */}
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <span className="text-xs font-semibold text-[#C9CEDE]">
            {viewMode === "captioned" ? "Captioned" : "Original"}
          </span>

          <div
            role="group"
            aria-label="Caption display mode"
            data-testid="hero-compare-group"
            className="inline-flex rounded-xl bg-white/10 p-0.5 text-xs font-semibold"
          >
            <button
              type="button"
              data-testid="hero-compare-original"
              aria-pressed={viewMode === "original"}
              onClick={() => setViewMode("original")}
              className={`min-h-[34px] rounded-lg px-3 py-1 transition ${
                viewMode === "original"
                  ? "bg-[#2648DB] text-white shadow-sm"
                  : "text-[#C9CEDE] hover:text-white"
              }`}
            >
              Original
            </button>
            <button
              type="button"
              data-testid="hero-compare-captioned"
              aria-pressed={viewMode === "captioned"}
              onClick={() => setViewMode("captioned")}
              className={`min-h-[34px] rounded-lg px-3 py-1 transition ${
                viewMode === "captioned"
                  ? "bg-[#2648DB] text-white shadow-sm"
                  : "text-[#C9CEDE] hover:text-white"
              }`}
            >
              Captioned
            </button>
          </div>
        </div>

        {/* Portrait-Intentional Stage (9:16 video centered cleanly inside charcoal frame; zero stretching) */}
        <div className="relative flex h-[350px] w-full items-center justify-center overflow-hidden rounded-xl bg-[#10121A] sm:h-[430px] lg:h-[470px]">
          <div className="relative aspect-[9/16] h-full max-w-full overflow-hidden rounded-lg bg-[#10121A]">
            <video
              ref={videoRef}
              data-testid="hero-video"
              src={SAMPLE_CLIP.src}
              poster={SAMPLE_CLIP.poster}
              muted={isMuted}
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => {
                if (
                  Number.isFinite(e.currentTarget.duration) &&
                  e.currentTarget.duration > 0
                ) {
                  setDuration(e.currentTarget.duration);
                }
              }}
              onTimeUpdate={(e) => {
                if (!hasPlayedOnceRef.current && e.currentTarget.paused && e.currentTarget.currentTime === 0) {
                  return;
                }
                setCurrentTime(e.currentTarget.currentTime);
              }}
              onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onPlay={() => {
                hasPlayedOnceRef.current = true;
                setMediaError(null);
                setEnded(false);
                setIsPlaying(true);
              }}
              onPause={() => setIsPlaying(false)}
              onEnded={() => {
                setIsPlaying(false);
                setEnded(true);
              }}
              onError={() => {
                setIsPlaying(false);
                setMediaError("Could not load the sample video.");
              }}
              onClick={() => void togglePlayPause()}
              className="h-full w-full cursor-pointer object-cover object-[50%_20%]"
            />

            {/* Bottom legibility gradient scrim */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#10121A]/90 via-[#10121A]/30 to-transparent" />

            {/* Live Word-Timed Caption Layer — separate from poster pixels so Original removes it completely */}
            {viewMode === "captioned" && activeCue && !mediaError && (
              <div
                data-testid="hero-captioned-layer"
                className="pointer-events-none absolute inset-x-2.5 bottom-4 z-10 flex flex-wrap justify-center gap-1 text-center sm:inset-x-3 sm:bottom-5"
              >
                {activeCue.words.map((w) => {
                  const isActive = activeWord?.id === w.id;
                  return (
                    <span
                      key={w.id}
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className={`rounded-md px-1.5 py-0.5 text-sm font-extrabold uppercase leading-tight tracking-tight transition-transform duration-100 motion-reduce:transition-none sm:text-base ${
                        isActive
                          ? "scale-[1.06] bg-[#2648DB] text-white shadow-[0_6px_18px_rgba(38,72,219,0.55)]"
                          : "bg-[#181B25]/88 text-[#FAF7F0]"
                      }`}
                    >
                      {w.text}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Usable Play fallback when autoplay is blocked or reduced motion is enabled */}
            {!isPlaying && !ended && !mediaError && (autoplayBlocked || reducedMotion) && (
              <button
                type="button"
                data-testid="hero-play-overlay"
                onClick={() => void togglePlayPause()}
                aria-label="Play sample video"
                className="absolute left-1/2 top-[48%] z-20 inline-flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#2648DB] text-white shadow-xl transition hover:scale-105 hover:bg-[#1E3BC0]"
              >
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              </button>
            )}

            {/* Intentional End-of-Clip Replay CTA */}
            {ended && !mediaError && (
              <button
                type="button"
                data-testid="hero-replay-overlay"
                onClick={() => void replayClip()}
                aria-label="Replay sample video"
                className="absolute left-1/2 top-[44%] z-20 inline-flex items-center gap-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2648DB] px-4 py-2 text-xs font-semibold text-white shadow-xl transition hover:bg-[#1E3BC0] sm:text-sm"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Replay</span>
              </button>
            )}

            {/* Media Error + Retry Recovery */}
            {mediaError && (
              <div
                role="alert"
                data-testid="hero-media-error"
                className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#181B25]/92 p-4 text-center text-[#FAF7F0]"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold sm:text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{mediaError}</span>
                </span>
                <button
                  type="button"
                  data-testid="hero-media-retry"
                  onClick={retryMedia}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#2648DB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3BC0]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Transport Bar — Play/Pause, Replay, Scrubber, Sound On/Off (44px-friendly touch targets) */}
        <div
          data-testid="hero-transport-bar"
          className="mt-2.5 flex items-center gap-2 rounded-xl bg-white/8 px-2 py-1.5 text-[#FAF7F0]"
        >
          <button
            type="button"
            data-testid="hero-play-pause"
            onClick={() => void (ended ? replayClip() : togglePlayPause())}
            aria-label={
              ended
                ? "Replay sample video"
                : isPlaying
                  ? "Pause sample video"
                  : "Play sample video"
            }
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2648DB] text-white transition hover:bg-[#1E3BC0]"
          >
            {ended ? (
              <RotateCcw className="h-4 w-4" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            )}
          </button>

          <button
            type="button"
            data-testid="hero-replay-btn"
            onClick={() => void replayClip()}
            aria-label="Replay from start"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#FAF7F0] transition hover:bg-white/20"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <div className="relative flex h-6 min-w-0 flex-1 items-center">
            <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-[#5B7CFF]"
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
              aria-label="Seek sample video"
              className="studio-scrubber relative z-10 w-full"
            />
          </div>

          <span className="hidden shrink-0 font-mono text-[11px] tabular-nums text-[#C9CEDE] sm:inline">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <button
            type="button"
            data-testid="hero-sound-btn"
            onClick={toggleSound}
            aria-pressed={!isMuted}
            aria-label={isMuted ? "Turn sound on" : "Turn sound off"}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${
              !isMuted
                ? "bg-[#2648DB] text-white"
                : "bg-white/10 text-[#FAF7F0] hover:bg-white/20"
            }`}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 shrink-0" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0" />
            )}
            <span className="hidden sm:inline">
              {isMuted ? "Sound off" : "Sound on"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
