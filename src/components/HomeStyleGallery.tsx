"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
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
import {
  BUILTIN_STYLE_TEMPLATES,
  type BuiltInStyleTemplate,
} from "@/lib/caption-editor";
import { CaptionOverlay } from "@/components/CaptionOverlay";

interface ShowcaseStyle {
  id: "clean" | "word-highlight" | "bold";
  label: string;
  templateId: string;
  tagline: string;
  template: BuiltInStyleTemplate;
}

const SHOWCASE_CONFIG = [
  {
    id: "clean" as const,
    label: "Clean",
    templateId: "clean",
    tagline: "Crisp floating type with gentle active-word lift.",
  },
  {
    id: "word-highlight" as const,
    label: "Word Highlight",
    templateId: "word-highlight",
    tagline: "Violet pill tracking each spoken word on beat.",
  },
  {
    id: "bold" as const,
    label: "Bold",
    templateId: "punch-display",
    tagline: "Tall condensed caps with high-contrast gold punch.",
  },
];

export function HomeStyleGallery() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const showcaseStyles: ShowcaseStyle[] = useMemo(
    () =>
      SHOWCASE_CONFIG.map((cfg) => ({
        ...cfg,
        template:
          BUILTIN_STYLE_TEMPLATES.find((t) => t.id === cfg.templateId) ??
          BUILTIN_STYLE_TEMPLATES[0],
      })),
    []
  );

  const [selectedId, setSelectedId] =
    useState<ShowcaseStyle["id"]>("word-highlight");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(8.2);
  const [duration, setDuration] = useState(SAMPLE_CLIP.duration);
  const [initialized, setInitialized] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const activeStyle = useMemo(
    () =>
      showcaseStyles.find((s) => s.id === selectedId) ?? showcaseStyles[1],
    [showcaseStyles, selectedId]
  );

  const activeCue = useMemo(
    () => getActiveCue(SAMPLE_CAPTIONS, currentTime),
    [currentTime]
  );
  const activeWord = useMemo(
    () => getActiveWord(activeCue, currentTime),
    [activeCue, currentTime]
  );

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
          setMediaError("Could not start style preview playback.");
        }
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
      video.currentTime = 8.2;
      setCurrentTime(8.2);
      setInitialized(true);
    }
  }, [initialized]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      data-testid="home-style-gallery"
      className="mt-6 grid grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.92fr)] lg:gap-10"
    >
      {/* Compact Style Swatches with Large Typography — stays paired with visible player on phones */}
      <div className="flex flex-col gap-3.5">
        <div
          role="radiogroup"
          aria-label="Compare Clean, Word Highlight, and Bold caption styles"
          className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:grid-cols-1"
        >
          {showcaseStyles.map((item) => {
            const isSelected = item.id === activeStyle.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`gallery-style-${item.id}`}
                onClick={() => setSelectedId(item.id)}
                className={`cc-card-interactive group flex flex-col justify-between rounded-2xl border p-2.5 text-left transition sm:p-4 lg:flex-row lg:items-center lg:gap-4 ${
                  isSelected
                    ? "border-accent bg-[#29283E] ring-2 ring-accent/70 shadow-[0_14px_34px_rgba(0,0,0,0.36)]"
                    : "border-white/10 bg-[#1D1D27] hover:border-white/25 hover:bg-[#242336]"
                }`}
              >
                {/* Large Typographic Swatch */}
                <div className="flex h-12 w-full shrink-0 items-center justify-center rounded-xl bg-[#101014] px-2 lg:h-14 lg:w-44">
                  {item.id === "clean" && (
                    <span
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className="text-sm font-bold text-ink sm:text-base"
                    >
                      Every <span className="text-accent">word</span>
                    </span>
                  )}
                  {item.id === "word-highlight" && (
                    <span
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className="inline-flex items-center gap-1 text-xs font-extrabold uppercase sm:text-sm"
                    >
                      <span className="rounded bg-accent px-1.5 py-0.5 text-[#101014]">
                        EVERY
                      </span>
                      <span className="hidden text-ink sm:inline">WORD</span>
                    </span>
                  )}
                  {item.id === "bold" && (
                    <span
                      style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                      className="inline-flex items-center gap-1 text-lg tracking-wider text-white sm:text-xl"
                    >
                      <span className="rounded bg-[#FACC15] px-1.5 text-black">
                        BOLD
                      </span>
                      <span className="hidden sm:inline">HOOK</span>
                    </span>
                  )}
                </div>

                {/* Label + Tagline + Clear Selected State */}
                <div className="mt-2 min-w-0 flex-1 lg:mt-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate text-xs font-bold text-ink sm:text-sm">
                      {item.label}
                    </span>
                    {isSelected && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-[#101014]">
                        <Check className="h-2.5 w-2.5" />
                        <span className="hidden sm:inline">Selected</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 hidden text-xs leading-relaxed text-ink-secondary sm:block">
                    {item.tagline}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
          <span>Playback position stays locked while you compare styles.</span>
          <Link
            href="/studio"
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-accent transition hover:text-accent-hover"
          >
            <span>Explore all 16 presets &amp; 10 fonts</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Playable Single-Media Comparison Stage — 4:5 landscape-friendly crop so player stays in view on phones */}
      <div className="mx-auto w-full max-w-[360px] lg:max-w-[420px]">
        <div className="studio-stage-container relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-[#101014] shadow-[0_24px_60px_rgba(0,0,0,0.52)] sm:aspect-[4/4.6]">
          <video
            ref={videoRef}
            src={SAMPLE_CLIP.src}
            poster="/sample-gallery-frame.jpg"
            playsInline
            preload="metadata"
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
            onError={() => setMediaError("Could not load preview clip.")}
            onClick={() => void togglePlay()}
            className="h-full w-full cursor-pointer object-cover object-[50%_26%]"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          {/* Floating Active Style Pill */}
          <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-[#101014]/82 px-3 py-1 text-[11px] font-semibold text-ink backdrop-blur-md">
            <span data-testid="gallery-active-style-label">
              {activeStyle.label}
            </span>
          </div>

          <div
            data-testid="gallery-caption-overlay"
            data-active-preset={activeStyle.id}
            className="pointer-events-none absolute inset-0 z-20"
          >
            <CaptionOverlay
              activeCue={activeCue}
              activeWord={activeWord}
              preset={activeStyle.template.style.preset}
              fontSize={activeStyle.template.style.fontSize}
              verticalPosition={activeStyle.template.style.verticalPosition}
              accent={activeStyle.template.style.accent}
              styleConfig={activeStyle.template.style}
              currentTime={currentTime}
            />
          </div>
        </div>

        {mediaError && (
          <div
            role="alert"
            className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-rose-400/35 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200"
          >
            <span className="inline-flex items-center gap-1 truncate">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">{mediaError}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setMediaError(null);
                videoRef.current?.load();
                void togglePlay();
              }}
              className="inline-flex shrink-0 items-center gap-1 font-semibold text-rose-100"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Clean Transport Controls */}
        <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-[#1D1D27] px-3 py-2">
          <button
            type="button"
            data-testid="gallery-play-btn"
            onClick={() => void togglePlay()}
            aria-label={isPlaying ? "Pause style preview" : "Play style preview"}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-[#101014] transition hover:bg-accent-hover"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
            )}
          </button>

          <div className="relative flex h-4 min-w-0 flex-1 items-center">
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
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                if (videoRef.current) videoRef.current.currentTime = next;
                setCurrentTime(next);
              }}
              aria-label="Seek style preview"
              className="studio-scrubber relative z-10 w-full"
            />
          </div>

          <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-secondary">
            {formatTime(currentTime)}
          </span>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute style preview" : "Mute style preview"}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-secondary hover:text-ink"
          >
            {isMuted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
