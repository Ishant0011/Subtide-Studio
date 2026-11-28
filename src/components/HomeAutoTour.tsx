"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

interface TourChapter {
  id: string;
  label: string;
  shortLabel: string;
  start: number;
  end: number;
  summary: string;
}

const CHAPTERS: ReadonlyArray<TourChapter> = [
  {
    id: "transcribe",
    label: "Transcribe",
    shortLabel: "Transcribe",
    start: 0,
    end: 4,
    summary: "Speech turns into word-timed captions automatically.",
  },
  {
    id: "style",
    label: "Style",
    shortLabel: "Style",
    start: 4,
    end: 8,
    summary: "Switch between Clean, Word Highlight, Bold, and saved presets.",
  },
  {
    id: "edit",
    label: "Edit",
    shortLabel: "Edit",
    start: 8,
    end: 13,
    summary: "Fix a misheard word inline and nudge timing with autosave.",
  },
  {
    id: "translate",
    label: "Translate & assist",
    shortLabel: "Translate",
    start: 13,
    end: 19,
    summary: "Translate to Hindi (Devanagari) or preview AI Assist polish.",
  },
  {
    id: "export",
    label: "Export",
    shortLabel: "Export",
    start: 19,
    end: 24,
    summary: "Choose MP4 resolution up to source quality and download.",
  },
];

const TOUR_DURATION = 24;

function chapterIndexAt(time: number): number {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) {
    if (time >= CHAPTERS[i].start) return i;
  }
  return 0;
}

function fmtSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `0:${String(s).padStart(2, "0")}`;
}

