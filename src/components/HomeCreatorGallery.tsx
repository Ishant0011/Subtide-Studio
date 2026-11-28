"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

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

  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const activeClip = CREATOR_CLIPS[activeIdx];

  const pauseTour = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clipcaptions:pause-tour"));
    }
  };

  const selectClip = useCallback((idx: number, autoPlay = false) => {
    const nextIdx = (idx + CREATOR_CLIPS.length) % CREATOR_CLIPS.length;
    setActiveIdx(nextIdx);
    setIsPlaying(false);
    if (autoPlay) {
      pauseTour();
      window.setTimeout(() => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = 0;
        v.play().catch(() => {});
      }, 60);
    }
  }, []);

  const togglePlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      pauseTour();
      if (v.ended) v.currentTime = 0;
      try {
        await v.play();
      } catch {
        // ignore
      }
    } else {
      v.pause();
    }
  }, []);

  return (
    <div
      data-testid="home-creator-gallery"
      className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(290px,0.75fr)] lg:items-start"
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
          selectClip(dx < 0 ? activeIdx + 1 : activeIdx - 1);
        }
      }}
    >
      {/* Active Playable Example Stage (Charcoal frame) */}
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
            preload="none"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={() => void togglePlay()}
            className="h-full w-full cursor-pointer object-cover"
          />

          {!isPlaying && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#181B25]/80 via-[#181B25]/12 to-transparent" />
              <div className="pointer-events-none absolute inset-x-5 bottom-5 text-center">
                <span className="inline-block rounded-xl bg-[#181B25]/85 px-3.5 py-1.5 text-sm font-extrabold tracking-tight text-[#FAF7F0] backdrop-blur-sm sm:text-base">
                  {activeClip.captionLine}
                </span>
              </div>
              <button
                type="button"
                data-testid="creator-gallery-play"
                onClick={() => void togglePlay()}
                aria-label={`Play ${activeClip.label} clip`}
                className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#2648DB] text-white shadow-xl transition hover:scale-105 hover:bg-[#1E3BC0]"
              >
                <Play className="ml-0.5 h-6 w-6 fill-current" />
              </button>
            </>
          )}

          {/* Top-left Active Clip Label */}
          <div className="pointer-events-none absolute left-3.5 top-3.5 flex items-center gap-2 rounded-full bg-[#181B25]/85 px-3 py-1 text-xs font-semibold text-[#FAF7F0] backdrop-blur-md">
            <span>{activeClip.label}</span>
            <span className="text-[#93B4FF]">· {activeClip.styleName}</span>
          </div>

          {/* Top-right Play/Pause + Prev/Next Controls */}
          <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void togglePlay()}
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
              onClick={() => selectClip(activeIdx - 1)}
              aria-label="Previous example"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#181B25]/85 text-[#FAF7F0] backdrop-blur-md transition hover:bg-[#2648DB]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-testid="creator-gallery-next"
              onClick={() => selectClip(activeIdx + 1)}
              aria-label="Next example"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#181B25]/85 text-[#FAF7F0] backdrop-blur-md transition hover:bg-[#2648DB]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Selectable Poster Examples (2x2 grid on desktop & mobile, cobalt active ring) */}
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
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#181B25]/80 via-[#181B25]/10 to-transparent" />
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
