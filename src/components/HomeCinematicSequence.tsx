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
    label: "Timed word highlight",
    summary: "Every word lights up on beat as the speaker talks.",
  },
  {
    id: "editor",
    num: "03",
    label: "Editor & timeline",
    summary: "Pull back into the full workspace to edit words, timing, and style.",
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
  22, 44, 68, 52, 30, 74, 88, 60, 40, 26, 62, 82, 54, 34, 72, 92, 66, 48, 30,
  58, 78, 42, 24, 64, 86, 56, 36, 70, 50, 28,
];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
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

  const activeBeatIdx = progress < 0.32 ? 0 : progress < 0.66 ? 1 : 2;

  // Continuous camera choreography (0..1):
  // Beat A (0.00 -> 0.33): raw shot
  // Beat B (0.33 -> 0.66): dramatic zoom-in close-up + timed word highlight sweep
  // Beat C (0.66 -> 1.00): smooth pull-back revealing full 3-column editor + waveform timeline
  const closeupBlend = reducedMotion
    ? activeBeatIdx === 1
      ? 1
      : 0
    : clamp01((progress - 0.18) / 0.22) *
      (1 - clamp01((progress - 0.56) / 0.18));

  const editorBlend = reducedMotion
    ? activeBeatIdx === 2
      ? 1
      : 0
    : clamp01((progress - 0.58) / 0.24);

  const stageScale = reducedMotion
    ? 1
    : 1 + closeupBlend * 0.26 - editorBlend * 0.04;

  const stageTranslateY = reducedMotion
    ? 0
    : closeupBlend * -14;

  const activeWordIdx = Math.min(
    CLOSEUP_WORDS.length - 1,
    Math.max(0, Math.floor(clamp01((progress - 0.26) / 0.36) * CLOSEUP_WORDS.length))
  );

  const jumpToBeat = (idx: number) => {
    if (reducedMotion || !trackRef.current) {
      setProgress(idx === 0 ? 0.1 : idx === 1 ? 0.48 : 0.9);
      return;
    }
    const rect = trackRef.current.getBoundingClientRect();
    const trackTop = window.scrollY + rect.top;
    const scrollable = Math.max(1, rect.height - window.innerHeight);
    const targetPct = idx === 0 ? 0.04 : idx === 1 ? 0.46 : 0.92;
    window.scrollTo({
      top: trackTop + scrollable * targetPct,
      behavior: "smooth",
    });
  };

  return (
    <section
      id="workflow"
      data-testid="home-cinematic-sequence"
      aria-label="Editor preview and cinematic scroll sequence"
      className="border-t border-ink/10 bg-inset/40"
    >
      {/* Tall user-controlled scroll track (zero scroll hijacking; natural in reverse) */}
      <div
        ref={trackRef}
        className={
          reducedMotion
            ? "mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20"
            : "relative mx-auto min-h-[205vh] max-w-6xl px-4 sm:min-h-[220vh] sm:px-6 lg:px-8"
        }
      >
        <div
          className={
            reducedMotion
              ? "space-y-6"
              : "sticky top-14 flex min-h-[calc(100vh-3.5rem)] flex-col justify-center py-6 sm:top-16 sm:py-8"
          }
        >
          {/* Section Header + Interactive Beat Selector */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Inside ClipCaptions
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-3xl">
                Fix a word. Adjust the timing. Make it yours.
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                Correct names inline, nudge caption timing on the waveform, and
                change fonts or colors while seeing the result live on your
                video.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="Scroll sequence beats"
                className="inline-flex rounded-xl border border-ink/12 bg-panel p-1 text-[11px]"
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
                          ? "bg-accent text-page"
                          : "text-ink-secondary hover:text-ink"
                      }`}
                    >
                      <span className="font-mono opacity-80">{beat.num}</span>{" "}
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

          {/* Continuous Scroll-Driven Cinematic Stage */}
          <div
            data-testid="cinematic-sequence-stage"
            data-active-beat={BEATS[activeBeatIdx].id}
            className="cc-stage-frame relative mt-4 overflow-hidden rounded-2xl border border-white/12 p-3 shadow-[0_28px_72px_rgba(0,0,0,0.55)] sm:mt-5 sm:p-5"
          >
            {/* Progress Bar */}
            <div className="mb-3 flex items-center justify-between gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent/20 font-mono text-[10px] text-accent-hover">
                  {BEATS[activeBeatIdx].num}
                </span>
                <span>{BEATS[activeBeatIdx].label}</span>
                <span className="hidden text-ink-muted sm:inline">
                  — {BEATS[activeBeatIdx].summary}
                </span>
              </span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:w-32">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-75"
                  style={{ width: `${Math.round(Math.max(8, progress * 100))}%` }}
                />
              </div>
            </div>

            {/* Unified 3-Beat Visual Composition */}
            <div className="relative min-h-[370px] overflow-hidden rounded-xl border border-white/10 bg-[#101116] sm:min-h-[440px]">
              {/* LAYER 1 & 2: Original Shot -> Close-up Timed Word Highlighting */}
              <div
                aria-hidden={editorBlend > 0.85}
                style={{
                  opacity: 1 - editorBlend,
                  transform: `scale(${(1 - editorBlend * 0.08).toFixed(3)})`,
                  pointerEvents: editorBlend > 0.5 ? "none" : "auto",
                }}
                className="absolute inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-150"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={closeupBlend > 0.45 ? "/sample-gallery-frame.jpg" : "/sample-poster.jpg"}
                  alt="Creator footage transitioning from original shot into close-up timed captions"
                  style={{
                    transform: `scale(${stageScale.toFixed(3)}) translateY(${stageTranslateY.toFixed(1)}px)`,
                  }}
                  className="h-full w-full object-cover object-[50%_24%] will-change-transform"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#101116]/90 via-[#101116]/20 to-transparent" />

                {/* Beat A Label (fades out as Beat B zooms in) */}
                <div
                  style={{ opacity: Math.max(0, 1 - closeupBlend * 2.2) }}
                  className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#101116]/80 px-3 py-1 text-[11px] font-semibold text-ink backdrop-blur-md"
                >
                  <Film className="h-3.5 w-3.5 text-ink-secondary" />
                  <span>Original clip · No captions yet</span>
                </div>

                {/* Beat B Close-Up Timed Word Highlighting */}
                <div
                  style={{
                    opacity: closeupBlend,
                    transform: `translateY(${((1 - closeupBlend) * 18).toFixed(1)}px) scale(${(0.94 + closeupBlend * 0.08).toFixed(3)})`,
                  }}
                  className="pointer-events-none absolute inset-x-4 bottom-8 flex flex-col items-center gap-2 sm:bottom-12"
                >
                  <span className="rounded-full border border-accent/40 bg-[#101116]/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-hover backdrop-blur-md">
                    Word-level sync · 0:08.1
                  </span>
                  <p className="flex max-w-xl flex-wrap justify-center gap-1.5 text-center text-lg font-extrabold uppercase tracking-tight sm:text-2xl">
                    {CLOSEUP_WORDS.map((word, idx) => {
                      const isActive = idx === activeWordIdx;
                      const isPast = idx < activeWordIdx;
                      return (
                        <span
                          key={word}
                          className={`rounded-lg px-2 py-0.5 transition-all duration-150 ${
                            isActive
                              ? "scale-105 bg-accent text-page shadow-[0_8px_24px_rgba(169,154,242,0.45)]"
                              : isPast
                                ? "bg-black/75 text-ink"
                                : "bg-black/55 text-ink/75"
                          }`}
                        >
                          {word}
                        </span>
                      );
                    })}
                  </p>
                </div>
              </div>

              {/* LAYER 3 (Beat C): Pull-Back Reveal of Real ClipCaptions 3-Column Editor + Waveform Timeline */}
              <div
                data-testid="home-editor-preview"
                style={{
                  opacity: editorBlend,
                  transform: `scale(${(1.06 - editorBlend * 0.06).toFixed(3)})`,
                  pointerEvents: editorBlend > 0.35 ? "auto" : "none",
                }}
                className="relative z-10 flex h-full min-h-[370px] flex-col justify-between bg-panel sm:min-h-[440px]"
              >
                {/* Editor Top Bar */}
                <div className="flex items-center justify-between gap-2 border-b border-ink/10 bg-inset px-3.5 py-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-ink/12 bg-panel px-2 py-0.5 text-[10px] text-ink-secondary">
                      Projects
                    </span>
                    <span className="truncate font-semibold text-ink">
                      creator-hook-take-02.mp4
                    </span>
                    <span className="hidden rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-ink-muted sm:inline">
                      Rev #3 · 9:16
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-[10px] text-ink-secondary sm:inline">
                      Saved
                    </span>
                    <span className="rounded-md bg-accent px-2.5 py-1 text-[10px] font-semibold text-page">
                      Export MP4
                    </span>
                  </div>
                </div>

                {/* 3-Column Workspace: Transcript | Video Stage | Appearance */}
                <div className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_170px_minmax(0,1fr)]">
                  {/* Left: Transcript */}
                  <div className="flex flex-col rounded-xl border border-ink/10 bg-inset p-2.5">
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <span className="text-[11px] font-semibold text-ink">
                        Transcript
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-accent/45 bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-hover">
                        <LocateFixed className="h-2.5 w-2.5" />
                        <span>Follow</span>
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="rounded-lg border border-accent bg-panel p-2">
                        <div className="flex items-center justify-between font-mono text-[9px] text-ink-secondary">
                          <span>#3 · 0:07.5 – 0:10.8</span>
                          <span className="text-accent-hover">Editing</span>
                        </div>
                        <p className="mt-1 rounded bg-inset px-2 py-1 text-ink">
                          Crisp timing turns every sentence into momentum.
                        </p>
                      </div>
                      <div className="hidden rounded-lg border border-ink/10 bg-panel/60 px-2 py-1.5 text-ink-secondary sm:block">
                        <span className="font-mono text-[9px] text-ink-muted">
                          0:11.6
                        </span>
                        <p className="truncate">
                          Switch presets in one click to match your brand.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Center: Live Video Stage */}
                  <div className="mx-auto flex w-full max-w-[170px] flex-col items-center justify-center rounded-xl border border-ink/10 bg-inset p-2">
                    <div className="relative aspect-[9/16] w-full max-h-[195px] overflow-hidden rounded-lg bg-page">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/sample-editor-frame.jpg"
                        alt="Live preview inside the ClipCaptions editor"
                        className="h-full w-full object-cover object-[50%_18%]"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                      <div className="pointer-events-none absolute inset-x-1.5 bottom-2.5 flex flex-wrap justify-center gap-0.5 text-[8px] font-extrabold uppercase">
                        <span className="rounded bg-black/75 px-1 py-0.5 text-ink">
                          CRISP
                        </span>
                        <span className="rounded bg-accent px-1 py-0.5 text-page">
                          TIMING
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Appearance */}
                  <div className="hidden flex-col rounded-xl border border-ink/10 bg-inset p-2.5 lg:flex">
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-[11px] font-semibold text-ink">
                        Appearance
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-page">
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
                      <div className="rounded-lg border border-ink/10 bg-panel p-2">
                        <p className="font-bold text-ink">Clean</p>
                        <p className="text-[9px] text-ink-muted">Inter</p>
                      </div>
                      <div className="rounded-lg border border-ink/10 bg-panel p-2">
                        <p className="font-bold text-ink">Bold</p>
                        <p className="text-[9px] text-ink-muted">Bebas Neue</p>
                      </div>
                      <div className="rounded-lg border border-ink/10 bg-panel p-2">
                        <p className="font-bold text-ink">Devanagari</p>
                        <p className="text-[9px] text-ink-muted">Noto Sans</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom: Real Waveform Timeline Strip */}
                <div className="border-t border-ink/10 bg-inset px-3.5 py-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-mono text-ink-muted">
                    <span className="inline-flex items-center gap-1.5 text-ink-secondary">
                      <Play className="h-3 w-3 fill-accent text-accent" />
                      <span>Timeline · 0:08.1 / 0:17.6</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-ink-secondary">
                      <SlidersHorizontal className="h-3 w-3" />
                      <span>Drag edges · Split · Merge</span>
                    </span>
                  </div>
                  <div className="relative flex h-10 items-end gap-1 overflow-hidden rounded-lg border border-ink/10 bg-page px-2 py-1.5">
                    {WAVEFORM_BARS.map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${Math.round(h * 0.3)}px` }}
                        className={`flex-1 rounded-full ${
                          i >= 9 && i <= 18 ? "bg-accent/80" : "bg-ink/20"
                        }`}
                      />
                    ))}
                    {/* Active Cue Block Highlight & Playhead */}
                    <div className="pointer-events-none absolute inset-y-1 left-[30%] right-[36%] rounded border border-accent bg-accent/15" />
                    <div className="pointer-events-none absolute inset-y-0 left-[44%] w-0.5 bg-accent shadow-[0_0_8px_rgba(169,154,242,0.9)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
