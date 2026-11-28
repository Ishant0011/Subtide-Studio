"use client";

import { useEffect, useRef, useState } from "react";
import { Film, SlidersHorizontal, Sparkles } from "lucide-react";

const SEQUENCE_STEPS = [
  {
    index: "01",
    label: "Raw footage",
    title: "Start from your original clip",
    copy: "Upload vertical, widescreen, or audio-only clips. ClipCaptions keeps your source resolution, framing, and voice untouched.",
    image: "/sample-poster.jpg",
    imageAlt: "Original creator talking-head footage before captions",
    crop: "object-[50%_20%]",
    icon: Film,
  },
  {
    index: "02",
    label: "Captions in motion",
    title: "Every spoken word lands on beat",
    copy: "Word-level karaoke pills, crisp outlines, and custom brand colors stay locked to the speaker's natural cadence.",
    image: "/sample-gallery-frame.jpg",
    imageAlt: "Close-up of live word-highlighted captions over creator footage",
    crop: "object-[50%_28%]",
    icon: Sparkles,
  },
  {
    index: "03",
    label: "Full studio control",
    title: "Edit words, style, and export up to 4K",
    copy: "Fix any line inline, swap across 10 bundled fonts, trim on the waveform timeline, and render burned-in H.264 MP4.",
    image: "/sample-editor-frame.jpg",
    imageAlt: "ClipCaptions three-column editor workflow preview",
    crop: "object-[50%_22%]",
    icon: SlidersHorizontal,
  },
] as const;

export function HomeCinematicSequence() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let rafId = 0;
    const updateFromScroll = () => {
      rafId = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const progress = Math.max(
        0,
        Math.min(1, (vh * 0.65 - rect.top) / Math.max(1, rect.height * 0.72))
      );
      const next = progress < 0.34 ? 0 : progress < 0.68 ? 1 : 2;
      setActiveIdx((curr) => (curr === next ? curr : next));
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateFromScroll);
      }
    };

    updateFromScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      data-testid="home-cinematic-sequence"
      aria-label="From footage to captioned export"
      className="border-t border-ink/10 py-14 lg:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              Cut to captions
            </p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              From raw footage to a finished frame
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Sequence frames"
            className="inline-flex rounded-xl border border-ink/12 bg-panel p-1 text-xs"
          >
            {SEQUENCE_STEPS.map((step, idx) => {
              const active = activeIdx === idx;
              return (
                <button
                  key={step.index}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveIdx(idx)}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                    active
                      ? "bg-accent text-page"
                      : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  {step.index} · {step.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {SEQUENCE_STEPS.map((step, idx) => {
            const active = activeIdx === idx;
            const Icon = step.icon;
            return (
              <button
                key={step.index}
                type="button"
                onClick={() => setActiveIdx(idx)}
                data-testid={`sequence-card-${idx + 1}`}
                data-active={active ? "true" : "false"}
                className={`cc-card-interactive group flex flex-col overflow-hidden rounded-2xl border text-left ${
                  active
                    ? "border-accent/70 bg-panel shadow-[0_20px_54px_rgba(0,0,0,0.5)]"
                    : "border-ink/10 bg-panel/70 hover:border-ink/25"
                }`}
              >
                <div className="relative h-56 w-full overflow-hidden bg-inset">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={step.image}
                    alt={step.imageAlt}
                    className={`h-full w-full object-cover ${step.crop} transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                      active ? "scale-[1.06]" : "scale-100 opacity-85"
                    }`}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#101116]/90 via-[#101116]/20 to-transparent" />

                  <span
                    className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold backdrop-blur-md ${
                      active
                        ? "border-accent/60 bg-accent text-page"
                        : "border-white/15 bg-page/75 text-ink"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>
                      {step.index} · {step.label}
                    </span>
                  </span>

                  {/* Distinct visual overlay per beat */}
                  {idx === 1 && (
                    <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap justify-center gap-1.5 text-center text-sm font-extrabold uppercase tracking-tight">
                      <span className="rounded-md bg-black/75 px-2 py-0.5 text-ink">
                        CRISP
                      </span>
                      <span className="rounded-md bg-accent px-2 py-0.5 text-page shadow-[0_6px_20px_rgba(169,154,242,0.45)]">
                        TIMING
                      </span>
                      <span className="rounded-md bg-black/75 px-2 py-0.5 text-ink">
                        MOMENTUM.
                      </span>
                    </div>
                  )}

                  {idx === 2 && (
                    <div className="pointer-events-none absolute inset-x-3 bottom-3 grid grid-cols-3 gap-1.5 rounded-xl border border-white/12 bg-[#101116]/85 p-2 text-[10px] backdrop-blur-md">
                      <div className="rounded-md bg-panel px-2 py-1 text-ink-secondary">
                        Transcript
                      </div>
                      <div className="rounded-md bg-accent/20 px-2 py-1 text-center font-semibold text-accent-hover">
                        Live Stage
                      </div>
                      <div className="rounded-md bg-panel px-2 py-1 text-right text-ink-secondary">
                        4K MP4
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <h3 className="text-base font-bold tracking-tight text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    {step.copy}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
