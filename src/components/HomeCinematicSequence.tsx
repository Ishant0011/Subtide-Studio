"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Film,
  LocateFixed,
  Play,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

const BEATS = [
  {
    id: "original",
    num: "01",
    label: "Original shot",
    summary: "Start with your raw vertical or widescreen footage.",
  },
  {
    id: "closeup",
    num: "02",
    label: "Word highlight",
    summary: "Every spoken word highlights on beat as you talk.",
  },
  {
    id: "editor",
    num: "03",
    label: "Full editor",
    summary: "Footage docks into the live preview with transcript and timeline around it.",
  },
] as const;

const CLOSEUP_WORDS = [
  "CRISP",
  "TIMING",
  "TURNS",
  "EVERY",
  "SENTENCE",
  "INTO",
  "MOMENTUM.",
];

const WAVEFORM_BARS = [
  24, 46, 70, 54, 32, 76, 90, 62, 42, 28, 64, 84, 56, 36, 74, 92, 68, 50, 32,
  60, 80, 44, 26, 66, 86, 58, 38, 72, 52, 30,
];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3);
}

export function HomeCinematicSequence() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) {
      setReducedMotion(true);
      return;
    }

    let rafId = 0;
    const update = () => {
      rafId = 0;
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const scrollable = Math.max(1, rect.height - vh);
      const raw = clamp01(-rect.top / scrollable);
      setProgress(raw);
    };

    const onScroll = () => {
      if (!rafId) rafId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Single scroll-progress value (0 -> 1) driving three unambiguous views with zero double-UI crossfade:
  // 0.00 - 0.28: View 1 — Wide original shot (no captions, no editor chrome)
  // 0.28 - 0.60: View 2 — Readable word highlight close-up (original badge out, word highlight sweeping)
  // 0.60 - 0.72: Docking — Word highlight clears first, then the SAME footage aligns into the center editor window
  // 0.72 - 1.00: View 3 — Full editor reveals cleanly around the aligned footage preview
  const activeBeatIdx = progress < 0.28 ? 0 : progress < 0.68 ? 1 : 2;

  const originalBadgeOpacity = 1 - clamp01((progress - 0.2) / 0.08);
  const closeupIn = clamp01((progress - 0.26) / 0.1);
  const closeupOut = 1 - clamp01((progress - 0.56) / 0.07);
  const closeupOpacity = closeupIn * closeupOut;

  // Footage docks into the center editor preview window between 0.60 and 0.73
  const dockT = easeOutCubic((progress - 0.6) / 0.13);
  // Editor transcript, appearance panel, and waveform timeline reveal AFTER docking aligns (0.72 -> 0.84)
  const chromeReveal = easeOutCubic((progress - 0.72) / 0.12);

  // Subtle camera zoom during View 2 that settles cleanly to 1.0 as it docks
  const mediaZoom =
    1 + clamp01((progress - 0.24) / 0.18) * (1 - dockT) * 0.13;

  const activeWordIdx = Math.min(
    CLOSEUP_WORDS.length - 1,
    Math.max(
      0,
      Math.floor(clamp01((progress - 0.29) / 0.27) * CLOSEUP_WORDS.length)
    )
  );

  // Smoothly morph the single footage container from full-bleed (100% width) into the center preview column
  // On desktop lg+, center column is ~22% of stage width; on smaller screens it docks to a tidy centered frame
  const jumpToBeat = (idx: number) => {
    if (reducedMotion || !trackRef.current) {
      setProgress(idx === 0 ? 0.08 : idx === 1 ? 0.45 : 0.94);
      return;
    }
    const rect = trackRef.current.getBoundingClientRect();
    const trackTop = window.scrollY + rect.top;
    const scrollable = Math.max(1, rect.height - window.innerHeight);
    const targetPct = idx === 0 ? 0.06 : idx === 1 ? 0.44 : 0.94;
    window.scrollTo({
      top: trackTop + scrollable * targetPct,
      behavior: "smooth",
    });
  };

  if (reducedMotion) {
    return (
      <section
        id="workflow"
        data-testid="home-cinematic-sequence"
        aria-label="Editor preview and workflow sequence"
        className="scroll-mt-20 border-t border-white/10 bg-inset py-10 lg:py-16"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              Inside ClipCaptions
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Fix a word. Adjust the timing. Make it yours.
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
              Correct names inline, nudge caption timing on the waveform, and
              change fonts or colors while seeing the result live on your video.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Static Beat 1 */}
            <div className="overflow-hidden rounded-2xl border border-white/12 bg-panel p-3">
              <p className="mb-2 font-mono text-[11px] font-semibold text-accent">
                01 · Original shot
              </p>
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#14151e]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sample-poster.jpg"
                  alt="Original raw clip before captioning"
                  className="h-full w-full object-cover object-[50%_26%]"
                />
              </div>
              <p className="mt-2.5 text-xs text-ink-secondary">
                {BEATS[0].summary}
              </p>
            </div>

            {/* Static Beat 2 */}
            <div className="overflow-hidden rounded-2xl border border-white/12 bg-panel p-3">
              <p className="mb-2 font-mono text-[11px] font-semibold text-accent">
                02 · Word highlight
              </p>
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#14151e]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sample-gallery-frame.jpg"
                  alt="Close-up timed word highlight on clip"
                  className="h-full w-full object-cover object-[50%_26%]"
                />
                <div className="absolute inset-x-3 bottom-3 flex flex-wrap justify-center gap-1 text-[11px] font-extrabold uppercase">
                  <span className="rounded bg-black/80 px-1.5 py-0.5 text-ink">
                    CRISP
                  </span>
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[#14151e]">
                    TIMING
                  </span>
                  <span className="rounded bg-black/80 px-1.5 py-0.5 text-ink">
                    TURNS EVERY SENTENCE
                  </span>
                </div>
              </div>
              <p className="mt-2.5 text-xs text-ink-secondary">
                {BEATS[1].summary}
              </p>
            </div>

            {/* Static Beat 3 */}
            <div
              data-testid="home-editor-preview"
              className="overflow-hidden rounded-2xl border border-white/12 bg-panel p-3"
            >
              <p className="mb-2 font-mono text-[11px] font-semibold text-accent">
                03 · Full editor
              </p>
              <div className="rounded-xl border border-white/10 bg-inset p-3 text-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-ink">
                  <span>Transcript · Preview · Appearance</span>
                  <span className="rounded bg-accent px-2 py-0.5 text-[10px] text-[#14151e]">
                    Export MP4
                  </span>
                </div>
                <p className="mt-2 rounded-lg border border-accent/60 bg-panel px-2.5 py-1.5 text-ink">
                  Crisp timing turns every sentence into momentum.
                </p>
                <div className="mt-2.5 flex h-7 items-end gap-0.5 rounded-lg bg-[#181923] px-2 py-1">
                  {WAVEFORM_BARS.slice(0, 20).map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${Math.round(h * 0.2)}px` }}
                      className={`flex-1 rounded-full ${
                        i >= 6 && i <= 13 ? "bg-accent" : "bg-white/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-2.5 text-xs text-ink-secondary">
                {BEATS[2].summary}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="workflow"
      data-testid="home-cinematic-sequence"
      aria-label="Editor preview and cinematic scroll sequence"
      className="scroll-mt-20 border-t border-white/10 bg-inset"
    >
      {/* Shortened pinned travel: 145vh on phones, 175vh on desktop — hands off cleanly into Style Gallery */}
      <div
        ref={trackRef}
        className="relative mx-auto min-h-[145vh] max-w-6xl px-4 sm:min-h-[175vh] sm:px-6 lg:px-8"
      >
        <div className="sticky top-14 flex min-h-[calc(100vh-3.5rem)] flex-col justify-center py-4 sm:top-16 sm:py-6">
          {/* Section Header + Interactive Beat Selector */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Inside ClipCaptions
              </p>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-ink sm:text-3xl">
                Fix a word. Adjust the timing. Make it yours.
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                Correct names inline, nudge caption timing on the waveform, and
                change fonts or colors while seeing the result live on your
                video.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div
                role="tablist"
                aria-label="Scroll sequence beats"
                className="inline-flex rounded-xl border border-white/15 bg-panel p-1 text-[11px]"
              >
                {BEATS.map((beat, idx) => {
                  const active = activeBeatIdx === idx;
                  return (
                    <button
                      key={beat.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      data-testid={`sequence-beat-${idx + 1}`}
                      onClick={() => jumpToBeat(idx)}
                      className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                        active
                          ? "bg-accent text-[#14151e]"
                          : "text-ink-secondary hover:text-ink"
                      }`}
                    >
                      <span className="font-mono opacity-85">{beat.num}</span>{" "}
                      <span className="hidden sm:inline">{beat.label}</span>
                    </button>
                  );
                })}
              </div>

              <Link
                href="/studio"
                className="hidden items-center gap-1 text-xs font-semibold text-ink transition hover:text-accent-hover md:inline-flex"
              >
                <span>Try live editor</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Unified Single-Progress Stage (Zero CSS transitions fighting scroll) */}
          <div
            data-testid="cinematic-sequence-stage"
            data-active-beat={BEATS[activeBeatIdx].id}
            data-scroll-progress={progress.toFixed(3)}
            className="cc-stage-frame relative mt-3.5 overflow-hidden rounded-2xl border border-white/15 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.46)] sm:mt-4 sm:p-4"
          >
            {/* Progress Strip */}
            <div className="mb-2.5 flex items-center justify-between gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent/25 font-mono text-[10px] text-accent-hover">
                  {BEATS[activeBeatIdx].num}
                </span>
                <span>{BEATS[activeBeatIdx].label}</span>
                <span className="hidden text-ink-secondary sm:inline">
                  — {BEATS[activeBeatIdx].summary}
                </span>
              </span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/15 sm:w-32">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.round(Math.max(8, progress * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Stable Fixed-Height Viewport Stage */}
            <div className="relative h-[370px] overflow-hidden rounded-xl border border-white/12 bg-[#14151e] sm:h-[430px]">
              {/* FULL EDITOR SHELL — reveals ONLY AFTER footage aligns into the center preview window */}
              <div
                data-testid="home-editor-preview"
                aria-hidden={chromeReveal < 0.15}
                style={{
                  opacity: chromeReveal,
                  pointerEvents: chromeReveal > 0.5 ? "auto" : "none",
                }}
                className="absolute inset-0 z-10 flex flex-col justify-between bg-panel"
              >
                {/* Editor Top Bar */}
                <div
                  style={{
                    transform: `translate3d(0, ${((1 - chromeReveal) * -10).toFixed(1)}px, 0)`,
                  }}
                  className="flex items-center justify-between gap-2 border-b border-white/10 bg-inset px-3.5 py-2 text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-white/15 bg-panel px-2 py-0.5 text-[10px] font-medium text-ink-secondary">
                      Projects
                    </span>
                    <span className="truncate font-semibold text-ink">
                      creator-hook-take-02.mp4
                    </span>
                    <span className="hidden rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary sm:inline">
                      Rev #3 · 9:16
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-[10px] text-ink-secondary sm:inline">
                      Saved
                    </span>
                    <span className="rounded-md bg-accent px-2.5 py-1 text-[10px] font-semibold text-[#14151e]">
                      Export MP4
                    </span>
                  </div>
                </div>

                {/* 3-Column Workspace: Left Transcript | Center Docked Video Slot | Right Appearance */}
                <div className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_196px_minmax(0,1fr)]">
                  {/* Left: Transcript */}
                  <div
                    style={{
                      transform: `translate3d(${((1 - chromeReveal) * -16).toFixed(1)}px, 0, 0)`,
                    }}
                    className="flex flex-col rounded-xl border border-white/12 bg-inset p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <span className="text-[11px] font-semibold text-ink">
                        Transcript
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-accent/50 bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-hover">
                        <LocateFixed className="h-2.5 w-2.5" />
                        <span>Follow</span>
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="rounded-lg border border-accent bg-panel p-2">
                        <div className="flex items-center justify-between font-mono text-[9px] text-ink-secondary">
                          <span>#3 · 0:07.5 – 0:10.8</span>
                          <span className="font-semibold text-accent-hover">
                            Editing
                          </span>
                        </div>
                        <p className="mt-1 rounded bg-inset px-2 py-1 text-ink">
                          Crisp timing turns every sentence into momentum.
                        </p>
                      </div>
                      <div className="hidden rounded-lg border border-white/10 bg-panel/75 px-2 py-1.5 text-ink-secondary sm:block">
                        <span className="font-mono text-[9px] text-ink-muted">
                          0:11.6
                        </span>
                        <p className="truncate">
                          Switch presets in one click to match your brand.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Center: Empty alignment guide slot where the docked footage lands */}
                  <div className="hidden rounded-xl border border-white/12 bg-inset/75 lg:block" />

                  {/* Right: Appearance */}
                  <div
                    style={{
                      transform: `translate3d(${((1 - chromeReveal) * 16).toFixed(1)}px, 0, 0)`,
                    }}
                    className="hidden flex-col rounded-xl border border-white/12 bg-inset p-2.5 lg:flex"
                  >
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-[11px] font-semibold text-ink">
                        Appearance
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-[#14151e]">
                        <Sparkles className="h-2.5 w-2.5" />
                        <span>16 Presets</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="rounded-lg border border-accent bg-accent-soft p-2">
                        <p className="font-bold text-accent-hover">
                          Word Highlight
                        </p>
                        <p className="text-[9px] text-ink-secondary">Poppins</p>
                      </div>
                      <div className="rounded-lg border border-white/12 bg-panel p-2">
                        <p className="font-bold text-ink">Clean</p>
                        <p className="text-[9px] text-ink-secondary">Inter</p>
                      </div>
                      <div className="rounded-lg border border-white/12 bg-panel p-2">
                        <p className="font-bold text-ink">Bold</p>
                        <p className="text-[9px] text-ink-secondary">
                          Bebas Neue
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/12 bg-panel p-2">
                        <p className="font-bold text-ink">Devanagari</p>
                        <p className="text-[9px] text-ink-secondary">
                          Noto Sans
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom: Waveform Timeline Strip */}
                <div
                  style={{
                    transform: `translate3d(0, ${((1 - chromeReveal) * 14).toFixed(1)}px, 0)`,
                  }}
                  className="border-t border-white/10 bg-inset px-3.5 py-2.5"
                >
                  <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-ink-secondary">
                    <span className="inline-flex items-center gap-1.5">
                      <Play className="h-3 w-3 fill-accent text-accent" />
                      <span>Timeline · 0:08.1 / 0:17.6</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <SlidersHorizontal className="h-3 w-3" />
                      <span>Drag edges · Split · Merge</span>
                    </span>
                  </div>
                  <div className="relative flex h-10 items-end gap-1 overflow-hidden rounded-lg border border-white/12 bg-[#181923] px-2 py-1.5">
                    {WAVEFORM_BARS.map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${Math.round(h * 0.3)}px` }}
                        className={`flex-1 rounded-full ${
                          i >= 9 && i <= 18 ? "bg-accent" : "bg-white/25"
                        }`}
                      />
                    ))}
                    <div className="pointer-events-none absolute inset-y-1 left-[30%] right-[36%] rounded border border-accent bg-accent/18" />
                    <div className="pointer-events-none absolute inset-y-0 left-[44%] w-0.5 bg-accent shadow-[0_0_8px_rgba(175,160,245,0.9)]" />
                  </div>
                </div>
              </div>

              {/* SINGLE CONTINUOUS FOOTAGE WINDOW:
                  View 1 (wide original) -> View 2 (word highlight zoom) -> Docks into center editor preview window */}
              <div
                data-testid="sequence-footage-window"
                style={{
                  inset: `${(dockT * 12).toFixed(2)}% ${(dockT * 40.5).toFixed(2)}% ${(dockT * 21).toFixed(2)}% ${(dockT * 40.5).toFixed(2)}%`,
                  borderRadius: `${(dockT * 10).toFixed(1)}px`,
                }}
                className="pointer-events-none absolute z-20 hidden overflow-hidden border border-white/10 bg-[#14151e] shadow-xl lg:block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sample-poster.jpg"
                  alt="Creator footage transitioning from original shot to word highlight and docked editor preview"
                  style={{
                    transform: `scale(${mediaZoom.toFixed(3)})`,
                  }}
                  className="h-full w-full object-cover object-[50%_28%] will-change-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#14151e]/85 via-[#14151e]/15 to-transparent" />

                {/* Docked mini caption inside the center editor preview window once aligned */}
                {dockT > 0.75 && (
                  <div
                    style={{ opacity: clamp01((dockT - 0.75) / 0.25) }}
                    className="absolute inset-x-2 bottom-2.5 flex flex-wrap justify-center gap-0.5 text-[8px] font-extrabold uppercase"
                  >
                    <span className="rounded bg-black/80 px-1 py-0.5 text-ink">
                      CRISP
                    </span>
                    <span className="rounded bg-accent px-1 py-0.5 text-[#14151e]">
                      TIMING
                    </span>
                  </div>
                )}
              </div>

              {/* Mobile / Tablet Footage Layer (fades cleanly before editor appears so two UIs never overlap) */}
              <div
                style={{
                  opacity: 1 - dockT,
                }}
                className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-[#14151e] lg:hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sample-poster.jpg"
                  alt="Creator footage transitioning from original shot to word highlight"
                  style={{
                    transform: `scale(${mediaZoom.toFixed(3)})`,
                  }}
                  className="h-full w-full object-cover object-[50%_28%] will-change-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#14151e]/85 via-[#14151e]/15 to-transparent" />
              </div>

              {/* View 1 Badge (Original shot) */}
              {originalBadgeOpacity > 0.01 && (
                <div
                  style={{ opacity: originalBadgeOpacity }}
                  className="pointer-events-none absolute left-4 top-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#181923]/88 px-3 py-1 text-[11px] font-semibold text-ink backdrop-blur-md"
                >
                  <Film className="h-3.5 w-3.5 text-ink-secondary" />
                  <span>Original clip · No captions yet</span>
                </div>
              )}

              {/* View 2 Overlay (Readable Timed Word Highlight — clears cleanly before docking) */}
              {closeupOpacity > 0.01 && (
                <div
                  style={{
                    opacity: closeupOpacity,
                    transform: `translate3d(0, ${((1 - closeupOpacity) * 14).toFixed(1)}px, 0)`,
                  }}
                  className="pointer-events-none absolute inset-x-4 bottom-7 z-30 flex flex-col items-center gap-2 sm:bottom-10"
                >
                  <span className="rounded-full border border-accent/55 bg-[#181923]/90 px-3 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-hover backdrop-blur-md">
                    Word-level sync · 0:08.1
                  </span>
                  <p className="flex max-w-xl flex-wrap justify-center gap-1.5 text-center text-lg font-extrabold uppercase tracking-tight sm:text-2xl">
                    {CLOSEUP_WORDS.map((word, idx) => {
                      const isActive = idx === activeWordIdx;
                      const isPast = idx < activeWordIdx;
                      return (
                        <span
                          key={word}
                          className={`rounded-lg px-2 py-0.5 ${
                            isActive
                              ? "scale-105 bg-accent text-[#14151e] shadow-[0_8px_22px_rgba(175,160,245,0.48)]"
                              : isPast
                                ? "bg-[#14151e]/85 text-ink"
                                : "bg-[#14151e]/68 text-ink/85"
                          }`}
                        >
                          {word}
                        </span>
                      );
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
