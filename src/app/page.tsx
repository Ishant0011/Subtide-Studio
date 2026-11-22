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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />

      {/* Subtle violet studio glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 right-1/4 h-[460px] w-[780px] translate-x-1/4 rounded-full bg-accent/12 blur-[150px]"
      />

      <PublicHeader userEmail={user?.email ?? null} />

      <main className="relative z-10">
        {/* Hero Section: Playable Demo Centerpiece */}
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:pb-16 lg:pt-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            {/* Editorial Headline & Primary Actions */}
            <div>
              <h1 className="text-4xl font-extrabold leading-[1.04] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.65rem]">
                {HOMEPAGE_HEADLINE}
              </h1>

              <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-secondary sm:text-lg">
                Upload a video or audio clip, tighten word-level cues on a real
                timeline, and export burned-in MP4, UTF-8 SRT, or transparent
                ProRes 4444 overlays.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/upload"
                  data-testid="home-upload-cta"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-page shadow-[0_10px_32px_rgba(167,139,250,0.3)] transition hover:bg-accent-hover"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload a clip</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/studio"
                  data-testid="home-sample-cta"
                  className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-panel px-5 py-3.5 text-sm font-semibold text-ink transition hover:border-accent/55 hover:text-accent-hover"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Try a sample</span>
                </Link>
              </div>

              <p className="mt-6 text-xs text-ink-muted">
                MP4, MOV, MP3 &amp; WAV up to 150 MB / 3 min · Play the live
                demo and switch presets without signing in.
              </p>
            </div>

            {/* Playable Interactive Portrait Demo (Main Attraction) */}
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
                Built around a real caption workflow.
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

                  {/* Product UI visual: upload dropzone + progress */}
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
                    Private resumable uploads recover from drops while the
                    worker normalizes your preview and generates word-level
                    timestamps.
                  </p>
                </div>
              </article>

              {/* Step 2: Edit Visual */}
              <article className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                      <SlidersHorizontal className="h-4 w-4 text-accent" />
                      <span>2. Edit</span>
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      Timeline + Inspector
                    </span>
                  </div>

                  {/* Product UI visual: zoomed timeline + draggable cue handles */}
                  <div
                    aria-hidden="true"
                    className="mt-4 rounded-xl border border-ink/10 bg-page p-3.5"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] text-ink-muted">
                      <span>0:00</span>
                      <span>0:03</span>
                      <span>0:06</span>
                      <span>0:09</span>
                    </div>
                    <div className="relative mt-1.5 flex h-9 items-center gap-1.5 rounded-lg bg-inset px-1.5">
                      <div className="flex h-6 w-[38%] items-center justify-between rounded border border-ink/15 bg-elevated px-1.5 text-[10px] text-ink-secondary">
                        <span className="truncate">#1 Hook</span>
                      </div>
                      <div className="flex h-6 w-[44%] items-center justify-between rounded border border-accent bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-hover">
                        <span className="h-3.5 w-1 rounded-full bg-accent" />
                        <span className="truncate">#2 Sound off</span>
                        <span className="h-3.5 w-1 rounded-full bg-accent" />
                      </div>
                      <span className="absolute bottom-0 left-[54%] top-0 w-0.5 bg-accent shadow-[0_0_8px_#A78BFA]" />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-ink-secondary">
                      <span>Search · Undo / Redo</span>
                      <span className="text-accent-hover">Autosaved</span>
                    </div>
                  </div>

                  <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                    Drag cue boundaries on a zoomable timeline, search
                    transcripts, undo edits, and style Clean, Boxed, or Word
                    Highlight presets.
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
                      Saved Rev #3
                    </span>
                  </div>

                  {/* Product UI visual: pinned export rows */}
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
                    Every export pins to a saved caption revision and renders on
                    the worker with private short-lived download links.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Export Outputs Visual Showcase */}
        <section id="exports" className="border-t border-ink/8 py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Three production outputs from one revision.
              </h2>
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition hover:text-accent-hover"
              >
                <span>Start a project</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* MP4 Card */}
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

                  <div className="mt-4 flex h-28 flex-col justify-end rounded-xl border border-ink/10 bg-gradient-to-b from-[#1A1530] via-[#11121F] to-page p-3">
                    <p className="flex flex-wrap items-center justify-center gap-1 text-center text-xs font-extrabold uppercase">
                      <span className="rounded bg-page/60 px-1.5 py-0.5 text-ink">
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
                    Burned-in captions preserving source aspect ratio and AAC
                    audio, plus a 9:16 stage for audio-only uploads.
                  </p>
                </div>
              </div>

              {/* SRT Card */}
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

                  <pre className="mt-4 h-28 overflow-hidden rounded-xl border border-ink/10 bg-page p-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
{`1
00:00:00,400 --> 00:00:03,100
Great short-form clips
hook viewers in two seconds.`}
                  </pre>

                  <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                    Deterministic UTF-8 SubRip with exact millisecond timing,
                    multiline cues, Unicode text, and silence gaps preserved.
                  </p>
                </div>
              </div>

              {/* Transparent MOV Card */}
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

                  <div className="alpha-checkerboard mt-4 flex h-28 flex-col justify-between rounded-xl border border-ink/10 p-3">
                    <span className="self-start rounded-full border border-ink/15 bg-page/80 px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                      Real alpha · No audio
                    </span>
                    <div className="mx-auto rounded-lg border border-ink/15 bg-page/85 px-3 py-1.5 text-center text-xs font-semibold text-ink">
                      Keep{" "}
                      <span className="text-accent underline">your</span>{" "}
                      style.
                    </div>
                  </div>

                  <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                    Captions-only ProRes 4444 with clean transparent gaps ready
                    to composite in Premiere, DaVinci, or Final Cut.
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
