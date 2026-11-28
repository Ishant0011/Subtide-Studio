"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Film,
  LocateFixed,
  Play,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

const SCENES = [
  {
    id: "original",
    num: "01",
    label: "Original",
    summary: "Wide raw shot before captions are added.",
    targetProgress: 0.04,
  },
  {
    id: "captioned",
    num: "02",
    label: "Captioned",
    summary: "Close-up focus where every spoken word highlights on beat.",
    targetProgress: 0.46,
  },
  {
    id: "editor",
    num: "03",
    label: "Editor",
    summary: "Footage docks into the preview with transcript and timeline around it.",
    targetProgress: 1.0,
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

function sceneFromScrollProgress(p: number): 0 | 1 | 2 {
  if (p < 0.28) return 0;
  // Switch to Editor label only once editor chrome is clearly visible (>= 0.76)
  if (p < 0.76) return 1;
  return 2;
}

export function HomeCinematicSequence() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [progress, setProgress] = useState(0);
  const [activeScene, setActiveScene] = useState<0 | 1 | 2>(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const progressRef = useRef(0);
  const animRafRef = useRef(0);
  const manualLockRef = useRef<{
    locked: boolean;
    scrollYAtLock: number;
    lockUntil: number;
  }>({
    locked: false,
    scrollYAtLock: 0,
    lockUntil: 0,
  });

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const selectScene = useCallback(
    (idx: 0 | 1 | 2, focusTab = false) => {
      // Cancel any in-flight manual transition
      if (animRafRef.current) {
        window.cancelAnimationFrame(animRafRef.current);
        animRafRef.current = 0;
      }

      // Immediately update selected state so tab label & visual never desync
      setActiveScene(idx);
      if (focusTab) {
        tabRefs.current[idx]?.focus();
      }

      const target = SCENES[idx].targetProgress;

      // Lock against scroll interference during the transition and until user intentionally scrolls
      manualLockRef.current = {
        locked: true,
        scrollYAtLock: typeof window !== "undefined" ? window.scrollY : 0,
        lockUntil:
          typeof performance !== "undefined" ? performance.now() + 420 : 0,
      };

      if (reducedMotion || typeof window === "undefined") {
        progressRef.current = target;
        setProgress(target);
        return;
      }

      const startVal = progressRef.current;
      const delta = target - startVal;
      if (Math.abs(delta) < 0.004) {
        progressRef.current = target;
        setProgress(target);
        return;
      }

      const durationMs = 280;
      const startTime = performance.now();
      const step = (now: number) => {
        const t = clamp01((now - startTime) / durationMs);
        const next = startVal + delta * easeOutCubic(t);
        progressRef.current = next;
        setProgress(next);
        if (t < 1) {
          animRafRef.current = window.requestAnimationFrame(step);
        } else {
          animRafRef.current = 0;
        }
      };
      animRafRef.current = window.requestAnimationFrame(step);
    },
    [reducedMotion]
  );

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: 0 | 1 | 2
  ) => {
    let nextIdx: 0 | 1 | 2 | null = null;
    if (e.key === "ArrowRight") {
      nextIdx = ((idx + 1) % 3) as 0 | 1 | 2;
    } else if (e.key === "ArrowLeft") {
      nextIdx = ((idx + 2) % 3) as 0 | 1 | 2;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = 2;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      selectScene(nextIdx, true);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) {
      setReducedMotion(true);
      return;
    }

    let scrollRafId = 0;
    const updateFromScroll = () => {
      scrollRafId = 0;
      const el = trackRef.current;
      if (!el) return;

      const lock = manualLockRef.current;
      if (lock.locked) {
        const now = performance.now();
        // Never undo a manual choice while transition is running
        if (now < lock.lockUntil) return;
        // Release manual lock only after intentional user scroll (> 48px)
        if (Math.abs(window.scrollY - lock.scrollYAtLock) <= 48) return;
        lock.locked = false;
      }

      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const scrollable = Math.max(1, rect.height - vh);
      const raw = clamp01(-rect.top / scrollable);
      progressRef.current = raw;
      setProgress(raw);
      setActiveScene(sceneFromScrollProgress(raw));
    };

    const onScroll = () => {
      if (!scrollRafId) {
        scrollRafId = window.requestAnimationFrame(updateFromScroll);
      }
    };

    updateFromScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (scrollRafId) window.cancelAnimationFrame(scrollRafId);
      if (animRafRef.current) window.cancelAnimationFrame(animRafRef.current);
    };
  }, []);

  // Visual choreography driven from single progress value (0 -> 1):
  // 0.00 - 0.28: Wide original shot (no captions, no editor UI)
  // 0.28 - 0.60: Close-up timed word highlight (caption becomes the focus)
  // 0.60 - 0.74: Word highlight clears, footage aligns into center editor preview window
  // 0.72 - 0.88: Transcript, appearance panel, and waveform timeline reveal around it
  const originalBadgeOpacity = 1 - clamp01((progress - 0.2) / 0.08);
  const closeupIn = clamp01((progress - 0.26) / 0.1);
  const closeupOut = 1 - clamp01((progress - 0.56) / 0.07);
  const closeupOpacity = closeupIn * closeupOut;

  const dockT = easeOutCubic((progress - 0.6) / 0.14);
  const chromeReveal = easeOutCubic((progress - 0.72) / 0.14);
  const mediaZoom =
    1 + clamp01((progress - 0.24) / 0.18) * (1 - dockT) * 0.15;

  const activeWordIdx = Math.min(
    CLOSEUP_WORDS.length - 1,
    Math.max(
      0,
      Math.floor(clamp01((progress - 0.29) / 0.27) * CLOSEUP_WORDS.length)
    )
  );

  const currentScene = SCENES[activeScene];

  return (
    <section
      id="workflow"
      data-testid="home-cinematic-sequence"
      aria-label="Cinematic editor reveal"
      className="scroll-mt-20 border-t border-white/10 bg-[#0B0B0F]"
    >
      <div
        ref={trackRef}
        className={
          reducedMotion
            ? "mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
            : "relative mx-auto min-h-[135vh] max-w-6xl px-4 sm:min-h-[170vh] sm:px-6 lg:px-8"
        }
      >
        <div
          className={
            reducedMotion
              ? "flex flex-col justify-center"
              : "sticky top-14 flex min-h-[calc(100vh-3.5rem)] flex-col justify-center py-4 sm:top-16 sm:py-6"
          }
        >
          {/* Section Header + Direct Scene Tablist (Readable labels on mobile & desktop) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Inside the editor
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-3xl">
                From raw footage to timed captions and timeline control.
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div
                role="tablist"
                aria-label="Editor reveal scenes"
                data-testid="cinematic-scene-tablist"
                className="inline-flex rounded-xl border border-white/15 bg-[#1D1D27] p-1 text-xs"
              >
                {SCENES.map((scene, idx) => {
                  const sceneIdx = idx as 0 | 1 | 2;
                  const active = activeScene === sceneIdx;
                  return (
                    <button
                      key={scene.id}
                      ref={(el) => {
                        tabRefs.current[idx] = el;
                      }}
                      id={`scene-tab-${scene.id}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls="cinematic-scene-panel"
                      tabIndex={active ? 0 : -1}
                      data-testid={`sequence-beat-${idx + 1}`}
                      onClick={() => selectScene(sceneIdx)}
                      onKeyDown={(e) => handleTabKeyDown(e, sceneIdx)}
                      className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                        active
                          ? "bg-accent text-[#101014] shadow-sm"
                          : "text-ink-secondary hover:text-ink"
                      }`}
                    >
                      {scene.label}
                    </button>
                  );
                })}
              </div>

              <Link
                href="/studio"
                className="hidden items-center gap-1 text-xs font-semibold text-ink transition hover:text-accent-hover md:inline-flex"
              >
                <span>Open sample editor</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Associated Tabpanel Stage */}
          <div
            id="cinematic-scene-panel"
            role="tabpanel"
            aria-labelledby={`scene-tab-${currentScene.id}`}
            data-testid="cinematic-sequence-stage"
            data-active-beat={currentScene.id}
            data-scroll-progress={progress.toFixed(3)}
            className="relative mt-4 overflow-hidden rounded-2xl border border-white/12 bg-[#14141C] p-3 shadow-[0_28px_72px_rgba(0,0,0,0.62)] sm:p-4"
          >
            {/* Active Scene Caption & Progress Strip */}
            <div className="mb-2.5 flex items-center justify-between gap-3 text-xs">
              <span className="inline-flex items-center gap-2 font-semibold text-ink">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent/20 font-mono text-[10px] text-accent">
                  {currentScene.num}
                </span>
                <span data-testid="cinematic-active-label">
                  {currentScene.label}
                </span>
                <span className="hidden text-ink-secondary sm:inline">
                  — {currentScene.summary}
                </span>
              </span>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/12 sm:w-32">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.round(Math.max(8, progress * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Stable Fixed-Height Viewport Stage */}
            <div className="relative h-[340px] overflow-hidden rounded-xl bg-[#0B0B0F] sm:h-[430px]">
              {/* FULL EDITOR SHELL — reveals around the docked preview window */}
              <div
                data-testid="home-editor-preview"
                data-editor-visible={chromeReveal > 0.65 ? "true" : "false"}
                aria-hidden={chromeReveal < 0.2}
                style={{
                  opacity: chromeReveal,
                  pointerEvents: chromeReveal > 0.5 ? "auto" : "none",
                }}
                className="absolute inset-0 z-10 flex flex-col justify-between bg-[#1D1D27]"
              >
                {/* Editor Top Bar */}
                <div
                  style={{
                    transform: `translate3d(0, ${((1 - chromeReveal) * -10).toFixed(1)}px, 0)`,
                  }}
                  className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#14141C] px-3.5 py-2 text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[#29283E] px-2 py-0.5 text-[10px] font-medium text-ink-secondary">
                      Projects
                    </span>
                    <span className="truncate font-semibold text-ink">
                      hook-take-02.mp4
                    </span>
                    <span className="hidden rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary sm:inline">
                      Rev #3 · 9:16
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-[10px] text-ink-secondary sm:inline">
                      Autosaved
                    </span>
                    <span className="rounded-md bg-accent px-2.5 py-1 text-[10px] font-semibold text-[#101014]">
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
                    className="flex flex-col rounded-xl bg-[#14141C] p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <span className="text-[11px] font-semibold text-ink">
                        Transcript
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-accent/18 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                        <LocateFixed className="h-2.5 w-2.5" />
                        <span>Follow</span>
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="rounded-lg border border-accent bg-[#1D1D27] p-2">
                        <div className="flex items-center justify-between font-mono text-[9px] text-ink-secondary">
                          <span>#3 · 0:07.5 – 0:10.8</span>
                          <span className="font-semibold text-accent">
                            Active
                          </span>
                        </div>
                        <p className="mt-1 rounded bg-[#14141C] px-2 py-1 text-ink">
                          Crisp timing turns every sentence into momentum.
                        </p>
                      </div>
                      <div className="hidden rounded-lg bg-[#1D1D27]/70 px-2 py-1.5 text-ink-secondary sm:block">
                        <span className="font-mono text-[9px] text-ink-muted">
                          0:11.6
                        </span>
                        <p className="truncate">
                          Switch presets in one click to match your brand.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Center: Alignment guide slot where docked footage sits on desktop */}
                  <div className="hidden rounded-xl bg-[#14141C]/80 lg:block" />

                  {/* Right: Appearance */}
                  <div
                    style={{
                      transform: `translate3d(${((1 - chromeReveal) * 16).toFixed(1)}px, 0, 0)`,
                    }}
                    className="hidden flex-col rounded-xl bg-[#14141C] p-2.5 lg:flex"
                  >
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-[11px] font-semibold text-ink">
                        Appearance
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-[#101014]">
                        <Sparkles className="h-2.5 w-2.5" />
                        <span>16 Presets</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="rounded-lg border border-accent bg-accent/15 p-2">
                        <p className="font-bold text-accent">Word Highlight</p>
                        <p className="text-[9px] text-ink-secondary">Poppins</p>
                      </div>
                      <div className="rounded-lg bg-[#1D1D27] p-2">
                        <p className="font-bold text-ink">Clean</p>
                        <p className="text-[9px] text-ink-secondary">Inter</p>
                      </div>
                      <div className="rounded-lg bg-[#1D1D27] p-2">
                        <p className="font-bold text-ink">Bold</p>
                        <p className="text-[9px] text-ink-secondary">
                          Bebas Neue
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#1D1D27] p-2">
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
                  className="border-t border-white/10 bg-[#14141C] px-3.5 py-2.5"
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
                  <div className="relative flex h-9 items-end gap-1 overflow-hidden rounded-lg bg-[#0B0B0F] px-2 py-1.5">
                    {WAVEFORM_BARS.map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${Math.round(h * 0.28)}px` }}
                        className={`flex-1 rounded-full ${
                          i >= 9 && i <= 18 ? "bg-accent" : "bg-white/22"
                        }`}
                      />
                    ))}
                    <div className="pointer-events-none absolute inset-y-1 left-[30%] right-[36%] rounded border border-accent bg-accent/18" />
                    <div className="pointer-events-none absolute inset-y-0 left-[44%] w-0.5 bg-accent shadow-[0_0_8px_rgba(192,176,255,0.9)]" />
                  </div>
                </div>
              </div>

              {/* DESKTOP SINGLE CONTINUOUS FOOTAGE WINDOW:
                  Wide original -> Close-up word highlight -> Docks into center editor preview */}
              <div
                data-testid="sequence-footage-window"
                style={{
                  inset: `${(dockT * 12).toFixed(2)}% ${(dockT * 40.5).toFixed(2)}% ${(dockT * 21).toFixed(2)}% ${(dockT * 40.5).toFixed(2)}%`,
                  borderRadius: `${(dockT * 10).toFixed(1)}px`,
                }}
                className="pointer-events-none absolute z-20 hidden overflow-hidden bg-[#0B0B0F] shadow-2xl lg:block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sample-poster.jpg"
                  alt="Creator footage transitioning from wide original shot to close-up caption and docked editor preview"
                  style={{
                    transform: `scale(${mediaZoom.toFixed(3)})`,
                  }}
                  className="h-full w-full object-cover object-[50%_26%] will-change-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0F]/85 via-[#0B0B0F]/12 to-transparent" />

                {dockT > 0.75 && (
                  <div
                    style={{ opacity: clamp01((dockT - 0.75) / 0.25) }}
                    className="absolute inset-x-2 bottom-2.5 flex flex-wrap justify-center gap-0.5 text-[8px] font-extrabold uppercase"
                  >
                    <span className="rounded bg-black/80 px-1 py-0.5 text-ink">
                      CRISP
                    </span>
                    <span className="rounded bg-accent px-1 py-0.5 text-[#101014]">
                      TIMING
                    </span>
                  </div>
                )}
              </div>

              {/* MOBILE / TABLET FOOTAGE LAYER */}
              <div
                style={{
                  opacity: 1 - dockT,
                }}
                className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-[#0B0B0F] lg:hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sample-poster.jpg"
                  alt="Creator footage transitioning from original shot to word highlight"
                  style={{
                    transform: `scale(${mediaZoom.toFixed(3)})`,
                  }}
                  className="h-full w-full object-cover object-[50%_26%] will-change-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0F]/85 via-[#0B0B0F]/12 to-transparent" />
              </div>

              {/* Scene 1 Badge: Wide Original */}
              {originalBadgeOpacity > 0.01 && (
                <div
                  style={{ opacity: originalBadgeOpacity }}
                  className="pointer-events-none absolute left-4 top-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-[#101014]/85 px-3 py-1 text-[11px] font-semibold text-ink backdrop-blur-md"
                >
                  <Film className="h-3.5 w-3.5 text-ink-secondary" />
                  <span>Original clip · Raw footage</span>
                </div>
              )}

              {/* Scene 2 Overlay: Close-Up Timed Word Highlight */}
              {closeupOpacity > 0.01 && (
                <div
                  style={{
                    opacity: closeupOpacity,
                    transform: `translate3d(0, ${((1 - closeupOpacity) * 14).toFixed(1)}px, 0)`,
                  }}
                  className="pointer-events-none absolute inset-x-4 bottom-7 z-30 flex flex-col items-center gap-2 sm:bottom-10"
                >
                  <span className="rounded-full bg-[#101014]/88 px-3 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent backdrop-blur-md">
                    Timed word highlight · 0:08.1
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
                              ? "scale-105 bg-accent text-[#101014] shadow-[0_8px_22px_rgba(192,176,255,0.48)]"
                              : isPast
                                ? "bg-[#101014]/85 text-ink"
                                : "bg-[#101014]/65 text-ink/85"
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

          {/* Reduced-motion accessible summary of all 3 scenes */}
          {reducedMotion && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SCENES.map((scene, idx) => (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => selectScene(idx as 0 | 1 | 2)}
                  className={`rounded-xl border p-3 text-left text-xs ${
                    activeScene === idx
                      ? "border-accent bg-[#1D1D27] text-ink"
                      : "border-white/10 bg-[#14141C] text-ink-secondary"
                  }`}
                >
                  <span className="font-mono text-[10px] text-accent">
                    {scene.num} · {scene.label}
                  </span>
                  <p className="mt-1">{scene.summary}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
