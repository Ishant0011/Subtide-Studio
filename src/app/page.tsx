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

      {/* Subtle violet studio glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 right-1/4 h-[460px] w-[780px] translate-x-1/4 rounded-full bg-accent/12 blur-[150px]"
      />

      <PublicHeader userEmail={user?.email ?? null} />

      <main className="relative z-10">
        {/* Hero Section: Synchronized Before / After Playable Demo */}
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:pb-16 lg:pt-8">
          <div className="grid grid-cols-1 items-center gap-5 sm:gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div>
              <h1 className="text-[1.85rem] font-extrabold leading-[1.06] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.6rem] lg:leading-[1.04]">
                {HOMEPAGE_HEADLINE}
              </h1>

              <p className="mt-2.5 max-w-md text-sm leading-relaxed text-ink-secondary sm:mt-4 sm:text-lg">
                Upload a clip, style your captions, and export.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:mt-7 sm:gap-3">
                <Link
                  href="/upload"
                  data-testid="home-upload-cta"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-page shadow-[0_10px_32px_rgba(167,139,250,0.3)] transition hover:bg-accent-hover sm:gap-2.5 sm:px-6 sm:py-3.5"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload a clip</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/studio"
                  data-testid="home-sample-cta"
                  className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-panel px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-accent/55 hover:text-accent-hover sm:px-5 sm:py-3.5"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Try a sample</span>
                </Link>
              </div>
            </div>

            {/* Synchronized Before / After Interactive Demo */}
            <div className="flex justify-center lg:justify-end">
              <HomeHeroDemo />
            </div>
          </div>
        </section>

        {/* Product Visual Walkthrough: Upload -> Edit -> Export */}
        <section
          id="workflow"
          className="border-t border-ink/8 bg-inset/80 py-16 lg:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-accent">
                Upload → Edit → Export
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Built for fast creator turnarounds.
              </h2>
            </div>

            <div className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Step 1: Upload Visual */}
              <article className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                      <Upload className="h-4 w-4 text-accent" />
                      <span>1. Upload</span>
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      Resumable TUS
                    </span>
                  </div>

                  <div
                    aria-hidden="true"
                    className="mt-4 rounded-xl border border-ink/10 bg-page p-3.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="truncate font-medium text-ink">
                        launch-reel-9x16.mp4
                      </span>
                      <span className="font-mono font-semibold text-accent">
                        72%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-track">
                      <div className="h-full w-[72%] rounded-full bg-accent" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px] text-ink-secondary">
                      <span className="rounded bg-elevated px-1.5 py-0.5">
                        MP4
                      </span>
                      <span className="rounded bg-elevated px-1.5 py-0.5">
                        MOV
                      </span>
                      <span className="rounded bg-elevated px-1.5 py-0.5">
                        MP3
                      </span>
                      <span className="rounded bg-elevated px-1.5 py-0.5">
                        WAV
                      </span>
                    </div>
                  </div>

                  <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                    Upload MP4, MOV, MP3, or WAV up to 150 MB and 3 minutes.
                    Private resumable uploads recover from drops while the
                    worker normalizes your preview and aligns word timestamps.
                  </p>
                </div>
              </article>

              {/* Step 2: Edit & Style Visual */}
              <article className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                      <SlidersHorizontal className="h-4 w-4 text-accent" />
                      <span>2. Correct &amp; Style</span>
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      Timeline + Presets
                    </span>
                  </div>

                  <div
                    aria-hidden="true"
                    className="mt-4 rounded-xl border border-ink/10 bg-page p-3.5"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] text-ink-muted">
                      <span>Split · Merge · Word Edit</span>
                      <span className="text-accent-hover">Safe Guide</span>
                    </div>
                    <div className="relative mt-2 flex h-9 items-center gap-1.5 rounded-lg bg-inset px-1.5">
                      <div className="flex h-6 w-[38%] items-center justify-between rounded border border-ink/15 bg-elevated px-1.5 text-[10px] text-ink-secondary">
                        <span className="truncate">#1 Hook</span>
                      </div>
                      <div className="flex h-6 w-[46%] items-center justify-between rounded border border-accent bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-hover">
                        <span className="h-3.5 w-1 rounded-full bg-accent" />
                        <span className="truncate">#2 Sound off</span>
                        <span className="h-3.5 w-1 rounded-full bg-accent" />
                      </div>
                      <span className="absolute bottom-0 left-[54%] top-0 w-0.5 bg-accent shadow-[0_0_8px_#A78BFA]" />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-ink-secondary">
                      <span>Poppins · Bebas · DM Serif</span>
                      <span className="text-accent-hover">Saved preset</span>
                    </div>
                  </div>

                  <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                    Split at the playhead, merge cues, fix single timed words,
                    preview safe areas, and reuse your own saved brand presets.
                  </p>
                </div>
              </article>

              {/* Step 3: Export Visual */}
              <article className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                      <Download className="h-4 w-4 text-accent" />
                      <span>3. Export</span>
                    </span>
                    <span className="rounded-full border border-accent/35 bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-accent-hover">
                      Pinned Rev #3
                    </span>
                  </div>

                  <div
                    aria-hidden="true"
                    className="mt-4 space-y-1.5 rounded-xl border border-ink/10 bg-page p-3"
                  >
                    {[
                      { label: "MP4 to post", meta: "H.264 / AAC" },
                      { label: "SRT subtitles", meta: "UTF-8 .srt" },
                      { label: "Transparent MOV", meta: "ProRes 4444" },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between rounded-lg bg-panel px-2.5 py-1.5 text-[11px]"
                      >
                        <span className="font-medium text-ink">
                          {row.label}
                        </span>
                        <span className="font-mono text-[10px] text-accent-hover">
                          {row.meta}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                    Every export stores your applied style by value on an
                    immutable revision so later edits never alter earlier files.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Real Export Format Examples */}
        <section id="exports" className="border-t border-ink/8 py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  Three production outputs, one saved revision.
                </h2>
                <p className="mt-1.5 text-sm text-ink-secondary">
                  Export burned-in MP4, deterministic UTF-8 SRT, or transparent
                  ProRes 4444 MOV — or edit the sample and download a free SRT
                  without signing in.
                </p>
              </div>
              <Link
                href="/studio"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition hover:text-accent-hover"
              >
                <span>Edit sample &amp; download SRT</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* MP4 Real Example */}
              <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                      <Film className="h-4 w-4 text-accent" />
                      <span>MP4 to post</span>
                    </span>
                    <span className="rounded-md border border-ink/10 bg-elevated px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                      H.264 / AAC
                    </span>
                  </div>

                  <div className="mt-4 flex h-32 flex-col justify-between rounded-xl border border-ink/10 bg-gradient-to-b from-[#1A1530] via-[#11121F] to-page p-3">
                    <div className="flex items-center justify-between font-mono text-[10px] text-ink-muted">
                      <span>launch-hook-rev3.mp4</span>
                      <span>720×1280 · 30fps</span>
                    </div>
                    <p
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className="flex flex-wrap items-center justify-center gap-1 text-center text-xs font-extrabold uppercase"
                    >
                      <span className="rounded bg-page/65 px-1.5 py-0.5 text-ink">
                        HOOK
                      </span>
                      <span className="rounded bg-accent px-1.5 py-0.5 text-page">
                        VIEWERS
                      </span>
                      <span className="rounded bg-page/50 px-1.5 py-0.5 text-ink/80">
                        FAST
                      </span>
                    </p>
                  </div>

                  <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                    Ready for Reels, Shorts, and TikTok with burned-in styling,
                    preserved source aspect ratio and AAC audio, or a 9:16 stage
                    for audio-only clips.
                  </p>
                </div>
              </div>

              {/* SRT Real Example */}
              <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                      <FileText className="h-4 w-4 text-accent" />
                      <span>SRT for subtitles</span>
                    </span>
                    <span className="rounded-md border border-ink/10 bg-elevated px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                      UTF-8 .srt
                    </span>
                  </div>

                  <pre className="mt-4 h-32 overflow-hidden rounded-xl border border-ink/10 bg-page p-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
{`1
00:00:00,350 --> 00:00:02,830
Great short-form clips hook
viewers in two seconds.

2
00:00:03,150 --> 00:00:05,080`}
                  </pre>

                  <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                    Deterministic UTF-8 SubRip with exact millisecond timestamps,
                    multiline cues, Unicode characters, and silence gaps for
                    YouTube, LinkedIn, or NLE import.
                  </p>
                </div>
              </div>

              {/* Transparent MOV Real Example */}
              <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                      <Layers className="h-4 w-4 text-accent" />
                      <span>Transparent MOV</span>
                    </span>
                    <span className="rounded-md border border-accent/35 bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent-hover">
                      ProRes 4444
                    </span>
                  </div>

                  <div className="alpha-checkerboard mt-4 flex h-32 flex-col justify-between rounded-xl border border-ink/10 p-3">
                    <div className="flex items-center justify-between font-mono text-[10px] text-ink-secondary">
                      <span className="rounded-full border border-ink/15 bg-page/85 px-2 py-0.5">
                        yuva444p10le · No audio
                      </span>
                      <span className="rounded bg-page/80 px-1.5 py-0.5 text-accent-hover">
                        Alpha
                      </span>
                    </div>
                    <div
                      style={{ fontFamily: '"DM Serif Display", serif' }}
                      className="mx-auto rounded-lg border border-ink/15 bg-page/88 px-3 py-1.5 text-center text-sm text-ink"
                    >
                      Keep{" "}
                      <span className="text-accent underline">your</span>{" "}
                      style.
                    </div>
                  </div>

                  <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                    Captions-only Apple ProRes 4444 with real alpha transparency
                    and clean transparent gaps ready to layer over timelines in
                    Premiere, DaVinci, or Final Cut.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-ink/8 bg-page py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-ink-muted sm:px-6">
          <ClipCaptionsLockup markSize={26} compact />
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-4"
          >
            <Link href="/studio" className="transition hover:text-ink">
              Sample Studio
            </Link>
            <Link href="/upload" className="transition hover:text-ink">
              Upload a clip
            </Link>
            <Link href="/projects" className="transition hover:text-ink">
              Projects
            </Link>
            <Link href="/login" className="transition hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
