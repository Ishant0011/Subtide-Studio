import Link from "next/link";
import { ArrowRight, Captions, Play, Sliders, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B10] text-[#F5F1E8]">
      {/* Subtle Ambient Mint Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#49E6B3]/10 blur-[130px]"
      />

      {/* Header */}
      <header className="relative z-10 border-b border-[#F5F1E8]/8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3]">
              <Captions className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight text-[#F5F1E8]">
              Subtide Studio
            </span>
          </div>

          <Link
            href="/studio"
            className="rounded-xl border border-[#F5F1E8]/12 bg-[#0D131C] px-3.5 py-2 text-xs font-medium text-[#F5F1E8] transition hover:border-[#49E6B3]/50 hover:text-[#49E6B3]"
          >
            Open Studio
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 lg:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          {/* Copy Column */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#49E6B3]/30 bg-[#102E28]/80 px-3.5 py-1.5 text-xs font-medium text-[#49E6B3]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Word-synced portrait captions</span>
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-[1.06] tracking-[-0.03em] text-[#F5F1E8] sm:text-5xl lg:text-6xl">
              Caption your clips.{" "}
              <span className="text-[#49E6B3]">Keep your style.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#B6B0A4] sm:text-lg">
              Preview frame-accurate, word-level captions on portrait video.
              Scrub the timeline, click any line to jump straight to it, and
              switch between Clean, Boxed, and Word Highlight looks in one
              click.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                href="/studio"
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#49E6B3] px-6 py-3.5 text-sm font-semibold text-[#070B10] shadow-[0_8px_30px_rgba(73,230,179,0.28)] transition hover:bg-[#2FD49F]"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Try a sample</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-xs text-[#7D7A72]">
                Bundled 9:16 clip · No sign-in required
              </span>
            </div>

            {/* Compact Feature Strip */}
            <div className="mt-12 grid grid-cols-1 gap-3.5 border-t border-[#F5F1E8]/10 pt-8 sm:grid-cols-3">
              <div className="rounded-xl border border-[#F5F1E8]/8 bg-[#0D131C]/80 p-4">
                <Play className="h-4 w-4 text-[#49E6B3]" />
                <h2 className="mt-2.5 text-sm font-semibold text-[#F5F1E8]">
                  Live Word Sync
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#B6B0A4]">
                  Active cue and active word follow media playback time smoothly.
                </p>
              </div>

              <div className="rounded-xl border border-[#F5F1E8]/8 bg-[#0D131C]/80 p-4">
                <Sliders className="h-4 w-4 text-[#49E6B3]" />
                <h2 className="mt-2.5 text-sm font-semibold text-[#F5F1E8]">
                  Three Style Presets
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#B6B0A4]">
                  Switch instantly between Clean, Boxed, and Word Highlight.
                </p>
              </div>

              <div className="rounded-xl border border-[#F5F1E8]/8 bg-[#0D131C]/80 p-4">
                <Captions className="h-4 w-4 text-[#49E6B3]" />
                <h2 className="mt-2.5 text-sm font-semibold text-[#F5F1E8]">
                  Click-to-Seek Cues
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#B6B0A4]">
                  Tap any line in the transcript to jump directly to its timestamp.
                </p>
              </div>
            </div>
          </div>

          {/* Portrait Visual Preview Card */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[310px] rounded-[2rem] border border-[#F5F1E8]/12 bg-[#0D131C] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.65)]">
              <div className="relative flex aspect-[9/16] flex-col justify-between overflow-hidden rounded-[1.4rem] bg-gradient-to-b from-[#112433] via-[#0B1722] to-[#070B10] p-4">
                {/* Decorative Studio Light Rings */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 top-12 h-48 w-48 rounded-full bg-[#49E6B3]/18 blur-3xl"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-10 bottom-28 h-44 w-44 rounded-full bg-[#38BDF8]/12 blur-3xl"
                />

                {/* Top Badge */}
                <div className="relative z-10 flex items-center justify-between text-[11px] font-medium text-[#B6B0A4]">
                  <span className="rounded-full border border-[#F5F1E8]/15 bg-[#070B10]/65 px-2.5 py-1 text-[#F5F1E8]">
                    9:16 Sample
                  </span>
                  <span className="font-mono tabular-nums text-[#49E6B3]">
                    0:01.6 / 0:15.0
                  </span>
                </div>

                {/* Preset Preview Stack */}
                <div className="relative z-10 flex flex-col gap-3 pb-4">
                  <div className="rounded-xl border border-[#F5F1E8]/12 bg-[#070B10]/70 px-3 py-2 text-center backdrop-blur-md">
                    <span className="block text-[10px] uppercase tracking-wider text-[#7D7A72]">
                      Boxed
                    </span>
                    <p className="mt-0.5 text-xs font-semibold text-[#F5F1E8]">
                      Most people watch{" "}
                      <span className="text-[#49E6B3]">muted.</span>
                    </p>
                  </div>

                  <div className="py-1 text-center">
                    <span className="block text-[10px] uppercase tracking-wider text-[#7D7A72]">
                      Word Highlight
                    </span>
                    <p className="mt-1 flex flex-wrap items-center justify-center gap-1 text-sm font-extrabold uppercase tracking-wide">
                      <span className="text-[#F5F1E8]">KEEP</span>
                      <span className="text-[#F5F1E8]">YOUR</span>
                      <span className="rounded-md bg-[#49E6B3] px-2 py-0.5 text-[#070B10]">
                        STYLE.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
