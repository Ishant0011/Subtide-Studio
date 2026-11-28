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

const GALLERY_PRESET_IDS = [
  "word-highlight",
  "broadcast",
  "high-contrast",
  "lower-third",
] as const;

export function HomeStyleGallery() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const galleryPresets: BuiltInStyleTemplate[] = useMemo(
    () =>
      GALLERY_PRESET_IDS.map(
        (id) =>
          BUILTIN_STYLE_TEMPLATES.find((t) => t.id === id) ??
          BUILTIN_STYLE_TEMPLATES[0]
      ),
    []
  );

  const [selectedId, setSelectedId] = useState<string>(galleryPresets[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(5.8);
  const [duration, setDuration] = useState(SAMPLE_CLIP.duration);
  const [initialized, setInitialized] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const activeTemplate = useMemo(
    () =>
      galleryPresets.find((t) => t.id === selectedId) ?? galleryPresets[0],
    [galleryPresets, selectedId]
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
      video.currentTime = 5.8;
      setCurrentTime(5.8);
      setInitialized(true);
    }
  }, [initialized]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      data-testid="home-style-gallery"
      className="mt-7 grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_272px] lg:gap-10"
    >
      {/* 4 Visually Distinct Working Style Cards */}
      <div
        role="radiogroup"
        aria-label="Compare caption styles on the sample clip"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {galleryPresets.map((tpl) => {
          const isSelected = tpl.id === activeTemplate.id;
          return (
            <button
              key={tpl.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-testid={`gallery-style-${tpl.id}`}
              onClick={() => setSelectedId(tpl.id)}
              className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? "border-accent bg-panel shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
                  : "border-ink/10 bg-panel/75 hover:border-ink/25 hover:bg-panel"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink">{tpl.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isSelected
                        ? "bg-accent text-page"
                        : "bg-elevated text-ink-secondary"
                    }`}
                  >
                    {tpl.category}
                  </span>
                </div>

                {/* Authentic Visual Specimen */}
                <div className="mt-3 flex h-16 items-center justify-center rounded-xl border border-ink/10 bg-inset px-3">
                  {tpl.id === "word-highlight" && (
                    <span
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-tight"
                    >
                      <span className="text-ink">MAKE</span>
                      <span className="rounded bg-accent px-1.5 py-0.5 text-page">
                        EVERY
                      </span>
                      <span className="text-ink">WORD</span>
                    </span>
                  )}
                  {tpl.id === "broadcast" && (
                    <span
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className="rounded-md bg-[#0D0E12] px-2.5 py-1 text-xs font-semibold text-ink shadow-sm"
                    >
                      Make every word land.
                    </span>
                  )}
                  {tpl.id === "high-contrast" && (
                    <span
                      style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                      className="inline-flex items-center gap-1 rounded bg-black px-2.5 py-1 text-sm tracking-wider text-white"
                    >
                      <span>MAKE</span>
                      <span className="rounded bg-[#FACC15] px-1 text-black">
                        EVERY
                      </span>
                      <span>WORD</span>
                    </span>
                  )}
                  {tpl.id === "lower-third" && (
                    <div className="w-full text-left">
                      <span
                        style={{ fontFamily: '"Space Mono", monospace' }}
                        className="inline-block rounded-r border-l-2 border-accent bg-[#0D0E12]/95 px-2.5 py-1 text-[11px] font-bold tracking-wide text-ink"
                      >
                        Make <span className="text-accent">every</span> word
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                {tpl.description}
              </p>
            </button>
          );
        })}

        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-ink-secondary">
          <span>
            Built-in styles across Creator, Clean, Bold, and Editorial — all
            rendered identically in browser preview and exported MP4 video.
          </span>
          <Link
            href="/studio"
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-ink transition hover:text-accent-hover"
          >
            <span>Try all 12 in Sample Studio</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Live Synchronized Comparison Clip */}
      <div className="mx-auto w-full max-w-[272px] rounded-2xl border border-ink/10 bg-panel p-2.5">
        <div className="mb-2 flex items-center justify-between px-1 text-[11px]">
          <span
            data-testid="gallery-active-style-label"
            className="font-semibold text-ink"
          >
            {activeTemplate.name}
          </span>
          <span className="font-mono text-[10px] text-ink-muted">
            {activeTemplate.category}
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
            data-active-preset={activeTemplate.id}
            className="pointer-events-none absolute inset-0 z-20"
          >
            <CaptionOverlay
              activeCue={activeCue}
              activeWord={activeWord}
              preset={activeTemplate.style.preset}
              fontSize={activeTemplate.style.fontSize}
              verticalPosition={activeTemplate.style.verticalPosition}
              accent={activeTemplate.style.accent}
              styleConfig={activeTemplate.style}
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

        <div className="mt-2 flex items-center gap-2 rounded-xl bg-inset px-2 py-1.5">
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
            <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-track">
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
