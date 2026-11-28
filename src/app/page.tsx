import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Download,
  Film,
  Play,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { ClipCaptionsLockup } from "@/components/ClipCaptionsLogo";
import { HomeCinematicSequence } from "@/components/HomeCinematicSequence";
import { HomeHeroDemo } from "@/components/HomeHeroDemo";
import { HomeStyleGallery } from "@/components/HomeStyleGallery";
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

const USE_CASES = [
  {
    id: "reels",
    title: "Reels and Shorts",
    description: "Emphasize the words you want people to notice.",
    image: "/home/use-case-reels.jpg",
    alt: "Creator filming a vertical short-form video outdoors at golden hour",
    captionStyle: "pill" as const,
  },
  {
    id: "podcasts",
    title: "Podcasts and interviews",
    description: "Turn a conversation excerpt into a captioned clip.",
    image: "/home/use-case-podcast.jpg",
    alt: "Two podcast hosts talking into broadcast microphones in a warm studio",
    captionStyle: "boxed" as const,
  },
  {
    id: "tutorials",
    title: "Tutorials and explainers",
    description: "Make instructions easy to follow with the sound off.",
    image: "/home/use-case-tutorial.jpg",
    alt: "Instructor at a studio desk demonstrating a camera lens next to a laptop",
    captionStyle: "clean" as const,
  },
] as const;

const FAQ_GETTING_STARTED = [
  {
    q: "What does ClipCaptions do?",
    a: "ClipCaptions transcribes your uploaded video or audio clip into word-timed captions, lets you edit the transcript and visual style in your browser, and renders a burned-in MP4 video ready to post.",
  },
  {
    q: "Can I try the sample without an account?",
    a: "Yes. You can play the demo right on this page or open Sample Studio to edit lines, try presets, and test all 10 bundled fonts without creating an account.",
  },
  {
    q: "What video and audio files can I upload?",
    a: "Private uploads accept MP4, MOV, MP3, and WAV files. Audio-only uploads are automatically placed on a clean 9:16 portrait stage for MP4 export.",
  },
  {
    q: "What are the upload limits?",
    a: "Each clip can be up to 150 MB and up to 3 minutes long. Uploads use resumable chunked transfers so flaky connections can pause and resume cleanly.",
  },
  {
    q: "What happens to my uploaded clip?",
    a: "Your clip is stored in private per-account storage accessible only to you via short-lived signed links, processed by the media worker for transcription, and used directly from your original file when rendering MP4 exports.",
  },
] as const;

