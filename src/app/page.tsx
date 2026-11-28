import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Download,
  Film,
  Languages,
  Layers,
  Palette,
  Play,
  SlidersHorizontal,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";
import { ClipCaptionsLockup } from "@/components/ClipCaptionsLogo";
import { HomeCinematicSequence } from "@/components/HomeCinematicSequence";
import { HomeHeroDemo } from "@/components/HomeHeroDemo";
import { HomeStyleGallery } from "@/components/HomeStyleGallery";
import { HomeWordEditDemo } from "@/components/HomeWordEditDemo";
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
    q: "Do I need an account to try ClipCaptions?",
    a: "No. You can play the demo right on this page or open the sample editor to edit lines, switch presets, and try all 10 bundled fonts without signing in. You only need a free account to upload your own clips and export MP4 videos.",
  },
  {
    q: "What does ClipCaptions do?",
    a: "ClipCaptions transcribes your uploaded video or audio clip into word-timed captions, lets you fix words, adjust timing, and customize the look in your browser, and renders a burned-in MP4 ready to post.",
  },
  {
    q: "What video and audio file types can I upload?",
    a: "Private uploads accept MP4, MOV, MP3, and WAV files. Audio-only uploads are placed automatically on a 9:16 portrait stage so you can style and export them as captioned MP4s.",
  },
  {
    q: "What are the upload limits?",
    a: "Each uploaded clip can be up to 150 MB and up to 3 minutes long. Uploads use chunked transfers that resume automatically if your connection drops.",
  },
] as const;

const FAQ_EDITING_EXPORT = [
  {
    q: "Can I fix misheard words and adjust caption timing?",
    a: "Yes. Click any caption line in the transcript to fix names or phrasing inline, open Edit words or Timing for exact timestamps, or use the waveform timeline to drag cue edges, split, and merge lines.",
  },
  {
    q: "Can I change fonts, colors, and save my own style?",
    a: "Yes. Pick from 16 built-in presets and 10 bundled fonts (Poppins, Montserrat, Bebas Neue, Inter, Oswald, Archivo Black, Playfair Display, Space Mono, DM Serif, and Noto Sans Devanagari), customize text, highlight, outline, and shadow colors, and save reusable custom presets.",
  },
  {
    q: "Can I caption or translate videos into Hindi?",
    a: "Yes. Signed-in projects can translate captions into Hindi (Devanagari) or Hinglish, switch to the bundled Noto Sans Devanagari font, and export burned-in MP4s with full HarfBuzz Devanagari shaping.",
  },
  {
    q: "Which MP4 resolutions can I download?",
    a: "You can export H.264/AAC MP4 at 240p, 360p, 480p, 720p, 1080p, 1440p, or 2160p (4K) up to your uploaded video's source resolution without upscaling, preserving aspect ratio, rotation, and original audio.",
  },
] as const;

