"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
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
    tagline: "Floating sans-serif with subtle stroke and gentle active-word lift.",
  },
  {
    id: "word-highlight" as const,
    label: "Word Highlight",
    templateId: "word-highlight",
    tagline: "Kinetic muted-violet pill tracking every spoken word in real time.",
  },
  {
    id: "bold" as const,
    label: "Bold",
    templateId: "punch-display",
    tagline: "Tall condensed Bebas Neue caps with high-contrast gold keyword punch.",
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

  const [selectedId, setSelectedId] = useState<ShowcaseStyle["id"]>("word-highlight");
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
      className="mt-6 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_272px] lg:gap-8"
    >
      {/* 3 Visually Distinct Working Caption Styles — aligned cleanly with the live demo */}
      <div className="flex flex-col justify-between gap-4">
        <div
          role="radiogroup"
          aria-label="Compare Clean, Word Highlight, and Bold caption styles"
          className="grid flex-1 grid-cols-1 gap-3.5 sm:grid-cols-3"
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
                className={`cc-card-interactive group flex h-full flex-col justify-between rounded-2xl border p-4 text-left ${
                  isSelected
                    ? "border-accent bg-panel ring-2 ring-accent/70 shadow-[0_14px_34px_rgba(0,0,0,0.38)]"
                    : "border-white/14 bg-panel/85 hover:border-white/30 hover:bg-panel"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink">
                      {item.label}
                    </span>
                    {isSelected ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#14151e]">
                        Active
                      </span>
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-white/30 transition group-hover:bg-white/55" />
                    )}
                  </div>

                  {/* Authentic Visual Specimen */}
                  <div className="mt-3.5 flex h-16 items-center justify-center rounded-xl border border-white/12 bg-inset px-2.5">
                    {item.id === "clean" && (
                      <span
                        style={{ fontFamily: '"Poppins", sans-serif' }}
                        className="text-xs font-semibold text-ink drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
                      >
                        Make{" "}
                        <span className="text-accent-hover">every</span> word
                      </span>
                    )}
                    {item.id === "word-highlight" && (
                      <span
                        style={{ fontFamily: '"Poppins", sans-serif' }}
                        className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-tight"
                      >
                        <span className="text-ink">MAKE</span>
                        <span className="rounded bg-accent px-1.5 py-0.5 text-[#14151e]">
                          EVERY
                        </span>
                        <span className="text-ink">WORD</span>
                      </span>
                    )}
                    {item.id === "bold" && (
                      <span
                        style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                        className="inline-flex items-center gap-1 rounded bg-black/85 px-2 py-1 text-base tracking-wider text-white"
                      >
                        <span>MAKE</span>
                        <span className="rounded bg-[#FACC15] px-1 text-black">
                          EVERY
                        </span>
                        <span>WORD</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                  {item.tagline}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/12 bg-panel px-4 py-3 text-xs text-ink-secondary">
          <span>
            Switch presets while the video plays — playback stays locked on the
            same clip.
          </span>
          <Link
            href="/studio"
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-ink transition hover:text-accent-hover"
          >
            <span>Explore all 16 presets &amp; 10 fonts</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Live Synchronized Comparison Clip (Single Media Element) */}
      <div className="cc-stage-frame mx-auto flex w-full max-w-[272px] flex-col justify-between rounded-2xl border border-white/15 p-2.5 shadow-[0_18px_48px_rgba(0,0,0,0.42)]">
        <div className="mb-1.5 flex items-center justify-between px-1 text-[11px]">
          <span
            key={activeStyle.id}
            data-testid="gallery-active-style-label"
            className="cc-panel-enter inline-flex items-center gap-1.5 font-semibold text-ink"
          >
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span>{activeStyle.label}</span>
          </span>
          <span className="font-mono text-[10px] text-ink-secondary">
            Live preview
          </span>
        </div>

        <div className="studio-stage-container relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-inset">
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
            className="h-full w-full cursor-pointer object-cover"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

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

        <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-[#0D0E12]/90 px-2.5 py-1.5">
          <button
            type="button"
            data-testid="gallery-play-btn"
            onClick={() => void togglePlay()}
            aria-label={isPlaying ? "Pause style preview" : "Play style preview"}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-page transition hover:bg-accent-hover"
          >
            {isPlaying ? (
              <Pause className="h-3 w-3 fill-current" />
            ) : (
              <Play className="ml-0.5 h-3 w-3 fill-current" />
            )}
          </button>

          <div className="relative flex h-4 min-w-0 flex-1 items-center">
            <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/15">
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
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:text-ink"
          >
            {isMuted ? (
              <VolumeX className="h-3 w-3" />
            ) : (
              <Volume2 className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