const FAQ_EDITING_EXPORT = [
  {
    q: "Can I correct words and adjust their timing?",
    a: "Yes. Click any cue in the transcript to fix names or phrasing inline, open Edit words or Timing for exact timestamps, or switch to the full-width waveform timeline to drag boundaries, split, and merge cues.",
  },
  {
    q: "Can I change fonts, colors, and caption styles?",
    a: "Yes. Choose from 16 built-in presets, 10 bundled fonts (including Poppins, Montserrat, Bebas Neue, Inter, Oswald, Archivo Black, Playfair Display, Space Mono, DM Serif, and Noto Sans Devanagari), and custom colors for text, highlight box, background, outline, and shadow.",
  },
  {
    q: "Can I caption or translate footage in Hindi?",
    a: "Yes. Signed-in projects can translate captions to Hindi (Devanagari) or Hinglish, switch to the bundled Noto Sans Devanagari font, and export burned-in MP4s with full HarfBuzz Devanagari shaping.",
  },
  {
    q: "Which MP4 resolutions can I download?",
    a: "You can export H.264/AAC MP4 at 240p, 360p, 480p, 720p, 1080p, 1440p, or 2160p (4K) up to your clip's source resolution without upscaling, preserving aspect ratio, rotation, and audio.",
  },
  {
    q: "What does AI Assist send to Google when I use it?",
    a: "AI Assist is optional and only available on signed-in projects. When you run Polish, Translate, or Social Kit, ClipCaptions sends only your project's caption text, cue timestamps, and project title to Google's Gemini API — never your video or audio file.",
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
        {/* 1. CINEMATIC FIRST SCREEN */}
        <section
          data-testid="home-open-hero"
          className="mx-auto max-w-6xl px-4 pb-8 pt-2.5 sm:px-6 sm:pb-14 sm:pt-7 lg:px-8 lg:pb-16 lg:pt-9"
        >
          <div className="grid grid-cols-1 items-center gap-3.5 sm:gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:gap-12">
            <div className="max-w-xl">
              <h1 className="text-[1.85rem] font-extrabold leading-[1.04] tracking-[-0.04em] text-ink sm:text-5xl lg:text-[3.9rem] lg:leading-[1.0] xl:text-[4.3rem]">
                <span className="cc-hero-line-1">Add captions</span>
                <span className="cc-hero-line-2">that move with</span>
                <span className="cc-hero-line-3 text-accent-hover">
                  every word.
                </span>
              </h1>

              <p
                data-testid="home-hero-subcopy"
                className="cc-hero-sub mt-2 max-w-lg text-[13px] leading-relaxed text-ink-secondary sm:mt-4 sm:text-base lg:text-[1.08rem] lg:leading-relaxed"
              >
                {HOMEPAGE_SUBHEADLINE}
              </p>

              <div className="cc-hero-actions mt-3 flex flex-wrap items-center gap-2.5 sm:mt-7 sm:gap-3.5">
                {user ? (
                  <Link
                    href="/upload"
                    prefetch={false}
                    data-testid="home-upload-cta"
                    className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-page hover:bg-accent-hover sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-base"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span>Upload a clip</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                ) : (
                  <a
                    href="/upload"
                    data-testid="home-upload-cta"
                    className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-page hover:bg-accent-hover sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-base"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span>Upload a clip</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </a>
                )}

                <Link
                  href="/studio"
                  data-testid="home-sample-cta"
                  className="cc-card-interactive inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-panel px-4 py-2.5 text-sm font-semibold text-ink hover:border-ink/30 hover:bg-elevated sm:px-5 sm:py-3.5 sm:text-base"
                >
                  <Play className="h-4 w-4 shrink-0 fill-current" />
                  <span>Try a sample</span>
                </Link>
              </div>
            </div>

            <div className="cc-hero-stage flex justify-center lg:justify-end">
              <HomeHeroDemo />
            </div>
          </div>
        </section>

        {/* 2. STANDOUT SCROLL SEQUENCE: Original Shot -> Timed Word Close-Up -> Full Editor & Timeline */}
        <HomeCinematicSequence />

        {/* 3. CAPTION STYLES: Clean, Word Highlight, Bold */}
        <section
          id="styles"
          className="border-t border-ink/10 py-14 lg:py-24"
        >
          <MotionReveal
            variant="scale"
            className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"
          >
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Caption styles
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Give the same clip a different feel.
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                Compare Clean, Word Highlight, and Bold directly on the clip
                without losing your place.
              </p>
            </div>

            <HomeStyleGallery />
          </MotionReveal>
        </section>

        {/* 4. WHO IT'S FOR: Three Distinct Original Photos with Real Captions */}
        <section
          id="use-cases"
          data-testid="home-use-cases"
          className="border-t border-ink/10 bg-inset/45 py-14 lg:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  Who it&apos;s for
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  Built for every talking video you publish
                </h2>
              </div>
            </MotionReveal>

            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              {USE_CASES.map((item, idx) => (
                <MotionReveal
                  key={item.id}
                  delayMs={idx * 85}
                  variant="rise"
                  className="h-full"
                >
                  <article
                    data-testid={`use-case-card-${item.id}`}
                    className="cc-card-interactive flex h-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-panel"
                  >
                    <div className="cc-image-reveal relative aspect-[4/3] w-full overflow-hidden bg-inset">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.alt}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                      {/* Distinct Real Caption Example Overlaid on Each Photo */}
                      {item.captionStyle === "pill" && (
                        <div className="pointer-events-none absolute inset-x-3 bottom-3.5 flex flex-wrap justify-center gap-1 text-center text-xs font-extrabold uppercase tracking-tight">
                          <span className="rounded bg-black/75 px-1.5 py-0.5 text-ink">
                            HOOK
                          </span>
                          <span className="rounded bg-accent px-1.5 py-0.5 text-page">
                            VIEWERS
                          </span>
                          <span className="rounded bg-black/75 px-1.5 py-0.5 text-ink">
                            IN TWO SECONDS
                          </span>
                        </div>
                      )}

                      {item.captionStyle === "boxed" && (
                        <div className="pointer-events-none absolute inset-x-4 bottom-3.5 flex justify-center">
                          <span className="rounded-lg bg-[#101116]/90 px-3 py-1.5 text-center text-xs font-semibold text-ink shadow-lg">
                            &ldquo;That single{" "}
                            <span className="text-accent-hover underline decoration-accent decoration-2 underline-offset-2">
                              story
                            </span>{" "}
                            changed everything.&rdquo;
                          </span>
                        </div>
                      )}

                      {item.captionStyle === "clean" && (
                        <div className="pointer-events-none absolute inset-x-4 bottom-3.5 text-center">
                          <span className="text-xs font-bold text-ink drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                            Step 2: lock focus before{" "}
                            <span className="text-accent-hover">rolling</span>.
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-base font-bold tracking-tight text-ink">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                        {item.description}
                      </p>
                    </div>
                  </article>
                </MotionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* 5. HOW IT WORKS: Three Actual Product Views */}
        <section
          id="how-it-works"
          data-testid="home-how-it-works"
          className="border-t border-ink/10 py-14 lg:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="max-w-2xl">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                    How it works
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                    Three steps from raw clip to captioned MP4
                  </h2>
                </div>
                <span className="rounded-full border border-ink/12 bg-panel px-3 py-1 font-mono text-[11px] text-ink-secondary">
                  MP4 · MOV · MP3 · WAV · up to 150 MB / 3 min
                </span>
              </div>
            </MotionReveal>

            <ol className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Step 1: Upload your clip */}
              <MotionReveal delayMs={0} className="h-full">
                <li className="flex h-full flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-accent">
                        01
                      </span>
                      <span className="rounded bg-elevated px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                        Resumable TUS
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-ink">
                      Upload your clip
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      Drop an MP4, MOV, MP3, or WAV file (up to 150 MB and 3
                      minutes) and ClipCaptions generates word-synced captions
                      automatically.
                    </p>
                  </div>

                  {/* Product UI View 1: Upload Dropzone & Stage Strip */}
                  <div className="mt-4 rounded-xl border border-ink/10 bg-inset p-3 text-[11px]">
                    <div className="flex items-center justify-between text-ink">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Upload className="h-3.5 w-3.5 text-accent" />
                        <span>hook-take-02.mp4</span>
                      </span>
                      <span className="font-mono text-[10px] text-accent-hover">
                        100%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-track">
                      <div className="h-full w-full rounded-full bg-accent" />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-ink-secondary">
                      <span className="inline-flex items-center gap-1 text-ink">
                        <CheckCircle2 className="h-3 w-3 text-accent" />
                        <span>Uploaded</span>
                      </span>
                      <span>→ Transcribing</span>
                      <span>→ Ready</span>
                    </div>
                  </div>
                </li>
              </MotionReveal>

              {/* Step 2: Edit and style */}
              <MotionReveal delayMs={80} className="h-full">
                <li className="flex h-full flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-accent">
                        02
                      </span>
                      <span className="rounded bg-elevated px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                        16 presets · 10 fonts
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-ink">
                      Edit and style
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      Fix any word inline, fine-tune timing on the waveform, and
                      customize fonts, colors, or Hindi translation with live
                      autosave.
                    </p>
                  </div>

                  {/* Product UI View 2: Inline Cue + Style Controls */}
                  <div className="mt-4 space-y-2 rounded-xl border border-ink/10 bg-inset p-3 text-[11px]">
                    <div className="rounded-lg border border-accent/60 bg-panel px-2.5 py-1.5 text-ink">
                      <span className="block font-mono text-[9px] text-accent-hover">
                        0:00.6 – 0:04.2
                      </span>
                      <span>Great short-form clips hook viewers.</span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5 text-[10px]">
                      <span className="inline-flex items-center gap-1 rounded-md border border-ink/12 bg-panel px-2 py-1 text-ink-secondary">
                        <SlidersHorizontal className="h-3 w-3 text-accent" />
                        <span>Poppins · Pill</span>
                      </span>
                      <span className="rounded-md bg-accent-soft px-2 py-1 font-mono text-accent-hover">
                        Saved
                      </span>
                    </div>
                  </div>
                </li>
              </MotionReveal>

              {/* Step 3: Download your MP4 */}
              <MotionReveal delayMs={160} className="h-full">
                <li className="flex h-full flex-col justify-between rounded-2xl border border-ink/10 bg-panel p-5">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-accent">
                        03
                      </span>
                      <span className="rounded bg-elevated px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                        240p – 2160p (4K)
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-ink">
                      Download your MP4
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      Pick your resolution tier up to 4K and download a
                      burned-in H.264/AAC MP4 rendered from your original
                      uploaded media.
                    </p>
                  </div>

                  {/* Product UI View 3: Export Video Resolution Picker */}
                  <div className="mt-4 space-y-1.5 rounded-xl border border-ink/10 bg-inset p-3 font-mono text-[10px]">
                    <div className="flex items-center justify-between rounded-lg border border-accent bg-accent-soft px-2.5 py-1.5 text-ink">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-accent-hover">
                        <Film className="h-3 w-3" />
                        <span>1080p MP4</span>
                      </span>
                      <span>1080×1920</span>
                    </div>
                    <div className="flex items-center justify-between px-2.5 py-1 text-ink-secondary">
                      <span>2160p (4K) · 1440p · 720p</span>
                      <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-accent-hover">
                        <Download className="h-3 w-3" />
                        <span>Ready</span>
                      </span>
                    </div>
                  </div>
                </li>
              </MotionReveal>
            </ol>
          </div>
        </section>

        {/* 6. SUBSTANTIAL GROUPED FAQ */}
        <section
          id="faq"
          data-testid="home-faq"
          className="border-t border-ink/10 bg-inset/45 py-14 lg:py-24"
        >
          <MotionReveal className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                FAQ
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Questions before you upload
              </h2>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
              {/* Group 1: Getting started */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Getting started
                </h3>
                <div className="divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-panel">
                  {FAQ_GETTING_STARTED.map((item, idx) => (
                    <details
                      key={item.q}
                      open={idx === 0}
                      className="group px-5 py-4"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink transition hover:text-accent-hover [&::-webkit-details-marker]:hidden">
                        <span>{item.q}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                      </summary>
                      <p className="cc-details-body mt-2.5 text-xs leading-relaxed text-ink-secondary">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>

              {/* Group 2: Editing & export */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Editing &amp; export
                </h3>
                <div className="divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-panel">
                  {FAQ_EDITING_EXPORT.map((item) => (
                    <details key={item.q} className="group px-5 py-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink transition hover:text-accent-hover [&::-webkit-details-marker]:hidden">
                        <span>{item.q}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                      </summary>
                      <p className="cc-details-body mt-2.5 text-xs leading-relaxed text-ink-secondary">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </MotionReveal>
        </section>

        {/* 7. CLEAR ENDING CTA */}
        <section
          data-testid="home-final-cta"
          className="border-t border-ink/10 py-14 lg:py-20"
        >
          <MotionReveal
            variant="scale"
            className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8"
          >
            <div className="cc-stage-frame rounded-3xl border border-white/10 px-6 py-10 shadow-[0_24px_64px_rgba(0,0,0,0.45)] sm:px-10 sm:py-14">
              <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-4xl">
                Ready to caption your first clip?
              </h2>
              <p className="mx-auto mt-2.5 max-w-lg text-sm text-ink-secondary">
                Upload a video for automatic timed captions and MP4 export, or
                test the editor right away with our sample clip.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="/upload"
                  data-testid="home-bottom-upload-cta"
                  className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-page hover:bg-accent-hover sm:px-6 sm:py-3.5 sm:text-base"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Upload a clip</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </a>
                <Link
                  href="/studio"
                  data-testid="home-bottom-sample-cta"
                  className="cc-card-interactive inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-panel px-5 py-3 text-sm font-semibold text-ink hover:border-ink/30 hover:bg-elevated sm:px-6 sm:py-3.5 sm:text-base"
                >
                  <Play className="h-4 w-4 shrink-0 fill-current" />
                  <span>Try a sample</span>
                </Link>
              </div>
            </div>
          </MotionReveal>
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