export function HomeAutoTour() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userPausedRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(TOUR_DURATION);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Attempt muted inline autoplay on cold load unless reduced-motion is enabled
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
    v.muted = true;
    const playPromise = v.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => {
          setAutoplayBlocked(true);
          setIsPlaying(false);
        });
    }
  }, []);

  // Pause automatically if visitor plays another clip on the page
  useEffect(() => {
    const onPauseTour = () => {
      const v = videoRef.current;
      if (v && !v.paused) {
        v.pause();
        userPausedRef.current = true;
      }
    };
    window.addEventListener("clipcaptions:pause-tour", onPauseTour);
    return () =>
      window.removeEventListener("clipcaptions:pause-tour", onPauseTour);
  }, []);

  const togglePlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (v.ended || v.currentTime >= duration - 0.1) {
        v.currentTime = 0;
        setCurrentTime(0);
        setActiveIdx(0);
        setEnded(false);
      }
      userPausedRef.current = false;
      v.muted = true;
      try {
        await v.play();
        setAutoplayBlocked(false);
      } catch {
        setAutoplayBlocked(true);
      }
    } else {
      userPausedRef.current = true;
      v.pause();
    }
  }, [duration]);

  const replayTour = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    userPausedRef.current = false;
    setEnded(false);
    setActiveIdx(0);
    setCurrentTime(0);
    v.currentTime = 0;
    v.muted = true;
    try {
      await v.play();
      setAutoplayBlocked(false);
    } catch {
      setAutoplayBlocked(true);
    }
  }, []);

  const seekToChapter = useCallback((idx: number) => {
    const chapter = CHAPTERS[idx];
    if (!chapter) return;
    // Update selected state immediately on first press, independent of scroll
    setActiveIdx(idx);
    setCurrentTime(chapter.start);
    setEnded(false);
    const v = videoRef.current;
    if (v) {
      v.currentTime = chapter.start + 0.05;
      if (v.paused && !userPausedRef.current && !reducedMotion) {
        v.muted = true;
        v.play().catch(() => {});
      }
    }
  }, [reducedMotion]);

  const handleScrub = useCallback((nextTime: number) => {
    const clamped = Math.max(0, Math.min(duration, nextTime));
    setCurrentTime(clamped);
    setActiveIdx(chapterIndexAt(clamped));
    setEnded(false);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  }, [duration]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      data-testid="home-auto-tour"
      data-active-chapter={CHAPTERS[activeIdx].id}
      className="mt-4 w-full sm:mt-5"
    >
      {/* Charcoal #181B25 Video Stage — reserved 16:9 dimensions, zero cropping, controls inside 1280x800 */}
      <div className="relative overflow-hidden rounded-2xl bg-[#181B25] shadow-[0_24px_60px_rgba(24,27,37,0.18)] sm:rounded-[1.5rem]">
        <div className="relative aspect-video w-full overflow-hidden bg-[#181B25] lg:aspect-auto lg:h-[385px]">
          <video
            ref={videoRef}
            data-testid="tour-video"
            src="/home/clipcaptions-tour.mp4"
            poster="/home/clipcaptions-tour-poster.jpg"
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => {
              if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
                setDuration(e.currentTarget.duration);
              }
            }}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              setCurrentTime(t);
              setActiveIdx(chapterIndexAt(t));
            }}
            onPlay={() => {
              setIsPlaying(true);
              setEnded(false);
            }}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setEnded(true);
              setActiveIdx(CHAPTERS.length - 1);
            }}
            onClick={() => void togglePlay()}
            className="h-full w-full cursor-pointer object-contain"
          />

          {/* Explicit Replay overlay when tour lands on final shot */}
          {ended && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#181B25]/35 backdrop-blur-[2px]">
              <button
                type="button"
                data-testid="tour-replay-overlay"
                onClick={() => void replayTour()}
                aria-label="Replay tour"
                className="inline-flex items-center gap-2 rounded-full bg-[#2648DB] px-5 py-2.5 text-sm font-semibold text-white shadow-xl transition hover:bg-[#1E3BC0]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Replay tour</span>
              </button>
            </div>
          )}

          {/* Explicit Play tour button if autoplay is blocked or reduced motion is enabled */}
          {!isPlaying && !ended && (autoplayBlocked || reducedMotion) && (
            <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
              <button
                type="button"
                data-testid="tour-play-explicit"
                onClick={() => void togglePlay()}
                aria-label="Play tour"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#2648DB] px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-[#1E3BC0] sm:text-sm"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Play tour</span>
              </button>
            </div>
          )}
        </div>

        {/* Slim Progress Bar & Accessible Controls */}
        <div className="border-t border-white/10 bg-[#181B25] px-3 py-2.5 text-[#FAF7F0] sm:px-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              data-testid="tour-play-pause"
              onClick={() => void togglePlay()}
              aria-label={isPlaying ? "Pause tour" : "Play tour"}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2648DB] text-white transition hover:bg-[#1E3BC0]"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
              )}
            </button>

            <button
              type="button"
              data-testid="tour-replay"
              onClick={() => void replayTour()}
              aria-label="Replay tour"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#FAF7F0] transition hover:bg-white/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            <div className="relative flex h-5 min-w-0 flex-1 items-center">
              <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-[#5B7CFF]"
                  style={{
                    width: `${Math.min(100, Math.max(0, progressPct))}%`,
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={currentTime}
                onChange={(e) => handleScrub(parseFloat(e.target.value))}
                aria-label="Seek product tour"
                className="studio-scrubber relative z-10 w-full"
              />
            </div>

            <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#C9CEDE]">
              {fmtSec(currentTime)} / {fmtSec(duration)}
            </span>
          </div>

          {/* Clickable Chapter Labels (independent of scroll position) */}
          <div
            role="group"
            aria-label="Product tour chapters"
            className="mt-2.5 flex flex-wrap items-center gap-1.5"
          >
            {CHAPTERS.map((ch, idx) => {
              const active = idx === activeIdx;
              return (
                <button
                  key={ch.id}
                  type="button"
                  data-testid={`tour-chapter-${ch.id}`}
                  aria-pressed={active}
                  onClick={() => seekToChapter(idx)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition sm:text-xs ${
                    active
                      ? "bg-[#2648DB] text-white"
                      : "bg-white/8 text-[#C9CEDE] hover:bg-white/15 hover:text-white"
                  }`}
                >
                  <span className="sm:hidden">{ch.shortLabel}</span>
                  <span className="hidden sm:inline">{ch.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Static chapter summary shown when reduced motion is enabled or autoplay is blocked */}
      {(reducedMotion || autoplayBlocked) && (
        <ol
          data-testid="tour-static-summary"
          className="mt-3 grid grid-cols-1 gap-2 text-left sm:grid-cols-5"
        >
          {CHAPTERS.map((ch, idx) => (
            <li
              key={ch.id}
              className="rounded-xl border border-[#181B25]/10 bg-white px-3 py-2 text-xs"
            >
              <span className="font-semibold text-[#2648DB]">
                0{idx + 1} · {ch.label}
              </span>
              <p className="mt-0.5 text-[#50566A]">{ch.summary}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
