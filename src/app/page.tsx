import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  FileText,
  Film,
  Layers,
  LocateFixed,
  Play,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from "lucide-react";
import { ClipCaptionsLockup } from "@/components/ClipCaptionsLogo";
import { HomeHeroDemo } from "@/components/HomeHeroDemo";
import { HomeStyleGallery } from "@/components/HomeStyleGallery";
import { PublicHeader } from "@/components/PublicHeader";
import { SAMPLE_CLIP } from "@/lib/captions";
import {
  HOMEPAGE_HEADLINE,
  HOMEPAGE_SUBHEADLINE,
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

const FAQ_ITEMS = [
  {
    q: "Can I try ClipCaptions without creating an account?",
    a: "Yes. You can play the demo right on this page or open Sample Studio to edit transcript lines, test all 12 caption styles, and download a UTF-8 .srt file with no account required.",
  },
  {
    q: "What file formats and limits are supported?",
    a: "Private uploads accept MP4, MOV, MP3, and WAV files up to 150 MB and 3 minutes per clip. Transfers use resumable TUS uploads so flaky connections can pause and resume cleanly.",
  },
  {
    q: "Which export formats can I download?",
    a: "Signed-in projects export revision-pinned Burned-in MP4 (H.264/AAC), UTF-8 SRT subtitles, and Transparent MOV (ProRes 4444 alpha overlay with no audio track for NLE timelines).",
  },
  {
    q: "Can I save my own brand caption style?",
    a: "Yes. Signed-in accounts can customize font, size, highlight color, alignment, emphasis, and vertical position, then save reusable personal presets for future clips.",
  },
] as const;

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
        {/* OPEN HERO COMPOSITION: Copy + CTAs + Soft Lavender Playable Demo Stage */}
        <section
          data-testid="home-open-hero"
          className="mx-auto max-w-6xl px-4 pb-8 pt-3 sm:px-6 sm:pb-12 sm:pt-7 lg:px-8 lg:pb-14 lg:pt-8"
        >
          <div className="grid grid-cols-1 items-center gap-4 sm:gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:gap-12">
            <div className="max-w-xl">
              <h1 className="text-[2rem] font-extrabold leading-[1.03] tracking-[-0.04em] text-ink sm:text-5xl lg:text-[4.15rem] lg:leading-[0.98] xl:text-[4.65rem]">
                {HOMEPAGE_HEADLINE}
              </h1>

              <p
                data-testid="home-hero-subcopy"
                className="mt-2 max-w-lg text-sm leading-relaxed text-ink-secondary sm:mt-4 sm:text-lg lg:text-[1.2rem] lg:leading-relaxed"
              >
                {HOMEPAGE_SUBHEADLINE}
              </p>

              <div className="mt-3.5 flex flex-wrap items-center gap-2.5 sm:mt-7 sm:gap-3.5">
                {user ? (
                  <Link
                    href="/upload"
                    prefetch={false}
                    data-testid="home-upload-cta"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-page transition hover:bg-accent-hover sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-base"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span>Upload a clip</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                ) : (
                  <a
                    href="/upload"
                    data-testid="home-upload-cta"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-page transition hover:bg-accent-hover sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-base"
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

        {/* SECTION 1: Compact Interactive Style Gallery on the Same Clip */}
        <section
          id="styles"
          className="border-t border-ink/10 bg-inset/50 py-12 lg:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                Compare caption styles on the same clip
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                Switch between four distinct looks right here — from punchy
                word highlights to steady broadcast bars and left-aligned lower
                thirds.
              </p>
            </div>

            <HomeStyleGallery />
          </div>
        </section>

        {/* SECTION 2: Large Real Editor Preview + Plain-Language Upload -> Edit -> Export */}
        <section id="workflow" className="border-t border-ink/10 py-12 lg:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="max-w-2xl">
                <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  One calm workspace for transcript, video, and style
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                  Fix words on the left, judge timing on the video in the
                  center, and pick your look on the right — with a dedicated
                  waveform timeline one click away when you want fine trims.
                </p>
              </div>
              <Link
                href="/studio"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink transition hover:text-accent-hover"
              >
                <span>Open live sample editor</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Large Real Editor Preview */}
            <div
              data-testid="home-editor-preview"
              aria-label="Preview of the ClipCaptions three-column editor"
              className="mt-7 overflow-hidden rounded-2xl border border-ink/12 bg-panel shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
            >
              {/* Editor Top Bar */}
              <div className="flex items-center justify-between gap-3 border-b border-ink/10 bg-inset px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-lg border border-ink/12 bg-panel px-2.5 py-1 text-[11px] text-ink-secondary">
                    Projects
                  </span>
                  <span className="font-semibold text-ink">
                    creator-hook-take-02.mp4
                  </span>
                  <span className="hidden rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-ink-muted sm:inline">
                    Rev #2 · 9:16
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden text-[11px] text-ink-secondary sm:inline">
                    Saved
                  </span>
                  <span className="rounded-lg bg-accent px-3 py-1 text-[11px] font-semibold text-page">
                    Export
                  </span>
                </div>
              </div>

              {/* 3-Column Editor Interior: Transcript | Video | Appearance */}
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_224px_minmax(0,1fr)] lg:p-5">
                {/* Left: Transcript Pane */}
                <div className="flex flex-col rounded-xl border border-ink/10 bg-inset p-3.5">
                  <div className="flex items-center justify-between gap-2 pb-2.5">
                    <span className="text-xs font-semibold text-ink">
                      Transcript
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md border border-accent/45 bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-hover">
                        <LocateFixed className="h-3 w-3" />
                        <span>Follow playback</span>
                      </span>
                      <span className="rounded-md border border-ink/12 bg-panel px-2 py-0.5 text-[10px] font-medium text-ink-secondary">
                        Timeline
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="rounded-lg border border-accent bg-panel p-2.5">
                      <div className="flex items-center justify-between font-mono text-[10px] text-ink-secondary">
                        <span>#1 · 0:00.3 – 0:02.8</span>
                        <span className="text-accent-hover">Playing</span>
                      </div>
                      <p className="mt-1.5 rounded-md border border-ink/10 bg-inset px-2 py-1.5 text-xs text-ink">
                        Great short-form clips hook viewers in two seconds.
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-secondary">
                        <span className="rounded border border-ink/12 bg-elevated px-2 py-0.5">
                          Edit words
                        </span>
                        <span className="rounded border border-ink/12 bg-elevated px-2 py-0.5">
                          Timing
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-ink/10 bg-panel/70 px-2.5 py-2">
                      <span className="font-mono text-[10px] text-ink-muted">
                        0:02.9
                      </span>
                      <p className="mt-0.5 text-xs text-ink-secondary">
                        Most people watch with the sound turned off.
                      </p>
                    </div>

                    <div className="rounded-lg border border-ink/10 bg-panel/70 px-2.5 py-2">
                      <span className="font-mono text-[10px] text-ink-muted">
                        0:05.7
                      </span>
                      <p className="mt-0.5 text-xs text-ink-secondary">
                        Crisp timing turns every sentence into momentum.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Center: Video Stage */}
                <div className="mx-auto flex w-full max-w-[224px] flex-col items-center justify-center rounded-xl border border-ink/10 bg-inset p-3">
                  <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-page">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={SAMPLE_CLIP.poster}
                      alt="Talking-head preview inside the ClipCaptions editor"
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-2 bottom-4 flex flex-wrap justify-center gap-1 text-center text-[10px] font-extrabold uppercase">
                      <span className="rounded bg-accent px-1.5 py-0.5 text-page">
                        GREAT
                      </span>
                      <span className="rounded bg-black/70 px-1.5 py-0.5 text-ink">
                        SHORT-FORM
                      </span>
                      <span className="rounded bg-black/70 px-1.5 py-0.5 text-ink">
                        CLIPS
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex w-full items-center gap-2 rounded-lg bg-panel px-2 py-1 text-[10px] font-mono text-ink-secondary">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-accent text-page">
                      <Play className="ml-0.5 h-2.5 w-2.5 fill-current" />
                    </span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-track">
                      <div className="h-full w-1/3 rounded-full bg-accent" />
                    </div>
                    <span>0:00.5</span>
                  </div>
                </div>

                {/* Right: Appearance / Style Panel */}
                <div className="flex flex-col rounded-xl border border-ink/10 bg-inset p-3.5">
                  <div className="flex items-center justify-between gap-2 pb-2.5">
                    <span className="text-xs font-semibold text-ink">
                      Appearance
                    </span>
                    <div className="inline-flex rounded-lg border border-ink/10 bg-panel p-0.5 text-[10px] font-semibold">
                      <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-page">
                        <Sparkles className="h-2.5 w-2.5" />
                        <span>Presets 12</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-ink-secondary">
                        <SlidersHorizontal className="h-2.5 w-2.5" />
                        <span>Style</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg border border-accent bg-accent-soft p-2">
                      <div className="flex h-8 items-center justify-center rounded bg-page text-[10px] font-extrabold uppercase">
                        <span className="text-ink">KEEP</span>
                        <span className="mx-1 rounded bg-accent px-1 text-page">
                          YOUR
                        </span>
                      </div>
                      <p className="mt-1.5 font-semibold text-accent-hover">
                        Keyword Highlight
                      </p>
                    </div>
                    <div className="rounded-lg border border-ink/10 bg-panel p-2">
                      <div className="flex h-8 items-center justify-center rounded bg-page text-[10px] font-semibold text-ink">
                        Keep{" "}
                        <span className="mx-1 underline decoration-accent decoration-2">
                          your
                        </span>{" "}
                        style
                      </div>
                      <p className="mt-1.5 font-medium text-ink">Underline</p>
                    </div>
                    <div className="rounded-lg border border-ink/10 bg-panel p-2">
                      <div className="flex h-8 items-center justify-center rounded bg-page text-[10px] font-semibold text-ink">
                        <span className="rounded bg-inset px-1.5 py-0.5">
                          Keep your style
                        </span>
                      </div>
                      <p className="mt-1.5 font-medium text-ink">Broadcast</p>
                    </div>
                    <div className="rounded-lg border border-ink/10 bg-panel p-2">
                      <div className="flex h-8 items-center justify-start rounded bg-page px-2 font-mono text-[9px] text-ink">
                        <span className="border-l-2 border-accent pl-1.5">
                          KEEP YOUR
                        </span>
                      </div>
                      <p className="mt-1.5 font-medium text-ink">Lower Third</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Plain-Language Upload -> Edit -> Export Steps */}
            <ol
              data-testid="workflow-steps"
              className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3"
            >
              <li className="rounded-2xl border border-ink/10 bg-panel p-5">
                <p className="font-mono text-xs font-semibold text-ink-muted">
                  01 · Upload
                </p>
                <h3 className="mt-1.5 text-base font-bold text-ink">
                  Drop your video or audio clip
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                  Upload MP4, MOV, MP3, or WAV files up to 150 MB and 3 minutes.
                  ClipCaptions generates word-synced captions and opens the
                  editor as soon as processing finishes.
                </p>
              </li>

              <li className="rounded-2xl border border-ink/10 bg-panel p-5">
                <p className="font-mono text-xs font-semibold text-ink-muted">
                  02 · Edit
                </p>
                <h3 className="mt-1.5 text-base font-bold text-ink">
                  Fix words and pick your style
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                  Follow playback as the video runs, correct any line inline,
                  fine-tune boundaries on the audio waveform when needed, and
                  switch between 12 presets or your own saved style.
                </p>
              </li>

              <li className="rounded-2xl border border-ink/10 bg-panel p-5">
                <p className="font-mono text-xs font-semibold text-ink-muted">
                  03 · Export
                </p>
                <h3 className="mt-1.5 text-base font-bold text-ink">
                  Download ready-to-post files
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                  Export a burned-in MP4, a clean UTF-8 SRT file, or a
                  transparent ProRes 4444 MOV overlay. Every export stays pinned
                  to the saved revision you chose.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* SECTION 3: Actual Output Examples (MP4, SRT, Transparent MOV) + Short Verified FAQ */}
        <section
          id="exports"
          className="border-t border-ink/10 bg-inset/50 py-12 lg:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  Three real outputs for social feeds and edit timelines
                </h2>
                <p className="mt-1.5 text-sm text-ink-secondary">
                  Download a free UTF-8 SRT in Sample Studio without an account,
                  or sign in to render MP4 and transparent MOV.
                </p>
              </div>
              <a
                href="/upload"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink transition hover:text-accent-hover"
              >
                <span>Upload a clip</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div
              data-testid="home-output-examples"
              className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3"
            >
              {/* Output 1: Burned-in MP4 */}
              <article className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
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

                  <div className="relative mt-3.5 h-32 overflow-hidden rounded-xl border border-ink/10 bg-inset">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={SAMPLE_CLIP.poster}
                      alt="Example burned-in MP4 caption output"
                      className="h-full w-full object-cover object-top opacity-85"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-center gap-1 text-center text-xs font-extrabold uppercase">
                      <span className="rounded bg-black/75 px-1.5 py-0.5 text-ink">
                        READY
                      </span>
                      <span className="rounded bg-accent px-1.5 py-0.5 text-page">
                        TO
                      </span>
                      <span className="rounded bg-black/75 px-1.5 py-0.5 text-ink">
                        POST
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                    Preserves source aspect ratio and AAC audio for Reels,
                    Shorts, and TikTok — or renders a 9:16 portrait stage for
                    MP3 and WAV clips.
                  </p>
                </div>
              </article>

              {/* Output 2: UTF-8 SRT */}
              <article className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
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

                  <pre className="mt-3.5 h-32 overflow-hidden rounded-xl border border-ink/10 bg-inset p-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
{`1
00:00:00,350 --> 00:00:02,830
Great short-form clips hook
viewers in two seconds.

2
00:00:02,950 --> 00:00:05,550
Most people watch with the sound off.`}
                  </pre>

                  <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                    Millisecond-accurate subtitle files ready for YouTube,
                    LinkedIn, or any NLE caption track — also downloadable free
                    from Sample Studio.
                  </p>
                </div>
              </article>

              {/* Output 3: Transparent ProRes 4444 MOV */}
              <article className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
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

                  <div className="alpha-checkerboard mt-3.5 flex h-32 items-center justify-center rounded-xl border border-ink/10 px-3">
                    <div
                      style={{ fontFamily: '"DM Serif Display", serif' }}
                      className="rounded-lg border border-ink/15 bg-page/90 px-3.5 py-2 text-center text-sm text-ink shadow-md"
                    >
                      Make <span className="text-accent underline">every</span>{" "}
                      word land.
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                    Captions-only{" "}
                    <code className="font-mono text-ink">yuva444p10le</code>{" "}
                    overlay with true alpha transparency and no audio track for
                    Premiere Pro, DaVinci Resolve, or Final Cut.
                  </p>
                </div>
              </article>
            </div>

            {/* Short Verified FAQ */}
            <div id="faq" data-testid="home-faq" className="mt-12 border-t border-ink/10 pt-10">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
                    Common questions
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    Straight answers on file limits, guest access, and exports.
                  </p>
                </div>

                <div className="divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-panel">
                  {FAQ_ITEMS.map((item, idx) => (
                    <details
                      key={item.q}
                      open={idx === 0}
                      className="group px-5 py-4"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink transition hover:text-accent-hover [&::-webkit-details-marker]:hidden">
                        <span>{item.q}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                      </summary>
                      <p className="mt-2.5 text-xs leading-relaxed text-ink-secondary">
                        {item.a}
                      </p>
                    </details>
                  ))}
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
