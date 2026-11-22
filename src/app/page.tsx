import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Captions,
  CheckCircle2,
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
    <div className="relative min-h-screen overflow-x-clip bg-[#070B10] text-[#F5F1E8]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />

      {/* Ambient mint studio glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-36 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-[#49E6B3]/10 blur-[140px]"
      />

      <PublicHeader userEmail={user?.email ?? null} />

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pb-24 lg:pt-14">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
            {/* Hero Copy & CTAs */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#49E6B3]/30 bg-[#102E28]/80 px-3.5 py-1.5 text-xs font-semibold text-[#49E6B3]">
                <Captions className="h-3.5 w-3.5" />
                <span>Word-synced captions · Burned-in MP4, SRT &amp; Alpha MOV</span>
              </div>

              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-[#F5F1E8] sm:text-5xl lg:text-[3.5rem]">
                {HOMEPAGE_HEADLINE}
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#B6B0A4] sm:text-lg">
                Upload a video or audio clip, fine-tune word-level timing and
                caption styles in the browser, and export burned-in MP4s,
                UTF-8 SRT subtitles, or transparent ProRes 4444 overlays.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/upload"
                  data-testid="home-upload-cta"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-[#49E6B3] px-6 py-3.5 text-sm font-semibold text-[#070B10] shadow-[0_8px_30px_rgba(73,230,179,0.28)] transition hover:bg-[#2FD49F]"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload a clip</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/studio"
                  data-testid="home-sample-cta"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#F5F1E8]/15 bg-[#0D131C] px-5 py-3.5 text-sm font-semibold text-[#F5F1E8] transition hover:border-[#49E6B3]/50 hover:text-[#49E6B3]"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Try a sample</span>
                </Link>
              </div>

              <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#B6B0A4]">
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#49E6B3]" />
                  <span>MP4, MOV, MP3 &amp; WAV up to 150 MB / 3 min</span>
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#49E6B3]" />
                  <span>Test presets here without signing in</span>
                </li>
              </ul>
            </div>

            {/* Playable Interactive Portrait Demo */}
            <div className="flex justify-center lg:justify-end">
              <HomeHeroDemo />
            </div>
          </div>
        </section>

        {/* 3-Step Workflow: Upload -> Edit -> Export */}
        <section
          id="workflow"
          className="border-t border-[#F5F1E8]/8 bg-[#0A1018]/70 py-16 lg:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#49E6B3]">
                How ClipCaptions works
              </span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#F5F1E8] sm:text-3xl">
                Upload. Edit. Export in three clear steps.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#B6B0A4]">
                Every step runs on your private workspace with resumable
                uploads, immutable caption revisions, and worker-rendered video
                exports.
              </p>
            </div>

            <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-3">
              <article className="flex flex-col justify-between rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3]">
                      <Upload className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-xs font-semibold text-[#8C887F]">
                      01 / UPLOAD
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[#F5F1E8]">
                    Upload video or audio
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#B6B0A4]">
                    Drop MP4, MOV, MP3, or WAV clips up to 150 MB and 3 minutes.
                    Private resumable uploads handle pauses and reconnects while
                    the worker normalizes your preview and generates word-level
                    captions.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[#F5F1E8]/8 pt-3 text-[11px] font-mono text-[#B6B0A4]">
                  <span className="rounded-md bg-[#131C28] px-2 py-0.5">MP4</span>
                  <span className="rounded-md bg-[#131C28] px-2 py-0.5">MOV</span>
                  <span className="rounded-md bg-[#131C28] px-2 py-0.5">MP3</span>
                  <span className="rounded-md bg-[#131C28] px-2 py-0.5">WAV</span>
                </div>
              </article>

              <article className="flex flex-col justify-between rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3]">
                      <SlidersHorizontal className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-xs font-semibold text-[#8C887F]">
                      02 / EDIT
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[#F5F1E8]">
                    Refine text, timing &amp; style
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#B6B0A4]">
                    Click any timestamp or word to seek immediately. Edit cue
                    text or start/end seconds, adjust size and vertical
                    position, and switch between Clean, Boxed, and Word
                    Highlight with revision-safe autosave.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[#F5F1E8]/8 pt-3 text-[11px] font-medium text-[#49E6B3]">
                  <span className="rounded-md border border-[#49E6B3]/25 bg-[#102E28] px-2 py-0.5">
                    Clean
                  </span>
                  <span className="rounded-md border border-[#49E6B3]/25 bg-[#102E28] px-2 py-0.5">
                    Boxed
                  </span>
                  <span className="rounded-md border border-[#49E6B3]/25 bg-[#102E28] px-2 py-0.5">
                    Word Highlight
                  </span>
                </div>
              </article>

              <article className="flex flex-col justify-between rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3]">
                      <Download className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-xs font-semibold text-[#8C887F]">
                      03 / EXPORT
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[#F5F1E8]">
                    Export pinned to your revision
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#B6B0A4]">
                    Every export binds to a specific saved revision. Download
                    ready-to-post MP4 videos, UTF-8 SRT subtitle files, or
                    ProRes 4444 alpha overlays via private short-lived links.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[#F5F1E8]/8 pt-3 text-[11px] font-mono text-[#B6B0A4]">
                  <span className="rounded-md bg-[#131C28] px-2 py-0.5">.mp4</span>
                  <span className="rounded-md bg-[#131C28] px-2 py-0.5">.srt</span>
                  <span className="rounded-md bg-[#131C28] px-2 py-0.5">
                    .mov (alpha)
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Export Formats Showcase */}
        <section id="exports" className="border-t border-[#F5F1E8]/8 py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#49E6B3]">
                  Built-in Exports
                </span>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#F5F1E8] sm:text-3xl">
                  Three production outputs, ready when you are.
                </h2>
              </div>
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#49E6B3] hover:underline"
              >
                <span>Start your first project</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* MP4 Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-[#F5F1E8]">
                      <Film className="h-4 w-4 text-[#49E6B3]" />
                      <span>MP4 to post</span>
                    </span>
                    <span className="rounded-md border border-[#F5F1E8]/10 bg-[#131C28] px-2 py-0.5 font-mono text-[10px] text-[#B6B0A4]">
                      H.264 / AAC
                    </span>
                  </div>

                  {/* Visual miniature preview */}
                  <div className="mt-4 flex h-32 flex-col justify-end rounded-xl border border-[#F5F1E8]/10 bg-gradient-to-b from-[#112635] via-[#0B1722] to-[#070B10] p-3">
                    <p className="flex flex-wrap items-center justify-center gap-1 text-center text-xs font-extrabold uppercase">
                      <span className="rounded bg-[#070B10]/60 px-1.5 py-0.5 text-[#F5F1E8]">
                        HOOK
                      </span>
                      <span className="rounded bg-[#49E6B3] px-1.5 py-0.5 text-[#070B10]">
                        VIEWERS
                      </span>
                      <span className="rounded bg-[#070B10]/50 px-1.5 py-0.5 text-[#F5F1E8]/80">
                        FAST
                      </span>
                    </p>
                  </div>

                  <p className="mt-3.5 text-xs leading-relaxed text-[#B6B0A4]">
                    Styled captions burned directly into your video with
                    original display aspect ratio and AAC audio preserved.
                    Audio-only uploads render onto a clean 9:16 portrait stage.
                  </p>
                </div>
              </div>

              {/* SRT Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-[#F5F1E8]">
                      <FileText className="h-4 w-4 text-[#49E6B3]" />
                      <span>SRT for subtitles</span>
                    </span>
                    <span className="rounded-md border border-[#F5F1E8]/10 bg-[#131C28] px-2 py-0.5 font-mono text-[10px] text-[#B6B0A4]">
                      UTF-8 .srt
                    </span>
                  </div>

                  {/* Visual miniature preview */}
                  <pre className="mt-4 h-32 overflow-hidden rounded-xl border border-[#F5F1E8]/10 bg-[#070B10] p-3 font-mono text-[11px] leading-relaxed text-[#B6B0A4]">
{`1
00:00:00,400 --> 00:00:03,100
Great short-form clips
hook viewers in two seconds.

2
00:00:03,400 --> 00:00:06,200`}
                  </pre>

                  <p className="mt-3.5 text-xs leading-relaxed text-[#B6B0A4]">
                    Deterministic UTF-8 SubRip files with exact millisecond
                    timestamps, multiline breaks, Unicode text, and silence gaps
                    intact for YouTube, LinkedIn, or NLE import.
                  </p>
                </div>
              </div>

              {/* Transparent MOV Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-[#F5F1E8]">
                      <Layers className="h-4 w-4 text-[#49E6B3]" />
                      <span>Transparent MOV for compositing</span>
                    </span>
                    <span className="rounded-md border border-[#49E6B3]/30 bg-[#102E28] px-2 py-0.5 font-mono text-[10px] text-[#49E6B3]">
                      ProRes 4444
                    </span>
                  </div>

                  {/* Checkerboard alpha visual preview */}
                  <div className="alpha-checkerboard mt-4 flex h-32 flex-col justify-between rounded-xl border border-[#F5F1E8]/10 p-3">
                    <span className="self-start rounded-full border border-[#F5F1E8]/15 bg-[#070B10]/80 px-2 py-0.5 font-mono text-[10px] text-[#B6B0A4]">
                      Alpha channel · No audio
                    </span>
                    <div className="mx-auto rounded-lg border border-[#F5F1E8]/15 bg-[#070B10]/85 px-3 py-1.5 text-center text-xs font-semibold text-[#F5F1E8]">
                      Keep <span className="text-[#49E6B3] underline">your</span>{" "}
                      style.
                    </div>
                  </div>

                  <p className="mt-3.5 text-xs leading-relaxed text-[#B6B0A4]">
                    Apple ProRes 4444 with real alpha, captions only, no audio,
                    and full clip duration with clean transparent gaps ready to
                    drop over timelines in Premiere, DaVinci, or Final Cut.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Strip */}
        <section className="border-t border-[#F5F1E8]/8 bg-[#0A1018]/80 py-14">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#F5F1E8] sm:text-2xl">
                Ready to caption your next clip?
              </h2>
              <p className="mt-1 text-sm text-[#B6B0A4]">
                Upload a video directly or test word-level styling on the public
                sample first.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 rounded-xl bg-[#49E6B3] px-5 py-3 text-sm font-semibold text-[#070B10] transition hover:bg-[#2FD49F]"
              >
                <Upload className="h-4 w-4" />
                <span>Upload a clip</span>
              </Link>
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 rounded-xl border border-[#F5F1E8]/15 bg-[#0D131C] px-5 py-3 text-sm font-semibold text-[#F5F1E8] transition hover:border-[#49E6B3]/50 hover:text-[#49E6B3]"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Try a sample</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#F5F1E8]/8 bg-[#070B10] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-[#8C887F] sm:px-6">
          <ClipCaptionsLockup markSize={26} compact />
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-4">
            <Link href="/studio" className="transition hover:text-[#F5F1E8]">
              Sample Studio
            </Link>
            <Link href="/upload" className="transition hover:text-[#F5F1E8]">
              Upload a clip
            </Link>
            <Link href="/projects" className="transition hover:text-[#F5F1E8]">
              Projects
            </Link>
            <Link href="/login" className="transition hover:text-[#F5F1E8]">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
