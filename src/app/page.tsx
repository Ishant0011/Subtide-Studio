import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Film,
  Layers,
  Play,
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

      <PublicHeader userEmail={user?.email ?? null} />

      <main className="relative z-10">
        {/* Open Hero Composition directly on deep charcoal canvas */}
        <section
          data-testid="home-open-hero"
          className="mx-auto max-w-6xl px-4 pb-8 pt-3 sm:px-6 sm:pb-14 sm:pt-8 lg:px-8 lg:pb-16 lg:pt-10"
        >
          <div className="grid grid-cols-1 items-center gap-4 sm:gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] lg:gap-14">
            <div className="max-w-xl">
              <h1 className="text-[1.68rem] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink sm:text-5xl lg:text-[3.75rem] lg:leading-[1.03] xl:text-[4.15rem]">
                {HOMEPAGE_HEADLINE}
              </h1>

              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-secondary sm:mt-4 sm:text-lg lg:text-xl">
                Upload a clip, style your captions, and export.
              </p>

              <div className="mt-3.5 flex flex-wrap items-center gap-2.5 sm:mt-7 sm:gap-3.5">
                {user ? (
                  <Link
                    href="/upload"
                    prefetch={false}
                    data-testid="home-upload-cta"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-page shadow-[0_12px_28px_rgba(0,0,0,0.4)] transition hover:bg-accent-hover sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-base"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span>Upload a clip</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                ) : (
                  <a
                    href="/upload"
                    data-testid="home-upload-cta"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-page shadow-[0_12px_28px_rgba(0,0,0,0.4)] transition hover:bg-accent-hover sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-base"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span>Upload a clip</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </a>
                )}

                <Link
                  href="/studio"
                  data-testid="home-sample-cta"
                  className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-panel px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-elevated sm:px-5 sm:py-3.5 sm:text-base"
                >
                  <Play className="h-4 w-4 shrink-0 fill-current" />
                  <span>Try a sample</span>
                </Link>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <HomeHeroDemo />
            </div>
          </div>
        </section>

        {/* Real Product Views: Upload -> Edit -> Export */}
        <section
          id="workflow"
          className="border-t border-ink/10 bg-inset/55 py-12 lg:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  Upload, edit, and export in one calm workspace
                </h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  Supports MP4, MOV, MP3, and WAV files up to 150 MB and 3
                  minutes per clip.
                </p>
              </div>
              <a
                href="/upload"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink transition hover:text-accent-hover"
              >
                <span>Start with your clip</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div
              data-testid="workflow-product-views"
              className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-3"
            >
              {/* Step 1: Real Upload Status View */}
              <article className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                    <span>Step 1 · Upload</span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      ≤ 150 MB · ≤ 3 min
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-ink">
                    Private transfer and automatic transcription
                  </h3>

                  {/* Real Product UI Snapshot: Upload -> Ready */}
                  <div className="mt-4 rounded-xl border border-ink/10 bg-inset p-3.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="truncate font-semibold text-ink">
                        founder-take-04.mp4
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-panel px-2 py-0.5 font-medium text-ink">
                        <CheckCircle2 className="h-3 w-3 text-accent" />
                        <span>Ready</span>
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-medium text-ink-muted">
                      <span className="text-ink-secondary">Uploading</span>
                      <span>→</span>
                      <span className="text-ink-secondary">Processing</span>
                      <span>→</span>
                      <span className="font-semibold text-ink">Ready</span>
                    </div>

                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-track">
                      <div className="h-full w-full rounded-full bg-accent" />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-ink-muted">
                        24.8 MB · Word timestamps ready
                      </span>
                      <span className="rounded-lg bg-accent px-2.5 py-1 text-[10px] font-semibold text-page">
                        Open editor
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                  Resumable TUS transfers verify file size before queuing worker
                  transcription, then surface Open editor as soon as captions
                  finish.
                </p>
              </article>

              {/* Step 2: Real Transcript + Preset Gallery View */}
              <article className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                    <span>Step 2 · Edit &amp; Style</span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      12 presets · Timeline
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-ink">
                    Follow playback, fix words, and switch styles
                  </h3>

                  {/* Real Product UI Snapshot: Editor Transcript + Presets */}
                  <div className="mt-4 space-y-2 rounded-xl border border-ink/10 bg-inset p-3">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-ink">Transcript</span>
                      <span className="rounded-md border border-ink/15 bg-panel px-1.5 py-0.5 font-medium text-ink">
                        Follow playback · On
                      </span>
                    </div>

                    <div className="rounded-lg border border-ink/10 bg-panel px-2.5 py-1.5 text-[11px]">
                      <div className="flex items-center justify-between font-mono text-[10px] text-ink-muted">
                        <span>0:00.3</span>
                        <span className="text-ink-secondary">Playing</span>
                      </div>
                      <p className="mt-0.5 truncate text-ink">
                        Great short-form clips hook viewers in two seconds.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-center text-[10px] font-semibold">
                      <span className="rounded-md border border-accent bg-accent/15 py-1 text-ink">
                        Highlight
                      </span>
                      <span className="rounded-md border border-ink/10 bg-panel py-1 text-ink-secondary">
                        Broadcast
                      </span>
                      <span className="rounded-md border border-ink/10 bg-panel py-1 text-ink-secondary">
                        Lower Third
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                  Correct lines inline, inspect individual word timings or the
                  real audio waveform when needed, and preview Clean, Creator,
                  Bold, and Editorial styles live.
                </p>
              </article>

              {/* Step 3: Real Pinned Export View */}
              <article className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                    <span>Step 3 · Export</span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      Pinned revisions
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-ink">
                    Download burned-in video, SRT, or alpha MOV
                  </h3>

                  {/* Real Product UI Snapshot: Export Drawer */}
                  <div className="mt-4 space-y-1.5 rounded-xl border border-ink/10 bg-inset p-3 text-[11px]">
                    <div className="flex items-center justify-between text-[10px] text-ink-muted">
                      <span>Revision #3</span>
                      <span className="font-mono">Style copied by value</span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-panel px-2.5 py-1.5">
                      <span className="font-medium text-ink">Burned-in MP4</span>
                      <span className="font-mono text-[10px] text-ink-secondary">
                        H.264 / AAC
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-panel px-2.5 py-1.5">
                      <span className="font-medium text-ink">Subtitles</span>
                      <span className="font-mono text-[10px] text-ink-secondary">
                        UTF-8 .SRT
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-panel px-2.5 py-1.5">
                      <span className="font-medium text-ink">
                        Transparent MOV
                      </span>
                      <span className="font-mono text-[10px] text-ink-secondary">
                        ProRes 4444
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3.5 text-xs leading-relaxed text-ink-secondary">
                  Every render locks onto the exact saved revision and caption
                  style, keeping earlier downloads untouched while you continue
                  editing.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Export Formats Section */}
        <section id="exports" className="border-t border-ink/10 py-12 lg:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
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
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink transition hover:text-accent-hover"
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
                      <Film className="h-4 w-4 text-ink-secondary" />
                      <span>Burned-in MP4</span>
                    </span>
                    <span className="rounded-md border border-ink/12 bg-elevated px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                      H.264 / AAC
                    </span>
                  </div>

                  <div className="mt-3.5 flex h-24 items-center justify-center rounded-xl border border-ink/10 bg-inset px-3">
                    <p
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className="flex flex-wrap items-center justify-center gap-1 text-center text-xs font-extrabold uppercase"
                    >
                      <span className="rounded bg-panel px-1.5 py-0.5 text-ink">
                        READY
                      </span>
                      <span className="rounded bg-accent px-1.5 py-0.5 text-page">
                        TO
                      </span>
                      <span className="rounded bg-panel px-1.5 py-0.5 text-ink">
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
                      <FileText className="h-4 w-4 text-ink-secondary" />
                      <span>UTF-8 SRT Subtitles</span>
                    </span>
                    <span className="rounded-md border border-ink/12 bg-elevated px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                      .srt
                    </span>
                  </div>

                  <pre className="mt-3.5 h-24 overflow-hidden rounded-xl border border-ink/10 bg-inset p-2.5 font-mono text-[11px] leading-relaxed text-ink-secondary">
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
                      <Layers className="h-4 w-4 text-ink-secondary" />
                      <span>Transparent MOV</span>
                    </span>
                    <span className="rounded-md border border-ink/12 bg-elevated px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
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

      <footer className="border-t border-ink/10 bg-page py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-ink-muted sm:px-6 lg:px-8">
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