const FAQ_PRIVACY_AI = [
  {
    q: "What happens to my uploaded video or audio file?",
    a: "Your file is stored in private per-account storage accessible only to you via short-lived signed links. The worker transcribes it for your project and renders MP4 exports directly from your original uploaded media.",
  },
  {
    q: "What does AI Assist send to Google when I use it?",
    a: "AI Assist is optional and only available inside signed-in projects. When you run Polish, Translate, or Social Kit, ClipCaptions sends only your caption text, cue timestamps, and project title to Google's Gemini API — never your video or audio file.",
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
    <div className="cc-home-theme relative min-h-screen overflow-x-clip bg-page text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <PublicHeader userEmail={user?.email ?? null} />

      <main className="relative z-10">
        {/* 1. HERO — Bright-black #101014 with soft violet light behind the footage */}
        <section
          data-testid="home-open-hero"
          className="cc-home-hero-glow relative mx-auto max-w-6xl px-4 pb-6 pt-2 sm:px-6 sm:pb-10 sm:pt-4 lg:px-8 lg:pb-12 lg:pt-5"
        >
          <div className="grid grid-cols-1 items-center gap-3 sm:gap-7 lg:grid-cols-[minmax(0,1.12fr)_minmax(316px,0.88fr)] lg:gap-10">
            <div className="max-w-xl">
              <h1 className="text-[1.82rem] font-extrabold leading-[1.03] tracking-[-0.04em] text-ink sm:text-5xl lg:text-[3.8rem] lg:leading-[1.0] xl:text-[4.2rem]">
                <span className="cc-hero-line-1">Add animated</span>
                <span className="cc-hero-line-2">captions to</span>
                <span className="cc-hero-line-3 text-accent">
                  your videos.
                </span>
              </h1>

              <p
                data-testid="home-hero-subcopy"
                className="cc-hero-sub mt-2 max-w-lg text-[13px] leading-relaxed text-ink-secondary sm:mt-3.5 sm:text-base lg:text-[1.08rem] lg:leading-relaxed"
              >
                {HOMEPAGE_SUBHEADLINE}
              </p>

              <div className="cc-hero-actions mt-3 flex flex-wrap items-center gap-2.5 sm:mt-6 sm:gap-3.5">
                {user ? (
                  <Link
                    href="/upload"
                    prefetch={false}
                    data-testid="home-upload-cta"
                    className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#101014] hover:bg-accent-hover sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-base"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span>Upload a clip</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                ) : (
                  <a
                    href="/upload"
                    data-testid="home-upload-cta"
                    className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#101014] hover:bg-accent-hover sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-base"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span>Upload a clip</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </a>
                )}

                <Link
                  href="/studio"
                  data-testid="home-sample-cta"
                  className="cc-card-interactive inline-flex items-center gap-2 rounded-xl border border-white/20 bg-[#1D1D27] px-4 py-2.5 text-sm font-semibold text-ink hover:border-white/35 hover:bg-[#29283E] sm:px-5 sm:py-3.5 sm:text-base"
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

        {/* 2. FINISHED CLIPS — Brighter #29283E gallery with 4 distinct crops & caption treatments */}
        <section
          id="finished-clips"
          data-testid="home-finished-clips"
          className="scroll-mt-20 border-t border-white/10 bg-[#29283E] py-12 lg:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                    Finished clips
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                    Four clips, four caption looks that match the format
                  </h2>
                </div>
                <p className="max-w-sm text-xs leading-relaxed text-ink-secondary sm:text-sm">
                  Every format calls for a different balance of punch, pacing,
                  and legibility.
                </p>
              </div>
            </MotionReveal>

            {/* Asymmetric 4-Example Editorial Grid (different crops, minimal borders around media) */}
            <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Example 1: Street interview (tall 4:5 portrait crop) */}
              <MotionReveal delayMs={0} className="lg:col-span-5 lg:row-span-2">
                <article
                  data-testid="finished-clip-street"
                  className="flex h-full flex-col overflow-hidden rounded-2xl bg-[#1D1D27]/90 shadow-[0_20px_48px_rgba(0,0,0,0.28)]"
                >
                  <div className="cc-image-reveal relative aspect-[4/5] w-full flex-1 overflow-hidden bg-[#101014]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/home/use-case-reels.jpg"
                      alt="Creator filming a street interview outdoors at golden hour"
                      loading="lazy"
                      className="h-full w-full object-cover object-[50%_20%]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-5 bottom-6 flex flex-wrap justify-center gap-1.5 text-center text-xs font-extrabold uppercase tracking-tight sm:text-sm">
                      <span className="rounded bg-black/80 px-2 py-0.5 text-ink">
                        STOP
                      </span>
                      <span className="rounded bg-accent px-2 py-0.5 text-[#101014]">
                        SCROLLING
                      </span>
                      <span className="rounded bg-black/80 px-2 py-0.5 text-ink">
                        IN TWO SECONDS
                      </span>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-ink">
                        Street interview
                      </h3>
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                        Word Highlight
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      A moving violet pill keeps fast outdoor speech legible
                      over busy backgrounds and muted feeds.
                    </p>
                  </div>
                </article>
              </MotionReveal>

              {/* Example 2: Podcast (wide 16:9 crop) */}
              <MotionReveal delayMs={70} className="lg:col-span-7">
                <article
                  data-testid="finished-clip-podcast"
                  className="flex h-full flex-col overflow-hidden rounded-2xl bg-[#1D1D27]/90 shadow-[0_20px_48px_rgba(0,0,0,0.28)]"
                >
                  <div className="cc-image-reveal relative aspect-[16/9] w-full overflow-hidden bg-[#101014]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/home/use-case-podcast.jpg"
                      alt="Two podcast hosts speaking into broadcast microphones in a warm studio"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-5 bottom-5 flex justify-center">
                      <span className="rounded-xl bg-[#101014]/92 px-4 py-2 text-center text-xs font-semibold text-ink shadow-xl sm:text-sm">
                        &ldquo;That single{" "}
                        <span className="text-accent underline decoration-accent decoration-2 underline-offset-4">
                          conversation
                        </span>{" "}
                        changed the whole season.&rdquo;
                      </span>
                    </div>
                  </div>
                  <div className="p-4 sm:px-5 sm:py-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-ink">Podcast</h3>
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                        Boxed Quote
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      A soft dark backdrop plate separates multi-speaker
                      dialogue from studio lighting without covering faces.
                    </p>
                  </div>
                </article>
              </MotionReveal>

              {/* Example 3: Tutorial (4:3 crop) */}
              <MotionReveal delayMs={130} className="lg:col-span-3">
                <article
                  data-testid="finished-clip-tutorial"
                  className="flex h-full flex-col overflow-hidden rounded-2xl bg-[#1D1D27]/90 shadow-[0_20px_48px_rgba(0,0,0,0.28)]"
                >
                  <div className="cc-image-reveal relative aspect-[4/3] w-full overflow-hidden bg-[#101014]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/home/use-case-tutorial.jpg"
                      alt="Instructor demonstrating a camera lens at a studio desk"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-4 bottom-4 text-center">
                      <span className="text-xs font-bold text-ink drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                        Step 2: lock focus before{" "}
                        <span className="text-accent">rolling</span>.
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-sm font-bold text-ink">Tutorial</h3>
                      <span className="font-mono text-[10px] font-semibold uppercase text-accent">
                        Clean
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      Unobtrusive lower-third type keeps hands, lenses, and
                      screen steps unobstructed.
                    </p>
                  </div>
                </article>
              </MotionReveal>

              {/* Example 4: Product demo (4:3 crop) */}
              <MotionReveal delayMs={180} className="lg:col-span-4">
                <article
                  data-testid="finished-clip-product"
                  className="flex h-full flex-col overflow-hidden rounded-2xl bg-[#1D1D27]/90 shadow-[0_20px_48px_rgba(0,0,0,0.28)]"
                >
                  <div className="cc-image-reveal relative aspect-[4/3] w-full overflow-hidden bg-[#101014]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/home/use-case-product.jpg"
                      alt="Creator holding up a matte-black wireless microphone at a sunlit studio desk"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
                      <span
                        style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-black/80 px-2.5 py-0.5 text-base tracking-wider text-white sm:text-lg"
                      >
                        <span>STUDIO</span>
                        <span className="rounded bg-[#FACC15] px-1 text-black">
                          SOUND
                        </span>
                        <span>IN ONE CLIP</span>
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-sm font-bold text-ink">
                        Product demo
                      </h3>
                      <span className="font-mono text-[10px] font-semibold uppercase text-accent">
                        Bold Display
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      High-contrast condensed display type calls out key
                      benefits while the product stays centered.
                    </p>
                  </div>
                </article>
              </MotionReveal>
            </div>
          </div>
        </section>

        {/* 3. STYLE LAB — #101014 clean dark stage with compact swatches & always-visible player */}
        <section
          id="styles"
          className="scroll-mt-20 border-t border-white/10 bg-[#101014] py-12 lg:py-16"
        >
          <MotionReveal
            variant="scale"
            className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"
          >
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Style lab
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Switch looks live without restarting your clip
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                Compare Clean, Word Highlight, and Bold directly on the same
                video while playback keeps rolling.
              </p>
            </div>

            <HomeStyleGallery />
          </MotionReveal>
        </section>

        {/* 4. CINEMATIC EDITOR REVEAL — Deeper black #0B0B0F with direct Original / Captioned / Editor controls */}
        <HomeCinematicSequence />

        {/* 5. TRY EDITING A WORD — Hands-on local transcript correction */}
        <section
          id="try-edit"
          className="scroll-mt-20 border-t border-white/10 bg-[#16161D] py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Try editing a word
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Fix a misheard word and see the caption update instantly
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                Edit &ldquo;too&rdquo; to &ldquo;two&rdquo; below to test how
                inline corrections work right on the sample clip.
              </p>
            </div>

            <div className="mt-6">
              <HomeWordEditDemo />
            </div>
          </MotionReveal>
        </section>

        {/* 6. WHAT YOU CAN DO — Grounded capabilities + verified English/Hindi Devanagari showcase */}
        <section
          id="features"
          data-testid="home-capabilities"
          className="scroll-mt-20 border-t border-white/10 bg-[#101014] py-12 lg:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  What you can do
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  Built for fast fixes and consistent brand captions
                </h2>
              </div>
            </MotionReveal>

            {/* Row 1: Two wider spotlight features */}
            <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <MotionReveal delayMs={0}>
                <div className="flex h-full flex-col justify-between rounded-2xl bg-[#1D1D27] p-6">
                  <div>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
                      <Type className="h-4 w-4" />
                    </span>
                    <h3 className="mt-3 text-lg font-bold text-ink">
                      Timed transcripts &amp; word-level corrections
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                      Every line arrives synced to your speech. Click any cue to
                      fix names inline, open word-level timestamps, or drag cue
                      boundaries, split, and merge on the waveform timeline.
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-secondary">
                    <span className="rounded-lg bg-[#101014] px-2.5 py-1 text-ink">
                      0:00.64 → Great
                    </span>
                    <span className="rounded-lg bg-accent/20 px-2.5 py-1 text-accent">
                      0:00.96 → short-form
                    </span>
                    <span className="rounded-lg bg-[#101014] px-2.5 py-1 text-ink">
                      0:01.68 → clips
                    </span>
                  </div>
                </div>
              </MotionReveal>

              {/* English / Hindi Devanagari Translation Showcase */}
              <MotionReveal delayMs={70}>
                <div
                  data-testid="home-hindi-example"
                  className="flex h-full flex-col justify-between rounded-2xl bg-[#1D1D27] p-6"
                >
                  <div>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
                      <Languages className="h-4 w-4" />
                    </span>
                    <h3 className="mt-3 text-lg font-bold text-ink">
                      English &amp; Hindi translation with crisp Devanagari
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                      Translate signed-in projects into Hindi (Devanagari) or
                      Hinglish and render burned-in MP4s using our bundled Noto
                      Sans Devanagari font with full HarfBuzz shaping.
                    </p>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-[#101014] px-3 py-2.5 text-xs">
                      <span className="font-mono text-[10px] uppercase text-ink-muted">
                        English
                      </span>
                      <p className="mt-1 font-semibold text-ink">
                        Great short-form clips hook viewers in two seconds.
                      </p>
                    </div>
                    <div className="rounded-xl border border-accent/40 bg-[#101014] px-3 py-2.5 text-xs">
                      <span className="font-mono text-[10px] uppercase text-accent">
                        Hindi · Noto Sans Devanagari
                      </span>
                      <p
                        lang="hi"
                        style={{
                          fontFamily: '"Noto Sans Devanagari", sans-serif',
                        }}
                        className="mt-1 font-bold leading-snug text-ink"
                      >
                        बेहतरीन शॉर्ट क्लिप्स दो सेकंड में ध्यान खींचती हैं।
                      </p>
                    </div>
                  </div>
                </div>
              </MotionReveal>
            </div>

            {/* Row 2: Three focused capability strips */}
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
              <MotionReveal delayMs={40}>
                <div className="h-full rounded-2xl bg-[#1D1D27] p-5">
                  <div className="flex items-center gap-2.5">
                    <Palette className="h-4 w-4 text-accent" />
                    <h3 className="text-sm font-bold text-ink">
                      10 bundled fonts &amp; custom colors
                    </h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                    Style text, highlight pills, outlines, and shadows with
                    Poppins, Montserrat, Bebas Neue, Inter, Oswald, Archivo
                    Black, Playfair Display, Space Mono, DM Serif, and Noto Sans
                    Devanagari.
                  </p>
                </div>
              </MotionReveal>

              <MotionReveal delayMs={90}>
                <div className="h-full rounded-2xl bg-[#1D1D27] p-5">
                  <div className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4 text-accent" />
                    <h3 className="text-sm font-bold text-ink">
                      16 built-in &amp; reusable custom presets
                    </h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                    Start from 16 built-in looks or save your own font, color,
                    and positioning setup as a reusable preset for future clips.
                  </p>
                </div>
              </MotionReveal>

              <MotionReveal delayMs={140}>
                <div className="h-full rounded-2xl bg-[#1D1D27] p-5">
                  <div className="flex items-center gap-2.5">
                    <SlidersHorizontal className="h-4 w-4 text-accent" />
                    <h3 className="text-sm font-bold text-ink">
                      Waveform timing &amp; live autosave
                    </h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                    Follow playback automatically, scrub word-by-word, and keep
                    every revision saved automatically in your account.
                  </p>
                </div>
              </MotionReveal>
            </div>
          </div>
        </section>

        {/* 7. HOW IT WORKS — One project progressing through 4 steps */}
        <section
          id="how-it-works"
          data-testid="home-how-it-works"
          className="scroll-mt-20 border-t border-white/10 bg-[#16161D] py-12 lg:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <MotionReveal>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="max-w-2xl">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                    How it works
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                    One clip, four clear steps to a finished MP4
                  </h2>
                </div>
                <span className="rounded-full bg-[#1D1D27] px-3.5 py-1.5 font-mono text-[11px] text-ink-secondary">
                  MP4 · MOV · MP3 · WAV · up to 150 MB / 3 min
                </span>
              </div>
            </MotionReveal>

            <ol className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Step 1: Upload */}
              <MotionReveal delayMs={0} className="h-full">
                <li className="flex h-full flex-col justify-between rounded-2xl bg-[#1D1D27] p-4">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-accent">
                      01 · Upload
                    </span>
                    <h3 className="mt-1.5 text-base font-bold text-ink">
                      Drop your clip
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      Upload an MP4, MOV, MP3, or WAV file up to 150 MB and 3
                      minutes with auto-resuming transfers.
                    </p>
                  </div>
                  <div className="mt-4 rounded-xl bg-[#101014] p-3 text-[11px]">
                    <div className="flex items-center justify-between text-ink">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <Upload className="h-3.5 w-3.5 text-accent" />
                        <span>hook-take-02.mp4</span>
                      </span>
                      <span className="font-mono text-[10px] text-accent">
                        100%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-full rounded-full bg-accent" />
                    </div>
                  </div>
                </li>
              </MotionReveal>

              {/* Step 2: Automatic transcription */}
              <MotionReveal delayMs={60} className="h-full">
                <li className="flex h-full flex-col justify-between rounded-2xl bg-[#1D1D27] p-4">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-accent">
                      02 · Transcribe
                    </span>
                    <h3 className="mt-1.5 text-base font-bold text-ink">
                      Automatic transcription
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      ClipCaptions converts your spoken audio into word-timed
                      caption cues automatically.
                    </p>
                  </div>
                  <div className="mt-4 space-y-1.5 rounded-xl bg-[#101014] p-3 text-[10px]">
                    <div className="flex items-center justify-between text-ink">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="h-3 w-3 text-accent" />
                        <span>5 timed cues ready</span>
                      </span>
                      <span className="font-mono text-ink-muted">0:17.6</span>
                    </div>
                    <div className="flex flex-wrap gap-1 font-mono text-[9px] text-ink-secondary">
                      <span className="rounded bg-[#1D1D27] px-1.5 py-0.5">
                        Great
                      </span>
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-accent">
                        short-form
                      </span>
                      <span className="rounded bg-[#1D1D27] px-1.5 py-0.5">
                        clips
                      </span>
                    </div>
                  </div>
                </li>
              </MotionReveal>

              {/* Step 3: Edit */}
              <MotionReveal delayMs={120} className="h-full">
                <li className="flex h-full flex-col justify-between rounded-2xl bg-[#1D1D27] p-4">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-accent">
                      03 · Edit
                    </span>
                    <h3 className="mt-1.5 text-base font-bold text-ink">
                      Fix words &amp; pick a look
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      Correct phrasing inline, nudge timing on the waveform, and
                      choose your font, preset, or Hindi translation.
                    </p>
                  </div>
                  <div className="mt-4 space-y-1.5 rounded-xl bg-[#101014] p-3 text-[10px]">
                    <div className="rounded-lg border border-accent/60 bg-[#1D1D27] px-2 py-1 text-ink">
                      Great short-form clips hook viewers.
                    </div>
                    <div className="flex items-center justify-between text-ink-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-accent" />
                        <span>Word Highlight</span>
                      </span>
                      <span className="font-mono text-accent">Saved</span>
                    </div>
                  </div>
                </li>
              </MotionReveal>

              {/* Step 4: Export */}
              <MotionReveal delayMs={180} className="h-full">
                <li className="flex h-full flex-col justify-between rounded-2xl bg-[#1D1D27] p-4">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-accent">
                      04 · Export
                    </span>
                    <h3 className="mt-1.5 text-base font-bold text-ink">
                      Download your MP4
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      Choose a resolution up to your clip&apos;s source quality
                      and download a ready-to-post burned-in MP4.
                    </p>
                  </div>
                  <div className="mt-4 space-y-1.5 rounded-xl bg-[#101014] p-3 font-mono text-[10px]">
                    <div className="flex items-center justify-between rounded-lg border border-accent bg-accent/15 px-2 py-1 text-ink">
                      <span className="inline-flex items-center gap-1 font-semibold text-accent">
                        <Film className="h-3 w-3" />
                        <span>1080p MP4</span>
                      </span>
                      <span>1080×1920</span>
                    </div>
                    <div className="flex items-center justify-between px-1 text-ink-secondary">
                      <span>240p – 4K</span>
                      <span className="inline-flex items-center gap-1 font-sans font-semibold text-accent">
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

        {/* 8. EXPORT EXAMPLE — Real playable ClipCaptions MP4 + direct download */}
        <section
          id="export-example"
          data-testid="home-export-example"
          className="scroll-mt-20 border-t border-white/10 bg-[#101014] py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-8 rounded-3xl bg-[#1D1D27] p-6 sm:p-8 lg:grid-cols-[minmax(0,1.1fr)_300px] lg:gap-10">
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  Export example
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  See a real MP4 exported by ClipCaptions
                </h2>
                <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-secondary">
                  This example clip was rendered directly with burned-in Poppins
                  word-highlight captions and original audio. Download it to
                  inspect the sharpness, timing, and playback on your own
                  device.
                </p>

                <p className="mt-3 max-w-xl text-xs leading-relaxed text-ink-secondary">
                  Available export resolutions (240p, 360p, 480p, 720p, 1080p,
                  1440p, and 2160p 4K) depend on your uploaded video —
                  ClipCaptions never upscales past your source resolution and
                  preserves aspect ratio, rotation, and audio.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a
                    href="/home/clipcaptions-example-export.mp4"
                    download="clipcaptions-example.mp4"
                    data-testid="download-example-mp4"
                    className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[#101014] hover:bg-accent-hover"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    <span>Download example MP4</span>
                  </a>
                  <span className="font-mono text-[11px] text-ink-secondary">
                    720×1280 · H.264 / AAC · 1.5 MB
                  </span>
                </div>
              </div>

              {/* Playable Burned-In Example MP4 */}
              <div className="mx-auto w-full max-w-[260px] lg:max-w-[280px]">
                <div className="overflow-hidden rounded-2xl bg-[#101014] shadow-[0_20px_48px_rgba(0,0,0,0.5)]">
                  <video
                    data-testid="example-export-video"
                    src="/home/clipcaptions-example-export.mp4"
                    poster="/home/clipcaptions-example-poster.jpg"
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-[9/16] w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </MotionReveal>
        </section>

        {/* 9. GROUPED FAQ — 10 verified questions under 3 clear groups */}
        <section
          id="faq"
          data-testid="home-faq"
          className="scroll-mt-20 border-t border-white/10 bg-[#16161D] py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                FAQ
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Practical answers before you upload
              </h2>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Group 1: Getting started */}
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                  Getting started
                </h3>
                <div className="divide-y divide-white/10 rounded-2xl bg-[#1D1D27]">
                  {FAQ_GETTING_STARTED.map((item, idx) => (
                    <details
                      key={item.q}
                      open={idx === 0}
                      className="group px-4 py-3.5"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink transition hover:text-accent [&::-webkit-details-marker]:hidden">
                        <span>{item.q}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-ink-secondary transition-transform group-hover:text-ink group-open:rotate-180 motion-reduce:transition-none" />
                      </summary>
                      <p className="cc-details-body mt-2 text-xs leading-relaxed text-ink-secondary">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>

              {/* Group 2: Editing and export */}
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                  Editing and export
                </h3>
                <div className="divide-y divide-white/10 rounded-2xl bg-[#1D1D27]">
                  {FAQ_EDITING_EXPORT.map((item) => (
                    <details key={item.q} className="group px-4 py-3.5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink transition hover:text-accent [&::-webkit-details-marker]:hidden">
                        <span>{item.q}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-ink-secondary transition-transform group-hover:text-ink group-open:rotate-180 motion-reduce:transition-none" />
                      </summary>
                      <p className="cc-details-body mt-2 text-xs leading-relaxed text-ink-secondary">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>

              {/* Group 3: Privacy and AI */}
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                  Privacy and AI
                </h3>
                <div className="divide-y divide-white/10 rounded-2xl bg-[#1D1D27]">
                  {FAQ_PRIVACY_AI.map((item) => (
                    <details key={item.q} className="group px-4 py-3.5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink transition hover:text-accent [&::-webkit-details-marker]:hidden">
                        <span>{item.q}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-ink-secondary transition-transform group-hover:text-ink group-open:rotate-180 motion-reduce:transition-none" />
                      </summary>
                      <p className="cc-details-body mt-2 text-xs leading-relaxed text-ink-secondary">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </MotionReveal>
        </section>

        {/* 10. BRIGHTER CLOSING CTA */}
        <section
          data-testid="home-final-cta"
          className="border-t border-white/10 bg-[#101014] py-12 lg:py-16"
        >
          <MotionReveal
            variant="scale"
            className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8"
          >
            <div className="cc-home-final-cta rounded-3xl px-6 py-10 shadow-[0_28px_72px_rgba(0,0,0,0.48)] sm:px-10 sm:py-14">
              <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-4xl">
                Caption your first clip
              </h2>
              <p className="mx-auto mt-2.5 max-w-lg text-sm text-ink-secondary">
                Upload a video for automatic timed captions and MP4 export, or
                explore the editor right away with our sample clip.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="/upload"
                  data-testid="home-bottom-upload-cta"
                  className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[#101014] hover:bg-accent-hover sm:px-6 sm:py-3.5 sm:text-base"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Upload a clip</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </a>
                <Link
                  href="/studio"
                  data-testid="home-bottom-sample-cta"
                  className="cc-card-interactive inline-flex items-center gap-2 rounded-xl border border-white/25 bg-[#1D1D27] px-5 py-3 text-sm font-semibold text-ink hover:border-white/40 hover:bg-[#29283E] sm:px-6 sm:py-3.5 sm:text-base"
                >
                  <Play className="h-4 w-4 shrink-0 fill-current" />
                  <span>Try a sample</span>
                </Link>
              </div>
            </div>
          </MotionReveal>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#101014] py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-ink-secondary sm:px-6 lg:px-8">
          <ClipCaptionsLockup markSize={24} compact />
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-5"
          >
            <a href="#styles" className="transition hover:text-ink">
              Styles
            </a>
            <a href="#how-it-works" className="transition hover:text-ink">
              How it works
            </a>
            <a href="#faq" className="transition hover:text-ink">
              FAQ
            </a>
            <Link href="/studio" className="transition hover:text-ink">
              Sample editor
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
