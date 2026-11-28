"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";

interface CreatorClip {
  id: string;
  label: string;
  styleName: string;
  poster: string;
  videoSrc: string;
  alt: string;
  captionLine: string;
}

const CREATOR_CLIPS: ReadonlyArray<CreatorClip> = [
  {
    id: "street",
    label: "Street interview",
    styleName: "Word Highlight",
    poster: "/home/use-case-reels.jpg",
    videoSrc: "/home/clip-street.mp4",
    alt: "Street interview creator filming outdoors at golden hour",
    captionLine: "STOP SCROLLING IN TWO SECONDS.",
  },
  {
    id: "podcast",
    label: "Podcast",
    styleName: "Boxed Quote",
    poster: "/home/use-case-podcast.jpg",
    videoSrc: "/home/clip-podcast.mp4",
    alt: "Two podcast hosts talking in a warm studio",
    captionLine: "“That single conversation changed the season.”",
  },
  {
    id: "tutorial",
    label: "Tutorial",
    styleName: "Clean",
    poster: "/home/use-case-tutorial.jpg",
    videoSrc: "/home/clip-tutorial.mp4",
    alt: "Instructor demonstrating a camera lens at a studio desk",
    captionLine: "Step 2: lock focus before rolling.",
  },
  {
    id: "product",
    label: "Product demo",
    styleName: "Bold Display",
    poster: "/home/use-case-product.jpg",
    videoSrc: "/home/clip-product.mp4",
    alt: "Creator demonstrating a wireless audio device at a sunlit desk",
    captionLine: "STUDIO SOUND IN ONE CLIP.",
  },
];

