import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Film,
  Languages,
  Play,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from "lucide-react";
import { HomeCreatorGallery } from "@/components/HomeCreatorGallery";
import { HomeHeroPlayer } from "@/components/HomeHeroPlayer";
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

const WORKFLOW_STRIP = [
  { label: "Upload", icon: Upload },
  { label: "Transcribe", icon: Sparkles },
  { label: "Edit", icon: SlidersHorizontal },
  { label: "Export", icon: Download },
] as const;

const FAQ_GETTING_STARTED = [
  {
    q: "Can I try it without an account?",
    a: "Yes. Try the live showcase above or open Sample Studio to edit lines, switch presets, and preview all 10 bundled fonts without signing in.",
  },
  {
    q: "When do I need to sign in?",
    a: "Sign in when you want to upload your own clip, save projects and custom presets, use AI Assist, or render and download MP4 exports.",
  },
  {
    q: "Which video and audio files are supported?",
    a: "Private uploads accept MP4, MOV, MP3, and WAV files. Audio-only uploads are placed automatically on a 9:16 portrait stage for captioned MP4 export.",
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
    a: "Yes. Pick from 16 built-in presets, save reusable custom presets, and style with 10 bundled fonts (Poppins, Montserrat, Bebas Neue, Inter, Oswald, Archivo Black, Playfair Display, Space Mono, DM Serif, and Noto Sans Devanagari).",
  },
  {
    q: "Which languages can I caption or translate, including Hindi?",
    a: "ClipCaptions transcribes speech into timed captions and lets signed-in projects translate captions into Hindi (Devanagari) or Hinglish, rendered with Noto Sans Devanagari and full HarfBuzz shaping.",
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
        {/* 1. SPLIT HERO — 42% Left Editorial Copy + 58% Right Persistent Video Player */}
        <section
          data-testid="home-open-hero"
          className="mx-auto max-w-7xl px-4 pb-8 pt-3 sm:px-6 sm:pb-12 sm:pt-5 lg:px-8 lg:pb-14 lg:pt-7"
        >
          <div className="grid grid-cols-1 items-center gap-4 sm:gap-7 lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] lg:gap-10">
            {/* Left 42%: Strong Editorial Headline + Clear Actions (no eyebrow, no badge, no external arrows) */}
            <div className="max-w-lg">
              <h1 className="text-[2rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-[#181B25] sm:text-5xl lg:text-[3.5rem] lg:leading-[1.02]">
                Add captions
                <br />
                that move with
                <br />
                every word.
              </h1>

              <p
                data-testid="home-hero-subcopy"
                className="mt-2.5 text-sm leading-relaxed text-[#50566A] sm:mt-4 sm:text-lg"
              >
                {HOMEPAGE_SUBHEADLINE}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:mt-6 sm:gap-3">
                {user ? (
                  <Link
                    href="/upload"
                    prefetch={false}
                    data-testid="home-upload-cta"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2648DB] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E3BC0] sm:px-6 sm:py-3 sm:text-base"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span>Upload a clip</span>
                  </Link>
                ) : (
                  <a
                    href="/upload"
                    data-testid="home-upload-cta"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2648DB] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E3BC0] sm:px-6 sm:py-3 sm:text-base"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span>Upload a clip</span>
                  </a>
                )}

                <Link
                  href="/studio"
                  data-testid="home-sample-cta"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#181B25]/18 bg-white px-4 py-2.5 text-sm font-semibold text-[#181B25] transition hover:border-[#2648DB]/50 hover:bg-[#EEF2FF] sm:px-5 sm:py-3 sm:text-base"
                >
                  <Play className="h-4 w-4 shrink-0 fill-current text-[#2648DB]" />
                  <span>Try the editor</span>
                </Link>
              </div>

              <p className="mt-2.5 text-xs font-medium text-[#50566A]">
                No account needed for the sample.
              </p>
            </div>

            {/* Right 58%: Dominant Persistent Video Player */}
            <div className="min-w-0">
              <HomeHeroPlayer />
            </div>
          </div>
        </section>

        {/* 2. CREATOR EXAMPLES — Directly after the hero */}
        <section
          id="examples"
          data-testid="home-examples"
          className="scroll-mt-20 border-t border-[#181B25]/10 py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#181B25] sm:text-3xl">
                Four clips, four caption looks
              </h2>
              <p className="mt-1 text-sm text-[#50566A] sm:text-base">
                Pick any example to play it with its caption treatment.
              </p>
            </div>

            <HomeCreatorGallery />
          </MotionReveal>
        </section>

        {/* 3. SUBSTANTIAL VISUAL SECTION A — "Make the captions yours." */}
        <section
          id="make-it-yours"
          data-testid="home-make-it-yours"
          className="scroll-mt-20 border-t border-[#181B25]/10 bg-[#F2EEE4]/70 py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#181B25] sm:text-3xl">
                Make the captions yours.
              </h2>
              <p className="mt-1 text-sm text-[#50566A] sm:text-base">
                Edit words inline, adjust timing on the waveform, save your
                style, or translate into Hindi.
              </p>
            </div>

            {/* Real Workspace Close-Up */}
            <div className="mt-7 grid grid-cols-1 gap-5 rounded-3xl border border-[#181B25]/10 bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-7">
              {/* Left: Transcript Edit + Waveform Timing + Saved Presets */}
              <div className="flex flex-col justify-between gap-4">
                <div className="rounded-2xl bg-[#FAF7F0] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#50566A]">
                      Cue #1 · 0:00.64 – 0:04.24
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
                      <Check className="h-3 w-3" />
                      <span>Saved</span>
                    </span>
                  </div>
                  <p className="mt-2.5 text-base font-bold text-[#181B25] sm:text-lg">
                    Great short-form clips hook viewers in{" "}
                    <span className="rounded-md bg-[#EEF2FF] px-1.5 py-0.5 text-[#2648DB] ring-1 ring-[#2648DB]/40">
                      two
                    </span>{" "}
                    seconds.
                  </p>
                  <div className="mt-3.5 flex h-9 items-end gap-1 rounded-xl bg-[#181B25] px-2.5 py-2">
                    {[24, 52, 76, 44, 88, 64, 36, 80, 92, 58, 42, 70, 48, 30, 62, 82, 50, 34].map(
                      (h, i) => (
                        <span
                          key={i}
                          style={{ height: `${Math.round(h * 0.24)}px` }}
                          className={`flex-1 rounded-full ${
                            i >= 4 && i <= 11 ? "bg-[#5B7CFF]" : "bg-white/22"
                          }`}
                        />
                      )
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-[#2648DB] px-3 py-1.5 font-semibold text-white">
                    Word Highlight · Poppins
                  </span>
                  <span className="rounded-lg bg-[#EEF2FF] px-3 py-1.5 font-semibold text-[#181B25]">
                    Brand Hook (Saved)
                  </span>
                  <span className="rounded-lg bg-[#FAF7F0] px-3 py-1.5 font-medium text-[#50566A]">
                    16 presets · 10 fonts
                  </span>
                </div>
              </div>

              {/* Right: Verified English / Hindi Devanagari + Optional AI Assist Preview */}
              <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#181B25] p-5 text-[#FAF7F0]">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-[#93B4FF]">
                      <Languages className="h-3.5 w-3.5" />
                      <span>English → Hindi · Devanagari</span>
                    </span>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#C9CEDE]">
                      HarfBuzz MP4
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-[#C9CEDE]">
                    Great short-form clips hook viewers in two seconds.
                  </p>
                  <p
                    lang="hi"
                    data-testid="home-hindi-example"
                    style={{
                      fontFamily: '"Noto Sans Devanagari", sans-serif',
                    }}
                    className="mt-2 rounded-xl bg-white/8 px-3.5 py-3 text-base font-bold leading-snug text-[#FAF7F0] sm:text-lg"
                  >
                    बेहतरीन शॉर्ट क्लिप्स दो सेकंड में ध्यान खींचती हैं।
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/5 px-3.5 py-2.5 text-xs">
                  <div>
                    <span className="font-semibold text-[#93B4FF]">
                      AI Assist · Polish
                    </span>
                    <p className="text-[11px] text-[#C9CEDE]">
                      Optional text-only suggestions — never sends your video.
                    </p>
                  </div>
                  <Link
                    href="/studio"
                    className="shrink-0 font-semibold text-white underline decoration-[#5B7CFF] underline-offset-4 hover:text-[#93B4FF]"
                  >
                    Try editor
                  </Link>
                </div>
              </div>
            </div>
          </MotionReveal>
        </section>

        {/* 4. SUBSTANTIAL VISUAL SECTION B — "Ready to post." (Real Exported MP4 + Resolution Picker + Download) */}
        <section
          id="ready-to-post"
          data-testid="home-ready-to-post"
          className="scroll-mt-20 border-t border-[#181B25]/10 py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-8 rounded-3xl border border-[#181B25]/10 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[minmax(0,1.08fr)_300px] lg:gap-10">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-[#181B25] sm:text-3xl">
                  Ready to post.
                </h2>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#50566A] sm:text-base">
                  Download a burned-in MP4 with your original audio intact.
                  Available resolutions depend on your uploaded clip so footage
                  is never upscaled.
                </p>

                {/* Real Resolution Picker Preview */}
                <div className="mt-5 grid grid-cols-2 gap-2 sm:max-w-md sm:grid-cols-3">
                  <div className="rounded-xl border-2 border-[#2648DB] bg-[#EEF2FF] px-3 py-2 text-xs">
                    <span className="block font-bold text-[#181B25]">
                      1080p MP4
                    </span>
                    <span className="font-mono text-[10px] text-[#2648DB]">
                      1080×1920
                    </span>
                  </div>
                  <div className="rounded-xl border border-[#181B25]/12 bg-[#FAF7F0] px-3 py-2 text-xs">
                    <span className="block font-bold text-[#181B25]">
                      720p MP4
                    </span>
                    <span className="font-mono text-[10px] text-[#50566A]">
                      720×1280
                    </span>
                  </div>
                  <div className="rounded-xl border border-[#181B25]/12 bg-[#FAF7F0] px-3 py-2 text-xs">
                    <span className="block font-bold text-[#181B25]">
                      2160p (4K)
                    </span>
                    <span className="font-mono text-[10px] text-[#50566A]">
                      Up to source
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a
                    href="/home/clipcaptions-example-export.mp4"
                    download="clipcaptions-example.mp4"
                    data-testid="download-example-mp4"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2648DB] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1E3BC0]"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    <span>Download example MP4</span>
                  </a>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#50566A]">
                    <Film className="h-3.5 w-3.5 text-[#2648DB]" />
                    <span>720×1280 · H.264 / AAC · 1.5 MB</span>
                  </span>
                </div>
              </div>

              {/* Real Playable Exported MP4 */}
              <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl bg-[#181B25] shadow-[0_18px_48px_rgba(24,27,37,0.2)] lg:max-w-[280px]">
                <video
                  data-testid="example-export-video"
                  src="/home/clipcaptions-example-export.mp4"
                  poster="/home/clipcaptions-example-poster.jpg"
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-[9/15] w-full object-cover object-[50%_26%]"
                />
              </div>
            </div>
          </MotionReveal>
        </section>

        {/* 5. COMPACT HOW IT WORKS STRIP */}
        <section
          id="how-it-works"
          data-testid="home-how-it-works"
          className="scroll-mt-20 border-t border-[#181B25]/10 bg-[#F2EEE4]/70 py-8 lg:py-10"
        >
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#2648DB]">
                How it works
              </h2>
              <ol className="mt-2 flex flex-wrap items-center gap-2">
                {WORKFLOW_STRIP.map((step, idx) => {
                  const Icon = step.icon;
                  return (
                    <li
                      key={step.label}
                      className="inline-flex items-center gap-2"
                    >
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#181B25]/12 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#181B25]">
                        <Icon className="h-3.5 w-3.5 text-[#2648DB]" />
                        <span>{step.label}</span>
                      </span>
                      {idx < WORKFLOW_STRIP.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-[#50566A]" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            <span className="rounded-full bg-[#EEF2FF] px-3.5 py-1.5 font-mono text-[11px] font-semibold text-[#2648DB]">
              MP4 · MOV · MP3 · WAV · up to 150 MB / 3 min
            </span>
          </div>
        </section>

        {/* 6. CLEAN FAQ — 10 verified questions */}
        <section
          id="faq"
          data-testid="home-faq"
          className="scroll-mt-20 border-t border-[#181B25]/10 py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#181B25] sm:text-3xl">
                Frequently asked questions
              </h2>
              <p className="mt-1 text-sm text-[#50566A]">
                Accounts, file limits, editing, Hindi exports, and privacy.
              </p>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-3">
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

        {/* 7. CHARCOAL CLOSING CTA — One clear primary upload action */}
        <section
          data-testid="home-final-cta"
          className="border-t border-[#181B25]/10 py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-[#181B25] px-6 py-10 text-center text-[#FAF7F0] shadow-[0_24px_60px_rgba(24,27,37,0.18)] sm:px-10 sm:py-14">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
                Caption your first clip
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#C9CEDE]">
                Upload a video and download a captioned MP4 in minutes.
              </p>
              <div className="mt-6 flex justify-center">
                <a
                  href="/upload"
                  data-testid="home-bottom-upload-cta"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2648DB] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1E3BC0] sm:text-base"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Choose a video</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </a>
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
