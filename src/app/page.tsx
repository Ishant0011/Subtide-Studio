import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Film,
  Languages,
  Palette,
  Play,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from "lucide-react";
import { HomeAutoTour } from "@/components/HomeAutoTour";
import { HomeCreatorGallery } from "@/components/HomeCreatorGallery";
import { MotionReveal } from "@/components/MotionReveal";
import { PublicHeader } from "@/components/PublicHeader";
import {
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

const FAQ_GETTING_STARTED = [
  {
    q: "Can I try it without an account?",
    a: "Yes. Watch the interactive tour on this page or open Sample Studio to edit lines, test presets, and preview all 10 bundled fonts with no sign-in required.",
  },
  {
    q: "When do I need to sign in?",
    a: "Sign in when you want to upload your own clip, save projects and custom presets to your account, use AI Assist, or render and download MP4 exports.",
  },
  {
    q: "Which video and audio files are supported?",
    a: "Private uploads accept MP4, MOV, MP3, and WAV files. Audio-only uploads are automatically placed on a 9:16 portrait stage for captioned MP4 export.",
  },
  {
    q: "What are the size and duration limits?",
    a: "Each uploaded clip can be up to 150 MB and up to 3 minutes long, uploaded with chunked transfers that resume automatically if your connection drops.",
  },
] as const;

const FAQ_EDITING_EXPORT = [
  {
    q: "Can I correct words and change timing?",
    a: "Yes. Click any caption line in the transcript to fix words inline, open word-level timing controls, or drag cue boundaries, split, and merge on the waveform timeline with autosave.",
  },
  {
    q: "Can I change fonts, colors, and caption styles?",
    a: "Yes. Pick from 16 built-in presets, save your own reusable custom presets, and style with 10 bundled fonts (Poppins, Montserrat, Bebas Neue, Inter, Oswald, Archivo Black, Playfair Display, Space Mono, DM Serif, and Noto Sans Devanagari).",
  },
  {
    q: "Which languages can I caption or translate, including Hindi?",
    a: "ClipCaptions transcribes speech into timed captions and lets signed-in projects translate captions into Hindi (Devanagari) or Hinglish, styled with Noto Sans Devanagari and rendered with full HarfBuzz shaping.",
  },
  {
    q: "Which MP4 resolutions can I export?",
    a: "Export H.264/AAC MP4 at 240p, 360p, 480p, 720p, 1080p, 1440p, or 2160p (4K) up to your uploaded video's source resolution without upscaling, preserving aspect ratio, rotation, and original audio.",
  },
] as const;

const FAQ_PRIVACY_AI = [
  {
    q: "What happens to my uploaded media?",
    a: "Your clip is stored in private per-account storage accessible only to you via short-lived signed links, transcribed for your project, and rendered directly from your original uploaded file.",
  },
  {
    q: "What does AI Assist send to Google?",
    a: "AI Assist is optional and only available on signed-in projects. When you run Polish, Translate, or Social Kit, ClipCaptions sends only your caption text, cue timestamps, and project title to Google's Gemini API — never your video or audio file.",
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
    <div className="cc-home-ivory relative min-h-screen overflow-x-clip bg-[#FAF7F0] text-[#181B25]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <PublicHeader userEmail={user?.email ?? null} variant="ivory" />

      <main className="relative z-10">
        {/* 1. FIRST SCREEN — Warm Ivory #FAF7F0, editorial H1, cobalt CTA, automatic 24s product tour */}
        <section
          data-testid="home-open-hero"
          className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 sm:pb-12 sm:pt-5 lg:px-8 lg:pb-14 lg:pt-5"
        >
          <div className="max-w-3xl">
            <h1 className="text-[1.95rem] font-extrabold leading-[1.06] tracking-[-0.035em] text-[#181B25] sm:text-4xl lg:text-[3.1rem] lg:leading-[1.04]">
              Automatic captions
              <br />
              for your videos.
            </h1>

            <p
              data-testid="home-hero-subcopy"
              className="mt-2 max-w-2xl text-sm leading-relaxed text-[#50566A] sm:mt-2.5 sm:text-base"
            >
              {HOMEPAGE_SUBHEADLINE}
            </p>

            <div className="mt-3.5 flex flex-wrap items-center gap-2.5 sm:mt-4 sm:gap-3">
              {user ? (
                <Link
                  href="/upload"
                  prefetch={false}
                  data-testid="home-upload-cta"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2648DB] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E3BC0] sm:px-6 sm:py-3 sm:text-base"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Upload a clip</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              ) : (
                <a
                  href="/upload"
                  data-testid="home-upload-cta"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2648DB] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E3BC0] sm:px-6 sm:py-3 sm:text-base"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Upload a clip</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </a>
              )}

              <Link
                href="/studio"
                data-testid="home-sample-cta"
                className="inline-flex items-center gap-2 rounded-xl border border-[#181B25]/18 bg-white px-4 py-2.5 text-sm font-semibold text-[#181B25] transition hover:border-[#2648DB]/50 hover:bg-[#EEF2FF] sm:px-5 sm:py-3 sm:text-base"
              >
                <Play className="h-4 w-4 shrink-0 fill-current text-[#2648DB]" />
                <span>Try a sample</span>
              </Link>

              <span className="text-xs font-medium text-[#50566A] sm:ml-1">
                No account needed for the sample.
              </span>
            </div>
          </div>

          {/* Automatic ~24-Second Pre-Edited Product Tour */}
          <HomeAutoTour />
        </section>

        {/* 2. EXAMPLES — Four distinct playable creator clips */}
        <section
          id="examples"
          data-testid="home-examples"
          className="scroll-mt-20 border-t border-[#181B25]/10 py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#181B25] sm:text-3xl">
                Four formats, four caption styles
              </h2>
              <p className="mt-1.5 text-sm text-[#50566A] sm:text-base">
                Pick any example to play it with its caption treatment.
              </p>
            </div>

            <HomeCreatorGallery />
          </MotionReveal>
        </section>

        {/* 3. WHAT YOU CAN DO — Three focused, readable product close-ups */}
        <section
          id="capabilities"
          className="scroll-mt-20 border-t border-[#181B25]/10 bg-[#F2EEE4]/70 py-12 lg:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <div className="max-w-2xl">
                <h2 className="text-2xl font-extrabold tracking-tight text-[#181B25] sm:text-3xl">
                  Built for fast fixes and consistent styles
                </h2>
                <p className="mt-1.5 text-sm text-[#50566A] sm:text-base">
                  Everything you need from timed transcripts to Hindi MP4 export.
                </p>
              </div>
            </MotionReveal>

            <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Close-up 1: Timed transcription & word/timing edits */}
              <MotionReveal delayMs={0} className="h-full">
                <div className="flex h-full flex-col justify-between rounded-2xl border border-[#181B25]/10 bg-white p-5">
                  <div>
                    <div className="flex items-center gap-2 text-[#2648DB]">
                      <SlidersHorizontal className="h-4 w-4" />
                      <h3 className="text-base font-bold text-[#181B25]">
                        Timed edits &amp; waveform sync
                      </h3>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#50566A]">
                      Fix misheard words inline and nudge cue edges on the
                      waveform with live autosave.
                    </p>
                  </div>

                  <div className="mt-4 rounded-xl bg-[#FAF7F0] p-3.5 text-xs">
                    <div className="flex items-center justify-between font-mono text-[10px] text-[#50566A]">
                      <span>0:00.64 – 0:04.24</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-sans font-semibold text-emerald-800">
                        <Check className="h-3 w-3" />
                        <span>Saved</span>
                      </span>
                    </div>
                    <p className="mt-2 font-semibold text-[#181B25]">
                      Great short-form clips hook viewers in{" "}
                      <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 text-[#2648DB] ring-1 ring-[#2648DB]/40">
                        two
                      </span>{" "}
                      seconds.
                    </p>
                  </div>
                </div>
              </MotionReveal>

              {/* Close-up 2: Styles, 10 fonts & reusable presets */}
              <MotionReveal delayMs={70} className="h-full">
                <div className="flex h-full flex-col justify-between rounded-2xl border border-[#181B25]/10 bg-white p-5">
                  <div>
                    <div className="flex items-center gap-2 text-[#2648DB]">
                      <Palette className="h-4 w-4" />
                      <h3 className="text-base font-bold text-[#181B25]">
                        10 fonts &amp; saved presets
                      </h3>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#50566A]">
                      Start from 16 built-in looks or save your custom font,
                      color, and highlight preset.
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#181B25] p-3 text-center text-xs">
                    <div className="rounded-lg bg-white/10 px-2 py-2.5 font-semibold text-[#FAF7F0]">
                      Clean
                    </div>
                    <div className="rounded-lg bg-[#2648DB] px-2 py-2.5 font-extrabold uppercase text-white">
                      Word
                    </div>
                    <div
                      style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                      className="rounded-lg bg-[#FACC15] px-2 py-2 text-base tracking-wider text-[#181B25]"
                    >
                      BOLD
                    </div>
                  </div>
                </div>
              </MotionReveal>

              {/* Close-up 3: Hindi Devanagari translation & AI Assist */}
              <MotionReveal delayMs={140} className="h-full">
                <div
                  data-testid="home-hindi-capability"
                  className="flex h-full flex-col justify-between rounded-2xl border border-[#181B25]/10 bg-white p-5"
                >
                  <div>
                    <div className="flex items-center gap-2 text-[#2648DB]">
                      <Languages className="h-4 w-4" />
                      <h3 className="text-base font-bold text-[#181B25]">
                        Hindi translation &amp; AI Assist
                      </h3>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#50566A]">
                      Translate into Devanagari or Hinglish with HarfBuzz MP4
                      shaping, or run optional text-only Polish.
                    </p>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#2648DB]/25 bg-[#EEF2FF] p-3.5 text-xs">
                    <span className="font-mono text-[10px] font-semibold uppercase text-[#2648DB]">
                      Hindi · Noto Sans Devanagari
                    </span>
                    <p
                      lang="hi"
                      style={{
                        fontFamily: '"Noto Sans Devanagari", sans-serif',
                      }}
                      className="mt-1 text-sm font-bold leading-snug text-[#181B25]"
                    >
                      बेहतरीन शॉर्ट क्लिप्स दो सेकंड में ध्यान खींचती हैं।
                    </p>
                  </div>
                </div>
              </MotionReveal>
            </div>
          </div>
        </section>

        {/* 4. HOW IT WORKS — Upload -> Transcribe -> Edit -> Export + Download example MP4 */}
        <section
          id="how-it-works"
          data-testid="home-how-it-works"
          className="scroll-mt-20 border-t border-[#181B25]/10 py-12 lg:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-extrabold tracking-tight text-[#181B25] sm:text-3xl">
                    How it works
                  </h2>
                  <p className="mt-1.5 text-sm text-[#50566A] sm:text-base">
                    One clip from raw upload to a burned-in MP4 ready to post.
                  </p>
                </div>
                <span className="rounded-full bg-[#EEF2FF] px-3.5 py-1.5 font-mono text-[11px] font-semibold text-[#2648DB]">
                  MP4 · MOV · MP3 · WAV · up to 150 MB / 3 min
                </span>
              </div>
            </MotionReveal>

            <ol className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <li className="rounded-2xl border border-[#181B25]/10 bg-white p-4">
                <span className="font-mono text-xs font-bold text-[#2648DB]">
                  01 · Upload
                </span>
                <p className="mt-1.5 text-sm font-bold text-[#181B25]">
                  hook-take-02.mp4
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#50566A]">
                  Auto-resuming private upload up to 150 MB and 3 minutes.
                </p>
              </li>

              <li className="rounded-2xl border border-[#181B25]/10 bg-white p-4">
                <span className="font-mono text-xs font-bold text-[#2648DB]">
                  02 · Transcribe
                </span>
                <p className="mt-1.5 text-sm font-bold text-[#181B25]">
                  Word-timed captions
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#50566A]">
                  Speech becomes timed caption cues automatically.
                </p>
              </li>

              <li className="rounded-2xl border border-[#181B25]/10 bg-white p-4">
                <span className="font-mono text-xs font-bold text-[#2648DB]">
                  03 · Edit
                </span>
                <p className="mt-1.5 text-sm font-bold text-[#181B25]">
                  Fix words &amp; style
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#50566A]">
                  Correct names, adjust timing, or translate into Hindi.
                </p>
              </li>

              <li className="rounded-2xl border border-[#181B25]/10 bg-white p-4">
                <span className="font-mono text-xs font-bold text-[#2648DB]">
                  04 · Export
                </span>
                <p className="mt-1.5 text-sm font-bold text-[#181B25]">
                  Download MP4
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#50566A]">
                  240p–4K output matched to your source clip without upscaling.
                </p>
              </li>
            </ol>

            {/* Real Export Example Download Strip */}
            <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#181B25]/10 bg-white p-5 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#2648DB]">
                  <Film className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#181B25] sm:text-base">
                    Inspect a real ClipCaptions MP4 export
                  </h3>
                  <p className="mt-0.5 text-xs text-[#50566A]">
                    Available export resolutions (240p–4K) depend on your
                    uploaded video. This public sample is 720×1280 H.264/AAC
                    with burned-in captions.
                  </p>
                </div>
              </div>

              <a
                href="/home/clipcaptions-example-export.mp4"
                download="clipcaptions-example.mp4"
                data-testid="download-example-mp4"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#2648DB] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1E3BC0] sm:text-sm"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span>Download example MP4</span>
              </a>
            </div>
          </div>
        </section>

        {/* 5. FAQ — 10 verified questions under 3 clear groups */}
        <section
          id="faq"
          data-testid="home-faq"
          className="scroll-mt-20 border-t border-[#181B25]/10 bg-[#F2EEE4]/70 py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#181B25] sm:text-3xl">
                Frequently asked questions
              </h2>
              <p className="mt-1.5 text-sm text-[#50566A] sm:text-base">
                Accounts, file limits, editing, Hindi exports, and privacy.
              </p>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Group 1: Getting started */}
              <div>
                <h3 className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#2648DB]">
                  Getting started
                </h3>
                <div className="divide-y divide-[#181B25]/10 rounded-2xl border border-[#181B25]/10 bg-white">
                  {FAQ_GETTING_STARTED.map((item, idx) => (
                    <details
                      key={item.q}
                      open={idx === 0}
                      className="group px-4 py-3.5"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#181B25] transition hover:text-[#2648DB] [&::-webkit-details-marker]:hidden">
                        <span>{item.q}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#50566A] transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                      </summary>
                      <p className="mt-2 text-xs leading-relaxed text-[#50566A]">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>

              {/* Group 2: Editing and export */}
              <div>
                <h3 className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#2648DB]">
                  Editing and export
                </h3>
                <div className="divide-y divide-[#181B25]/10 rounded-2xl border border-[#181B25]/10 bg-white">
                  {FAQ_EDITING_EXPORT.map((item) => (
                    <details key={item.q} className="group px-4 py-3.5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#181B25] transition hover:text-[#2648DB] [&::-webkit-details-marker]:hidden">
                        <span>{item.q}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#50566A] transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                      </summary>
                      <p className="mt-2 text-xs leading-relaxed text-[#50566A]">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>

              {/* Group 3: Privacy and AI */}
              <div>
                <h3 className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#2648DB]">
                  Privacy and AI
                </h3>
                <div className="divide-y divide-[#181B25]/10 rounded-2xl border border-[#181B25]/10 bg-white">
                  {FAQ_PRIVACY_AI.map((item) => (
                    <details key={item.q} className="group px-4 py-3.5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#181B25] transition hover:text-[#2648DB] [&::-webkit-details-marker]:hidden">
                        <span>{item.q}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#50566A] transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                      </summary>
                      <p className="mt-2 text-xs leading-relaxed text-[#50566A]">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </MotionReveal>
        </section>

        {/* 6. CHARCOAL CLOSING CTA ON IVORY CANVAS */}
        <section
          data-testid="home-final-cta"
          className="border-t border-[#181B25]/10 py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-[#181B25] px-6 py-10 text-center text-[#FAF7F0] shadow-[0_24px_60px_rgba(24,27,37,0.18)] sm:px-10 sm:py-14">
              <Sparkles className="mx-auto h-6 w-6 text-[#93B4FF]" />
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
                Caption your first clip
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#C9CEDE]">
                Upload a video for automatic timed captions and MP4 export, or
                try the sample editor right away.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="/upload"
                  data-testid="home-bottom-upload-cta"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2648DB] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1E3BC0] sm:px-6 sm:py-3.5 sm:text-base"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Upload a clip</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </a>
                <Link
                  href="/studio"
                  data-testid="home-bottom-sample-cta"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-white/18 sm:px-6 sm:py-3.5 sm:text-base"
                >
                  <Play className="h-4 w-4 shrink-0 fill-current" />
                  <span>Try a sample</span>
                </Link>
              </div>
            </div>
          </MotionReveal>
        </section>
      </main>

      <footer className="border-t border-[#181B25]/10 bg-[#FAF7F0] py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-[#50566A] sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-sm font-extrabold tracking-tight text-[#181B25]"
          >
            Clip<span className="text-[#2648DB]">Captions</span>
          </Link>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-5"
          >
            <a href="#examples" className="transition hover:text-[#181B25]">
              Examples
            </a>
            <a href="#how-it-works" className="transition hover:text-[#181B25]">
              How it works
            </a>
            <a href="#faq" className="transition hover:text-[#181B25]">
              FAQ
            </a>
            <Link href="/studio" className="transition hover:text-[#181B25]">
              Sample editor
            </Link>
            <Link
              href="/login?mode=signin"
              prefetch={false}
              className="transition hover:text-[#181B25]"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