export function HomeCreatorGallery() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const selectionTokenRef = useRef(0);
  const activeIdRef = useRef<string>(CREATOR_CLIPS[0].id);
  const wantPlayRef = useRef(false);

  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const activeClip = CREATOR_CLIPS[activeIdx];

  const pauseOtherMedia = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clipcaptions:pause-tour"));
    }
  };

  useEffect(() => {
    const onPauseGallery = () => {
      wantPlayRef.current = false;
      setIsLoading(false);
      videoRef.current?.pause();
    };
    window.addEventListener("clipcaptions:pause-gallery", onPauseGallery);
    return () =>
      window.removeEventListener("clipcaptions:pause-gallery", onPauseGallery);
  }, []);

  const attemptPlayForToken = useCallback((token: number, expectedId: string) => {
    const v = videoRef.current;
    if (!v || selectionTokenRef.current !== token || activeIdRef.current !== expectedId) {
      return;
    }
    v.muted = true;
    const p = v.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        if (selectionTokenRef.current !== token || activeIdRef.current !== expectedId) {
          v.pause();
          return;
        }
        setIsLoading(false);
        setPlayBlocked(false);
        setMediaError(null);
      }).catch((err: unknown) => {
        if (selectionTokenRef.current !== token || activeIdRef.current !== expectedId) {
          return;
        }
        setIsLoading(false);
        const name = err instanceof Error ? err.name : "";
        if (name !== "AbortError") {
          setPlayBlocked(true);
        }
      });
    }
  }, []);

  const selectClip = useCallback(
    (idx: number, startPlayback = true) => {
      const nextIdx = (idx + CREATOR_CLIPS.length) % CREATOR_CLIPS.length;
      const nextClip = CREATOR_CLIPS[nextIdx];

      selectionTokenRef.current += 1;
      const token = selectionTokenRef.current;
      activeIdRef.current = nextClip.id;

      // Update selected card & poster immediately on first press
      setActiveIdx(nextIdx);
      setIsPlaying(false);
      setPlayBlocked(false);
      setMediaError(null);
      wantPlayRef.current = startPlayback;

      if (startPlayback) {
        pauseOtherMedia();
        setIsLoading(true);
        if (nextIdx === activeIdx && videoRef.current) {
          videoRef.current.currentTime = 0;
          attemptPlayForToken(token, nextClip.id);
        }
      } else {
        setIsLoading(false);
      }
    },
    [activeIdx, attemptPlayForToken]
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused && !v.ended) {
      wantPlayRef.current = false;
      setIsLoading(false);
      v.pause();
    } else {
      pauseOtherMedia();
      if (v.ended) v.currentTime = 0;
      wantPlayRef.current = true;
      setIsLoading(v.readyState < 3);
      attemptPlayForToken(selectionTokenRef.current, activeIdRef.current);
    }
  }, [attemptPlayForToken]);

  const retryClip = useCallback(() => {
    setMediaError(null);
    setPlayBlocked(false);
    setIsLoading(true);
    wantPlayRef.current = true;
    const v = videoRef.current;
    if (!v) return;
    v.load();
    attemptPlayForToken(selectionTokenRef.current, activeIdRef.current);
  }, [attemptPlayForToken]);

  return (
    <div
      data-testid="home-creator-gallery"
      data-gallery-playing={isPlaying ? "true" : "false"}
      className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.32fr)_minmax(300px,0.68fr)] lg:items-start"
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const startX = touchStartXRef.current;
        const endX = e.changedTouches[0]?.clientX ?? null;
        touchStartXRef.current = null;
        if (startX === null || endX === null) return;
        const dx = endX - startX;
        if (Math.abs(dx) > 48) {
          selectClip(dx < 0 ? activeIdx + 1 : activeIdx - 1, true);
        }
      }}
    >
      {/* Prominent Active Playable Example */}
      <div className="relative overflow-hidden rounded-2xl bg-[#181B25] shadow-[0_20px_52px_rgba(24,27,37,0.16)]">
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          <video
            key={activeClip.id}
            ref={videoRef}
            data-testid="creator-gallery-video"
            data-active-clip={activeClip.id}
            src={activeClip.videoSrc}
            poster={activeClip.poster}
            playsInline
            muted
            loop
            preload="metadata"
            onLoadStart={() => {
              if (wantPlayRef.current) setIsLoading(true);
            }}
            onCanPlay={() => {
              if (wantPlayRef.current) {
                attemptPlayForToken(selectionTokenRef.current, activeClip.id);
              } else {
                setIsLoading(false);
              }
            }}
            onPlaying={() => {
              if (activeIdRef.current !== activeClip.id) return;
              setIsLoading(false);
              setIsPlaying(true);
              setPlayBlocked(false);
            }}
            onPause={() => {
              if (activeIdRef.current !== activeClip.id) return;
              setIsPlaying(false);
            }}
            onError={() => {
              if (activeIdRef.current !== activeClip.id) return;
              setIsLoading(false);
              setIsPlaying(false);
              setMediaError("Could not load this example clip.");
            }}
            onClick={togglePlay}
            className="h-full w-full cursor-pointer object-cover"
          />

          {/* Loading Feedback while clip prepares */}
          {isLoading && !isPlaying && !mediaError && (
            <div
              data-testid="creator-gallery-loading"
              className="pointer-events-none absolute left-1/2 top-1/2 z-20 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-[#181B25]/88 px-4 py-2 text-xs font-semibold text-[#FAF7F0] shadow-lg backdrop-blur-md"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#93B4FF]" />
              <span>Loading clip…</span>
            </div>
          )}

          {/* Caption visible before Play */}
          {!isPlaying && !mediaError && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#181B25]/84 via-[#181B25]/14 to-transparent" />
              <div className="pointer-events-none absolute inset-x-5 bottom-5 text-center">
                <span className="inline-block rounded-xl bg-[#181B25]/88 px-3.5 py-1.5 text-sm font-extrabold tracking-tight text-[#FAF7F0] sm:text-base">
                  {activeClip.captionLine}
                </span>
              </div>
              {!isLoading && (
                <button
                  type="button"
                  data-testid="creator-gallery-play"
                  onClick={togglePlay}
                  aria-label={`Play ${activeClip.label} clip`}
                  className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#2648DB] text-white shadow-xl transition hover:scale-105 hover:bg-[#1E3BC0]"
                >
                  <Play className="ml-0.5 h-6 w-6 fill-current" />
                </button>
              )}
            </>
          )}

          {/* Error & Retry fallback */}
          {mediaError && (
            <div
              role="alert"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#181B25]/92 p-4 text-center text-[#FAF7F0]"
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <AlertCircle className="h-4 w-4 text-rose-400" />
                <span>{mediaError}</span>
              </span>
              <button
                type="button"
                onClick={retryClip}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2648DB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3BC0]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry clip</span>
              </button>
            </div>
          )}

          {/* Top-left Active Clip Label */}
          <div className="pointer-events-none absolute left-3.5 top-3.5 flex items-center gap-2 rounded-full bg-[#181B25]/85 px-3 py-1 text-xs font-semibold text-[#FAF7F0] backdrop-blur-md">
            <span>{activeClip.label}</span>
            <span className="text-[#93B4FF]">· {activeClip.styleName}</span>
          </div>

          {/* Top-right Controls */}
          <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5">
            {playBlocked && !isPlaying && (
              <button
                type="button"
                data-testid="creator-gallery-play-fallback"
                onClick={togglePlay}
                className="rounded-full bg-[#2648DB] px-3 py-1 text-xs font-semibold text-white"
              >
                Play
              </button>
            )}
            <button
              type="button"
              data-testid="creator-gallery-toggle"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause example clip" : "Play example clip"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#181B25]/85 text-[#FAF7F0] backdrop-blur-md transition hover:bg-[#2648DB]"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
              )}
            </button>
            <button
              type="button"
              data-testid="creator-gallery-prev"
              onClick={() => selectClip(activeIdx - 1, true)}
              aria-label="Previous example"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#181B25]/85 text-[#FAF7F0] backdrop-blur-md transition hover:bg-[#2648DB]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-testid="creator-gallery-next"
              onClick={() => selectClip(activeIdx + 1, true)}
              aria-label="Next example"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#181B25]/85 text-[#FAF7F0] backdrop-blur-md transition hover:bg-[#2648DB]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Selectable Poster Examples with Captions Visible Before Play */}
      <div className="grid grid-cols-2 gap-3">
        {CREATOR_CLIPS.map((clip, idx) => {
          const selected = idx === activeIdx;
          return (
            <button
              key={clip.id}
              type="button"
              data-testid={`creator-clip-${clip.id}`}
              aria-pressed={selected}
              onClick={() => selectClip(idx, true)}
              className={`group overflow-hidden rounded-2xl text-left transition ${
                selected
                  ? "bg-[#EEF2FF] ring-2 ring-[#2648DB] shadow-md"
                  : "border border-[#181B25]/10 bg-white hover:border-[#2648DB]/40"
              }`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#181B25]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clip.poster}
                  alt={clip.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#181B25]/82 via-[#181B25]/10 to-transparent" />
                <span className="pointer-events-none absolute inset-x-2 bottom-2 truncate text-[10px] font-bold text-[#FAF7F0]">
                  {clip.captionLine}
                </span>
              </div>
              <div className="px-3 py-2">
                <p className="text-xs font-bold text-[#181B25] sm:text-sm">
                  {clip.label}
                </p>
                <p className="font-mono text-[10px] font-semibold text-[#2648DB]">
                  {clip.styleName}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
