import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Download,
  Play,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from "lucide-react";
import { ClipCaptionsLockup } from "@/components/ClipCaptionsLogo";
import { HomeCreatorGallery } from "@/components/HomeCreatorGallery";
import { HomeInteractiveShowcase } from "@/components/HomeInteractiveShowcase";
import { MotionReveal } from "@/components/MotionReveal";
import { PublicHeader } from "@/components/PublicHeader";
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

const PROCESS_STEPS = [
  { num: "01", label: "Upload", icon: Upload },
  { num: "02", label: "Caption", icon: Sparkles },
  { num: "03", label: "Edit", icon: SlidersHorizontal },
  { num: "04", label: "Export", icon: Download },
] as const;

const FAQ_ITEMS = [
  {
    q: "Can I try ClipCaptions without creating an account?",
    a: "Yes. Use the interactive showcase above or open the sample editor to edit lines, switch styles, and preview all 10 bundled fonts without signing in. An account is only needed to upload your own clips and export MP4s.",
  },
  {
    q: "What file types and upload limits are supported?",
    a: "Private uploads accept MP4, MOV, MP3, and WAV files up to 150 MB and 3 minutes long, using chunked transfers that resume automatically if your connection drops.",
  },
  {
    q: "Can I fix misheard words and adjust caption timing?",
    a: "Yes. Edit any caption line inline, adjust individual word timestamps, or drag cue boundaries, split, and merge lines on the waveform timeline with automatic saving.",
  },
  {
    q: "Which fonts, presets, and languages are included?",
    a: "Choose from 16 built-in presets, save your own reusable styles, and pick from 10 bundled fonts including Poppins, Montserrat, Bebas Neue, Inter, Oswald, Archivo Black, Playfair Display, Space Mono, DM Serif, and Noto Sans Devanagari.",
  },
  {
    q: "Does ClipCaptions support Hindi captions and MP4 export?",
    a: "Yes. Signed-in projects can translate captions into Hindi (Devanagari) or Hinglish, style them with Noto Sans Devanagari, and export burned-in MP4s with full HarfBuzz Devanagari shaping.",
  },
  {
    q: "What MP4 resolutions can I export?",
    a: "Export burned-in H.264/AAC MP4 at 240p, 360p, 480p, 720p, 1080p, 1440p, or 2160p (4K) up to your uploaded video's source resolution without upscaling, preserving aspect ratio, rotation, and audio.",
  },
  {
    q: "How is my uploaded media stored and used?",
    a: "Uploaded clips are stored in private per-account storage accessible only to you via short-lived signed links, transcribed for your project, and rendered directly from your original file when exporting MP4s.",
  },
  {
    q: "What does AI Assist send to Google when I use it?",
    a: "AI Assist is optional and only available on signed-in projects. Running Polish, Translate, or Social Kit sends only your caption text, cue timestamps, and project title to Google's Gemini API — never your video or audio file.",
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
        {/* 1. CENTERED HERO + WIDE INTERACTIVE VIDEO SHOWCASE (#0B0B0F near-black + restrained violet light) */}
        <section
          data-testid="home-open-hero"
          className="cc-home-hero-glow mx-auto max-w-6xl px-4 pb-8 pt-2.5 text-center sm:px-6 sm:pb-12 sm:pt-3.5 lg:px-8 lg:pb-14 lg:pt-4"
        >
          <div className="mx-auto max-w-4xl">
            <h1 className="cc-hero-line text-[1.9rem] font-extrabold leading-[1.06] tracking-[-0.04em] text-ink sm:text-4xl lg:text-[3.05rem]">
              {HOMEPAGE_HEADLINE}
            </h1>

            <p
              data-testid="home-hero-subcopy"
              className="cc-hero-sub mx-auto mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-secondary sm:mt-2 sm:text-[15px]"
            >
              {HOMEPAGE_SUBHEADLINE}
            </p>

            <div className="cc-hero-actions mt-3 flex flex-wrap items-center justify-center gap-2.5 sm:mt-3.5 sm:gap-3">
              {user ? (
                <Link
                  href="/upload"
                  prefetch={false}
                  data-testid="home-upload-cta"
                  className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#0B0B0F] hover:bg-accent-hover sm:px-6 sm:py-3 sm:text-base"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Upload a clip</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              ) : (
                <a
                  href="/upload"
                  data-testid="home-upload-cta"
                  className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#0B0B0F] hover:bg-accent-hover sm:px-6 sm:py-3 sm:text-base"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Upload a clip</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </a>
              )}

              <Link
                href="/studio"
                data-testid="home-sample-cta"
                className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-[#181824] px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-white/15 hover:bg-[#222233] hover:ring-white/30 sm:px-5 sm:py-3 sm:text-base"
              >
                <Play className="h-4 w-4 shrink-0 fill-current" />
                <span>Try a sample</span>
              </Link>
            </div>
          </div>

          {/* Wide Video-Led Interactive Stage (Compare, Style, Edit, Export) */}
          <HomeInteractiveShowcase />
        </section>

        {/* 2. CREATOR GALLERY — Warm Pearl / Very Light Lavender (#F4F1FA) with dark text & playable clips */}
        <section
          id="gallery"
          data-testid="home-gallery-section"
          className="scroll-mt-20 bg-[#F4F1FA] py-14 text-[#14131E] lg:py-20"
        >
          <MotionReveal className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#14131E] sm:text-4xl">
                Built for every clip you publish
              </h2>
              <p className="mt-2 text-sm text-[#4A4860] sm:text-base">
                Pick a format below to play it with its caption look.
              </p>
            </div>

            <HomeCreatorGallery />
          </MotionReveal>
        </section>

        {/* 3. COMPACT VISUAL PROCESS STRIP — Return to near-black #0B0B0F */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-t border-white/10 bg-page py-10 lg:py-12"
        >
          <MotionReveal className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <ol className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {PROCESS_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.label} className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#15151E] px-3.5 py-1.5 text-xs font-semibold text-ink sm:text-sm">
                        <Icon className="h-3.5 w-3.5 text-accent" />
                        <span>{step.label}</span>
                      </span>
                      {idx < PROCESS_STEPS.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-ink-muted" />
                      )}
                    </li>
                  );
                })}
              </ol>

              <span className="font-mono text-[11px] text-ink-secondary">
                MP4 · MOV · MP3 · WAV · up to 150 MB / 3 min
              </span>
            </div>
          </MotionReveal>
        </section>

        {/* 4. ONE CLEAN FAQ ACCORDION */}
        <section
          id="faq"
          data-testid="home-faq"
          className="scroll-mt-20 border-t border-white/10 bg-page py-12 lg:py-16"
        >
          <MotionReveal className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                Questions &amp; details
              </h2>
              <p className="mt-1.5 text-sm text-ink-secondary">
                File limits, export options, Hindi support, and privacy.
              </p>
            </div>

            <div className="mt-7 divide-y divide-white/10 rounded-2xl bg-[#15151E]">
              {FAQ_ITEMS.map((item, idx) => (
                <details
                  key={item.q}
                  open={idx === 0}
                  className="group px-5 py-4"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink transition hover:text-accent [&::-webkit-details-marker]:hidden">
                    <span>{item.q}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-ink-secondary transition-transform group-hover:text-ink group-open:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <p className="cc-details-body mt-2.5 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </MotionReveal>
        </section>

        {/* 5. CLOSING CTA */}
        <section
          data-testid="home-final-cta"
          className="border-t border-white/10 bg-page pb-14 pt-6 lg:pb-20"
        >
          <MotionReveal
            variant="scale"
            className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8"
          >
            <div className="cc-home-final-cta rounded-3xl px-6 py-10 shadow-[0_28px_72px_rgba(0,0,0,0.55)] sm:px-10 sm:py-14">
              <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-4xl">
                Caption your first clip
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-secondary">
                Upload a video or try the sample editor right in your browser.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="/upload"
                  data-testid="home-bottom-upload-cta"
                  className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[#0B0B0F] hover:bg-accent-hover sm:px-6 sm:py-3.5 sm:text-base"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Upload a clip</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </a>
                <Link
                  href="/studio"
                  data-testid="home-bottom-sample-cta"
                  className="cc-card-interactive inline-flex items-center gap-2 rounded-xl bg-[#181824] px-5 py-3 text-sm font-semibold text-ink ring-1 ring-white/18 hover:bg-[#222233] sm:px-6 sm:py-3.5 sm:text-base"
                >
                  <Play className="h-4 w-4 shrink-0 fill-current" />
                  <span>Try a sample</span>
                </Link>
              </div>
            </div>
          </MotionReveal>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-page py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-ink-secondary sm:px-6 lg:px-8">
          <ClipCaptionsLockup markSize={24} compact />
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-5"
          >
            <a href="#showcase" className="transition hover:text-ink">
              Demo
            </a>
            <a href="#gallery" className="transition hover:text-ink">
              Gallery
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
