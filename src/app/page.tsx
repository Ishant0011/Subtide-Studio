import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  FileText,
  Film,
  Layers,
  Play,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { ClipCaptionsLockup } from "@/components/ClipCaptionsLogo";
import { HomeHeroDemo } from "@/components/HomeHeroDemo";
import { PublicHeader } from "@/components/PublicHeader";
import {
  HOMEPAGE_HEADLINE,
  HOMEPAGE_TITLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  getPublicOrigin,
} from "@/lib/site";
import { getVerifiedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: HOMEPAGE_TITLE,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
};

export default async function HomePage() {
  const user = await getVerifiedUser();
  const origin = getPublicOrigin();

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: origin,
    description: SITE_DESCRIPTION,
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-page text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* Ambient studio glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[860px] -translate-x-1/2 rounded-full bg-accent/10 blur-[150px]"
      />

      <PublicHeader userEmail={user?.email ?? null} />

      <main className="relative z-10">
        {/* Unified Hero Stage: Headline + Primary Action + Captioned Result as One Composition */}
        <section className="mx-auto max-w-7xl px-3 pb-8 pt-3 sm:px-6 sm:pb-12 sm:pt-5 lg:px-8 lg:pb-12 lg:pt-6">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-ink/10 bg-gradient-to-br from-panel via-inset to-page px-4 py-4 shadow-[0_28px_90px_rgba(0,0,0,0.65)] sm:rounded-[2.25rem] sm:px-8 sm:py-7 lg:px-12 lg:py-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 top-1/2 hidden h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-accent/12 blur-[110px] lg:block"
            />

            <div className="relative grid grid-cols-1 items-center gap-4 sm:gap-7 lg:grid-cols-[minmax(0,1.18fr)_minmax(276px,0.82fr)] lg:gap-12">
              <div className="max-w-2xl">
                <h1 className="text-[1.72rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink sm:text-5xl lg:text-[3.85rem] lg:leading-[1.02] xl:text-[4.25rem]">
                  {HOMEPAGE_HEADLINE}
                </h1>

                <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-secondary sm:mt-4 sm:text-lg lg:text-xl">
                  Upload a clip, style your captions, and export.
                </p>

                <div className="mt-3.5 flex flex-wrap items-center gap-2.5 sm:mt-6 sm:gap-3.5">
                  {user ? (
                    <Link
                      href="/upload"
                      prefetch={false}
                      data-testid="home-upload-cta"
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-page shadow-[0_10px_32px_rgba(167,139,250,0.32)] transition hover:bg-accent-hover sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-base"
                    >
                      <Upload className="h-4 w-4 shrink-0" />
                      <span>Upload a clip</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>
                  ) : (
                    <a
                      href="/upload"
                      data-testid="home-upload-cta"
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-page shadow-[0_10px_32px_rgba(167,139,250,0.32)] transition hover:bg-accent-hover sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-base"
                    >
                      <Upload className="h-4 w-4 shrink-0" />
                      <span>Upload a clip</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </a>
                  )}
                  <Link
                    href="/studio"
                    data-testid="home-sample-cta"
                    className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-page/80 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-accent/55 hover:text-accent-hover sm:px-5 sm:py-3.5 sm:text-base"
                  >
                    <Play className="h-4 w-4 shrink-0 fill-current" />
                    <span>Try a sample</span>
                  </Link>
                </div>

                {/* Desktop quick proof points integrated into the hero composition */}
                <dl className="mt-8 hidden grid-cols-3 gap-4 border-t border-ink/10 pt-6 lg:grid">
                  <div>
                    <dt className="text-xs font-semibold text-ink">
                      Word-accurate sync
                    </dt>
                    <dd className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      Edit cues, split at the playhead, or tweak single words.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ink">
                      Reusable presets
                    </dt>
                    <dd className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      Save fonts, colors, outlines, and safe-area placement.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ink">
                      Three studio outputs
                    </dt>
                    <dd className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      Burned-in video, subtitle files, or transparent overlays.
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex justify-center lg:justify-end">
                <HomeHeroDemo />
              </div>
            </div>
          </div>
        </section>

        {/* Upload -> Edit -> Export Workflow (with practical file limits) */}
        <section
          id="workflow"
          className="border-t border-ink/8 bg-inset/60 py-11 lg:py-14"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  From raw clip to finished export in three steps
                </h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  Supports MP4, MOV, MP3, and WAV files up to 150 MB and 3
                  minutes per clip.
                </p>
              </div>
              <Link
                href="/upload"
                prefetch={false}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition hover:text-accent-hover"
              >
                <span>Start with your clip</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-ink/10 bg-panel p-5">
                <div className="flex items-center gap-2.5 text-sm font-bold text-ink">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft text-accent">
                    <Upload className="h-3.5 w-3.5" />
                  </span>
                  <span>1. Upload video or audio</span>
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-ink-secondary">
                  Private resumable TUS uploads handle connection drops cleanly
                  while the worker normalizes upright H.264/MP3 previews and
                  aligns word timestamps.
                </p>
                <div className="mt-3.5 flex flex-wrap gap-1.5 font-mono text-[11px] text-ink-secondary">
                  <span className="rounded-md bg-elevated px-2 py-0.5">MP4</span>
                  <span className="rounded-md bg-elevated px-2 py-0.5">MOV</span>
                  <span className="rounded-md bg-elevated px-2 py-0.5">MP3</span>
                  <span className="rounded-md bg-elevated px-2 py-0.5">WAV</span>
                  <span className="rounded-md border border-ink/10 px-2 py-0.5 text-ink-muted">
                    ≤ 150 MB · ≤ 3 min
                  </span>
                </div>
              </article>

              <article className="rounded-2xl border border-ink/10 bg-panel p-5">
                <div className="flex items-center gap-2.5 text-sm font-bold text-ink">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft text-accent">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </span>
                  <span>2. Refine transcript &amp; style</span>
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-ink-secondary">
                  Edit cue text directly, reveal individual timed words when
                  needed, drag cue edges against the real audio waveform, and
                  check Reels/Shorts safe areas.
                </p>
                <div className="mt-3.5 flex flex-wrap gap-1.5 font-mono text-[11px] text-ink-secondary">
                  <span className="rounded-md bg-elevated px-2 py-0.5">
                    Split &amp; Merge
                  </span>
                  <span className="rounded-md bg-elevated px-2 py-0.5">
                    Audio Waveform
                  </span>
                  <span className="rounded-md bg-accent-soft px-2 py-0.5 text-accent-hover">
                    Brand Presets
                  </span>
                </div>
              </article>

              <article className="rounded-2xl border border-ink/10 bg-panel p-5">
                <div className="flex items-center gap-2.5 text-sm font-bold text-ink">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft text-accent">
                    <Download className="h-3.5 w-3.5" />
                  </span>
                  <span>3. Export pinned revisions</span>
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-ink-secondary">
                  Every export binds to a specific saved caption revision with
                  the applied style copied by value, so later tweaks never alter
                  earlier renders.
                </p>
                <div className="mt-3.5 flex flex-wrap gap-1.5 font-mono text-[11px] text-ink-secondary">
                  <span className="rounded-md bg-elevated px-2 py-0.5">
                    Immutable Revs
                  </span>
                  <span className="rounded-md bg-elevated px-2 py-0.5">
                    Matched Fonts
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Export Formats Section (with codec details where they belong) */}
        <section id="exports" className="border-t border-ink/8 py-11 lg:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  Export formats built for posting and NLE timelines
                </h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  Download a free UTF-8 SRT in Sample Studio without signing in,
                  or sign in to render MP4 and transparent MOV.
                </p>
              </div>
              <Link
                href="/studio"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition hover:text-accent-hover"
              >
                <span>Open Sample Studio</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                      <Film className="h-4 w-4 text-accent" />
                      <span>Burned-in MP4</span>
                    </span>
                    <span className="rounded-md border border-ink/10 bg-elevated px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                      H.264 / AAC
                    </span>
                  </div>

                  <div className="mt-3.5 flex h-24 items-center justify-center rounded-xl border border-ink/10 bg-gradient-to-b from-[#1A1530] via-[#11121F] to-page px-3">
                    <p
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className="flex flex-wrap items-center justify-center gap-1 text-center text-xs font-extrabold uppercase"
                    >
                      <span className="rounded bg-page/70 px-1.5 py-0.5 text-ink">
                        READY
                      </span>
                      <span className="rounded bg-accent px-1.5 py-0.5 text-page">
                        TO
                      </span>
                      <span className="rounded bg-page/70 px-1.5 py-0.5 text-ink">
                        POST
                      </span>
                    </p>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                    Preserves source aspect ratio and AAC audio for Reels,
                    Shorts, and TikTok — or renders a 9:16 stage for audio-only
                    clips.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                      <FileText className="h-4 w-4 text-accent" />
                      <span>UTF-8 SRT Subtitles</span>
                    </span>
                    <span className="rounded-md border border-ink/10 bg-elevated px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                      .srt
                    </span>
                  </div>

                  <pre className="mt-3.5 h-24 overflow-hidden rounded-xl border border-ink/10 bg-page p-2.5 font-mono text-[11px] leading-relaxed text-ink-secondary">
{`1
00:00:00,350 --> 00:00:02,830
Great short-form clips hook
viewers in two seconds.`}
                  </pre>

                  <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                    Deterministic millisecond timestamps, multiline cues, and
                    clean silence gaps for YouTube, LinkedIn, or NLE caption
                    tracks.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                      <Layers className="h-4 w-4 text-accent" />
                      <span>Transparent MOV</span>
                    </span>
                    <span className="rounded-md border border-accent/35 bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent-hover">
                      ProRes 4444 Alpha
                    </span>
                  </div>

                  <div className="alpha-checkerboard mt-3.5 flex h-24 items-center justify-center rounded-xl border border-ink/10 px-3">
                    <div
                      style={{ fontFamily: '"DM Serif Display", serif' }}
                      className="rounded-lg border border-ink/15 bg-page/90 px-3 py-1.5 text-center text-sm text-ink"
                    >
                      Keep <span className="text-accent underline">your</span>{" "}
                      style.
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                    Captions-only{" "}
                    <code className="font-mono text-ink">yuva444p10le</code>{" "}
                    overlay with real alpha and silent transparent gaps for
                    Premiere Pro, DaVinci Resolve, or Final Cut.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/8 bg-page py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-ink-muted sm:px-6 lg:px-8">
          <ClipCaptionsLockup markSize={24} compact />
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-4"
          >
            <Link href="/studio" className="transition hover:text-ink">
              Sample Studio
            </Link>
            <a href="/upload" className="transition hover:text-ink">
              Upload a clip
            </a>
            <a href="/projects" className="transition hover:text-ink">
              Projects
            </a>
            <a href="/login" className="transition hover:text-ink">
              Sign in
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
