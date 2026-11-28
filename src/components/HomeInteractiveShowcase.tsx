"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  SAMPLE_CAPTIONS,
  SAMPLE_CLIP,
  formatTime,
  getActiveCue,
  getActiveWord,
  type CaptionCue,
} from "@/lib/captions";
import {
  BUILTIN_STYLE_TEMPLATES,
  type BuiltInStyleTemplate,
} from "@/lib/caption-editor";
import { CaptionOverlay } from "@/components/CaptionOverlay";

type ShowcaseTabId = "compare" | "style" | "edit" | "export";
type StyleChoiceId = "clean" | "word-highlight" | "bold";

const TABS: ReadonlyArray<{ id: ShowcaseTabId; label: string }> = [
  { id: "compare", label: "Compare" },
  { id: "style", label: "Style" },
  { id: "edit", label: "Edit" },
  { id: "export", label: "Export" },
];

const STYLE_CHOICES: ReadonlyArray<{
  id: StyleChoiceId;
  label: string;
  templateId: string;
}> = [
  { id: "clean", label: "Clean", templateId: "clean" },
  { id: "word-highlight", label: "Word Highlight", templateId: "word-highlight" },
  { id: "bold", label: "Bold", templateId: "punch-display" },
];

const INITIAL_EDIT_WORD = "too";
const FIXED_EDIT_WORD = "two";

export function HomeInteractiveShowcase() {
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const exportVideoRef = useRef<HTMLVideoElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [activeTab, setActiveTab] = useState<ShowcaseTabId>("compare");
  const [comparison, setComparison] = useState<"captioned" | "original">(
    "captioned"
  );
  const [selectedStyleId, setSelectedStyleId] =
    useState<StyleChoiceId>("word-highlight");
  const [editWord, setEditWord] = useState(INITIAL_EDIT_WORD);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0.72);
  const [duration, setDuration] = useState(SAMPLE_CLIP.duration);
  const [initialized, setInitialized] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const styleMap = useMemo(() => {
    const map: Record<StyleChoiceId, BuiltInStyleTemplate> = {
      clean:
        BUILTIN_STYLE_TEMPLATES.find((t) => t.id === "clean") ??
        BUILTIN_STYLE_TEMPLATES[0],
      "word-highlight":
        BUILTIN_STYLE_TEMPLATES.find((t) => t.id === "word-highlight") ??
        BUILTIN_STYLE_TEMPLATES[0],
      bold:
        BUILTIN_STYLE_TEMPLATES.find((t) => t.id === "punch-display") ??
        BUILTIN_STYLE_TEMPLATES[0],
    };
    return map;
  }, []);

  const activeTemplate = styleMap[selectedStyleId];

  // Build live edited cue for Edit tab using actual CaptionOverlay behavior
  const liveEditedCue: CaptionCue = useMemo(() => {
    const base = SAMPLE_CAPTIONS[0];
    const replacement = editWord.trim() || "___";
    return {
      ...base,
      text: `Great short-form clips hook viewers in ${replacement} seconds.`,
      words: base.words.map((w) =>
        w.id === "c1-w7" ? { ...w, text: replacement } : w
      ),
    };
  }, [editWord]);

  const activeCue = useMemo(() => {
    if (activeTab === "edit") return liveEditedCue;
    return getActiveCue(SAMPLE_CAPTIONS, currentTime) ?? SAMPLE_CAPTIONS[0];
  }, [activeTab, currentTime, liveEditedCue]);

  const activeWord = useMemo(() => {
    if (activeTab === "edit") {
      return liveEditedCue.words.find((w) => w.id === "c1-w7") ?? null;
    }
    return getActiveWord(activeCue, currentTime);
  }, [activeTab, activeCue, currentTime, liveEditedCue]);

  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    const tick = () => {
      const video = mainVideoRef.current;
      if (video) setCurrentTime(video.currentTime);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying]);

  const selectTab = useCallback((nextTab: ShowcaseTabId, focusTab = false) => {
    // Keep only one video playing at a time
    if (nextTab === "export") {
      mainVideoRef.current?.pause();
    } else {
      exportVideoRef.current?.pause();
    }
    setActiveTab(nextTab);
    if (focusTab) {
      const idx = TABS.findIndex((t) => t.id === nextTab);
      if (idx >= 0) tabRefs.current[idx]?.focus();
    }
  }, []);

  const stepTab = useCallback(
    (delta: number) => {
      const curIdx = TABS.findIndex((t) => t.id === activeTab);
      const nextIdx = (curIdx + delta + TABS.length) % TABS.length;
      selectTab(TABS[nextIdx].id);
    },
    [activeTab, selectTab]
  );

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      selectTab(TABS[(idx + 1) % TABS.length].id, true);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      selectTab(TABS[(idx + TABS.length - 1) % TABS.length].id, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectTab(TABS[0].id, true);
    } else if (e.key === "End") {
      e.preventDefault();
      selectTab(TABS[TABS.length - 1].id, true);
    }
  };

  const togglePlay = useCallback(async () => {
    const video = mainVideoRef.current;
    if (!video) return;
    setMediaError(null);
    exportVideoRef.current?.pause();
    if (video.paused || video.ended) {
      if (video.ended || video.currentTime >= duration - 0.05) {
        video.currentTime = 0;
        setCurrentTime(0);
      }
      try {
        await video.play();
      } catch {
        video.muted = true;
        setIsMuted(true);
        try {
          await video.play();
        } catch {
          setMediaError("Demo clip could not start playback.");
        }
      }
    } else {
      video.pause();
    }
  }, [duration]);

  const toggleMute = useCallback(() => {
    const video = mainVideoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const seekTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(duration, next));
      const video = mainVideoRef.current;
      if (video) video.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [duration]
  );

  const handleLoadedMetadata = useCallback(() => {
    const video = mainVideoRef.current;
    if (!video) return;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      setDuration(video.duration);
    }
    if (!initialized) {
      video.currentTime = 0.72;
      setCurrentTime(0.72);
      setInitialized(true);
    }
  }, [initialized]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isWordFixed = editWord.trim().toLowerCase() === FIXED_EDIT_WORD;
  const isWordModified = editWord !== INITIAL_EDIT_WORD;
  const showCaptions = activeTab !== "compare" || comparison === "captioned";

  return (
    <div
      id="showcase"
      data-testid="home-interactive-showcase"
      className="cc-hero-stage mx-auto mt-4 w-full max-w-5xl sm:mt-6"
    >
      {/* Top Bar: Four Direct Tool Controls + Previous / Next (Completely independent of scroll) */}
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-2.5">
        <div
          role="tablist"
          aria-label="Interactive ClipCaptions showcase"
          data-testid="showcase-tablist"
          className="inline-flex flex-1 justify-between gap-1 rounded-2xl bg-[#15151E] p-1 sm:flex-none sm:justify-start"
        >
          {TABS.map((tab, idx) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`showcase-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="showcase-panel"
                tabIndex={selected ? 0 : -1}
                data-testid={`showcase-tab-${tab.id}`}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`flex-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition sm:flex-none sm:px-4 sm:py-2 sm:text-sm ${
                  selected
                    ? "bg-accent text-[#0B0B0F] shadow-sm"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="hidden items-center gap-1.5 sm:flex">
          <button
            type="button"
            data-testid="showcase-prev"
            onClick={() => stepTab(-1)}
            aria-label="Previous tool"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#15151E] text-ink-secondary transition hover:bg-[#222230] hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-testid="showcase-next"
            onClick={() => stepTab(1)}
            aria-label="Next tool"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#15151E] text-ink-secondary transition hover:bg-[#222230] hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Shared Wide Video-Led Stage with Restrained Violet Light Pool */}
      <div
        id="showcase-panel"
        role="tabpanel"
        aria-labelledby={`showcase-tab-${activeTab}`}
        data-testid="showcase-panel"
        data-active-tool={activeTab}
        className="cc-video-stage relative overflow-hidden rounded-[1.5rem] p-2.5 shadow-[0_32px_88px_rgba(0,0,0,0.68)] sm:rounded-[1.75rem] sm:p-4 lg:p-5"
      >
        {/* MAIN SAMPLE VIDEO STAGE (shared seamlessly across Compare, Style, and Edit — preserves playback position) */}
        <div
          className={
            activeTab === "export"
              ? "hidden"
              : `grid grid-cols-1 items-center gap-3.5 transition-all duration-200 motion-reduce:transition-none sm:gap-5 ${
                  activeTab === "compare"
                    ? "lg:grid-cols-1"
                    : activeTab === "style"
                      ? "lg:grid-cols-[minmax(0,1fr)_270px]"
                      : "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
                }`
          }
        >
          {/* EDIT TOOL: Transcript Panel slides alongside the reframed video */}
          {activeTab === "edit" && (
            <div
              data-testid="showcase-edit-panel"
              className="cc-panel-enter order-2 flex flex-col justify-between rounded-2xl bg-[#15151E]/95 p-4 text-left sm:p-5 lg:order-1"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-ink-secondary">
                    0:00.6 – 0:04.2
                  </span>
                  <span
                    data-testid="word-edit-status"
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      isWordFixed
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-accent/18 text-accent"
                    }`}
                  >
                    {isWordFixed ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Updated</span>
                      </>
                    ) : (
                      <span>Edit 1 word</span>
                    )}
                  </span>
                </div>

                <p className="mt-3 text-base leading-relaxed text-ink sm:text-lg">
                  <span>Great short-form clips hook viewers in </span>
                  <label htmlFor="showcase-word-input" className="sr-only">
                    Correct the misheard word
                  </label>
                  <input
                    id="showcase-word-input"
                    data-testid="word-edit-input"
                    type="text"
                    value={editWord}
                    maxLength={20}
                    onChange={(e) => setEditWord(e.target.value)}
                    aria-label="Edit caption word"
                    className={`mx-0.5 inline-block w-24 rounded-lg border px-2 py-0.5 text-center font-bold text-ink focus:outline-none focus:ring-2 focus:ring-accent ${
                      isWordFixed
                        ? "border-emerald-400/60 bg-emerald-500/15"
                        : "border-accent bg-accent/18"
                    }`}
                  />
                  <span> seconds.</span>
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {!isWordFixed && (
                    <button
                      type="button"
                      data-testid="word-edit-suggestion"
                      onClick={() => setEditWord(FIXED_EDIT_WORD)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-[#0B0B0F] transition hover:bg-accent-hover"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Fix to &ldquo;two&rdquo;</span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="word-edit-reset"
                    disabled={!isWordModified}
                    onClick={() => setEditWord(INITIAL_EDIT_WORD)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#222230] px-3.5 py-2 text-xs font-semibold text-ink-secondary transition hover:text-ink disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3.5 text-xs">
                <span className="text-ink-secondary">
                  Changes preview live on your video.
                </span>
                <Link
                  href="/studio"
                  data-testid="showcase-open-studio"
                  className="inline-flex items-center gap-1 font-semibold text-accent transition hover:text-accent-hover"
                >
                  <span>Full editor</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* SINGLE PERSISTENT VIDEO CANVAS (reframes cleanly across Compare / Style / Edit) */}
          <div
            className={`relative mx-auto w-full transition-all duration-200 motion-reduce:transition-none ${
              activeTab === "compare"
                ? "max-w-[780px]"
                : activeTab === "style"
                  ? "max-w-[620px]"
                  : "order-1 max-w-[520px] lg:order-2"
            }`}
          >
            <div
              className={`studio-stage-container relative w-full overflow-hidden rounded-2xl bg-[#0B0B0F] shadow-[0_18px_50px_rgba(0,0,0,0.62)] ${
                activeTab === "compare"
                  ? "aspect-[4/3.6] sm:aspect-auto sm:h-[345px] lg:h-[365px]"
                  : "aspect-[4/3.5] sm:aspect-auto sm:h-[345px] lg:h-[365px]"
              }`}
            >
              <video
                ref={mainVideoRef}
                data-testid="showcase-main-video"
                src={SAMPLE_CLIP.src}
                poster={SAMPLE_CLIP.poster}
                playsInline
                preload="auto"
                muted={isMuted}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={(e) => {
                  if (
                    !initialized &&
                    e.currentTarget.paused &&
                    e.currentTarget.currentTime === 0
                  ) {
                    return;
                  }
                  setCurrentTime(e.currentTarget.currentTime);
                }}
                onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onPlay={() => {
                  setMediaError(null);
                  setIsPlaying(true);
                }}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onError={() => setMediaError("Could not load demo video.")}
                onClick={() => void togglePlay()}
                className="h-full w-full cursor-pointer object-cover object-[50%_26%]"
              />

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 via-black/28 to-transparent" />

              {/* Compare Tool: Original / Captioned floating pill on the video */}
              {activeTab === "compare" && (
                <div
                  role="group"
                  aria-label="Compare original and captioned video"
                  data-testid="hero-compare-group"
                  className="absolute right-3 top-3 z-30 inline-flex rounded-full bg-[#0B0B0F]/85 p-0.5 text-xs font-semibold backdrop-blur-md"
                >
                  <button
                    type="button"
                    data-testid="hero-compare-original"
                    aria-pressed={comparison === "original"}
                    onClick={() => setComparison("original")}
                    className={`rounded-full px-3 py-1 transition ${
                      comparison === "original"
                        ? "bg-accent text-[#0B0B0F]"
                        : "text-ink-secondary hover:text-ink"
                    }`}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    data-testid="hero-compare-captioned"
                    aria-pressed={comparison === "captioned"}
                    onClick={() => setComparison("captioned")}
                    className={`rounded-full px-3 py-1 transition ${
                      comparison === "captioned"
                        ? "bg-accent text-[#0B0B0F]"
                        : "text-ink-secondary hover:text-ink"
                    }`}
                  >
                    Captioned
                  </button>
                </div>
              )}

              {/* Live Caption Layer (real CaptionOverlay component) */}
              {showCaptions && (
                <div
                  data-testid="hero-captioned-layer"
                  data-active-preset={selectedStyleId}
                  className="pointer-events-none absolute inset-0 z-20"
                >
                  <CaptionOverlay
                    activeCue={activeCue}
                    activeWord={activeWord}
                    preset={activeTemplate.style.preset}
                    fontSize={activeTemplate.style.fontSize}
                    verticalPosition={activeTemplate.style.verticalPosition}
                    accent={activeTemplate.style.accent}
                    styleConfig={activeTemplate.style}
                    currentTime={activeTab === "edit" ? 3.3 : currentTime}
                  />
                </div>
              )}

              {/* Center Play Button when paused */}
              {!isPlaying && (
                <button
                  type="button"
                  onClick={() => void togglePlay()}
                  aria-label="Play sample video"
                  className="absolute left-1/2 top-[46%] z-20 flex h-13 w-13 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0B0B0F]/75 text-ink shadow-xl backdrop-blur-md transition hover:scale-105 hover:bg-[#0B0B0F]/90 motion-reduce:transition-none"
                >
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </button>
              )}
            </div>

            {mediaError && (
              <div
                role="alert"
                className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-rose-950/90 px-3 py-2 text-xs text-rose-100"
              >
                <span className="inline-flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{mediaError}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMediaError(null);
                    mainVideoRef.current?.load();
                    void togglePlay();
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-white"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* Transport Bar */}
            <div
              data-testid="hero-transport-bar"
              className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-[#15151E]/95 px-3 py-2"
            >
              <button
                type="button"
                data-testid="hero-play-btn"
                onClick={() => void togglePlay()}
                aria-label={isPlaying ? "Pause clip" : "Play clip"}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-[#0B0B0F] transition hover:bg-accent-hover"
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                )}
              </button>

              <div className="relative flex h-5 min-w-0 flex-1 items-center">
                <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${Math.min(100, Math.max(0, progressPct))}%`,
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.05}
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  aria-label="Seek demo video"
                  className="studio-scrubber relative z-10 w-full"
                />
              </div>

              <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-secondary">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute clip" : "Mute clip"}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-secondary transition hover:text-ink"
              >
                {isMuted ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* STYLE TOOL: 3 Large Visual Swatches (Clean, Word Highlight, Bold) */}
          {activeTab === "style" && (
            <div
              data-testid="showcase-style-panel"
              className="cc-panel-enter flex flex-col gap-2.5"
            >
              <div
                role="radiogroup"
                aria-label="Caption styles"
                className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-2.5"
              >
                {STYLE_CHOICES.map((choice) => {
                  const selected = selectedStyleId === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-testid={`gallery-style-${choice.id}`}
                      onClick={() => setSelectedStyleId(choice.id)}
                      className={`flex flex-col items-center justify-center rounded-2xl p-2.5 text-center transition sm:p-3.5 ${
                        selected
                          ? "bg-[#222036] ring-2 ring-accent"
                          : "bg-[#15151E] hover:bg-[#1E1E2B]"
                      }`}
                    >
                      <div className="flex h-11 w-full items-center justify-center rounded-xl bg-[#0B0B0F] px-2">
                        {choice.id === "clean" && (
                          <span
                            style={{ fontFamily: '"Poppins", sans-serif' }}
                            className="text-sm font-bold text-ink"
                          >
                            Clean <span className="text-accent">type</span>
                          </span>
                        )}
                        {choice.id === "word-highlight" && (
                          <span
                            style={{ fontFamily: '"Poppins", sans-serif' }}
                            className="inline-flex items-center gap-1 text-xs font-extrabold uppercase"
                          >
                            <span className="rounded bg-accent px-1.5 py-0.5 text-[#0B0B0F]">
                              WORD
                            </span>
                            <span className="hidden text-ink sm:inline">
                              POP
                            </span>
                          </span>
                        )}
                        {choice.id === "bold" && (
                          <span
                            style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                            className="inline-flex items-center gap-1 text-lg tracking-wider text-white"
                          >
                            <span className="rounded bg-[#FACC15] px-1.5 text-black">
                              BOLD
                            </span>
                          </span>
                        )}
                      </div>
                      <span className="mt-2 text-xs font-semibold text-ink">
                        {choice.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <Link
                href="/studio"
                className="inline-flex items-center justify-center gap-1 pt-1 text-xs font-semibold text-accent transition hover:text-accent-hover"
              >
                <span>All 16 presets &amp; 10 fonts</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* EXPORT TOOL: Real Rendered ClipCaptions MP4 + Working Download */}
        {activeTab === "export" && (
          <div
            data-testid="showcase-export-panel"
            className="cc-panel-enter grid grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
          >
            <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl bg-[#0B0B0F] shadow-[0_18px_50px_rgba(0,0,0,0.62)] sm:max-w-[340px]">
              <video
                ref={exportVideoRef}
                data-testid="example-export-video"
                src="/home/clipcaptions-example-export.mp4"
                poster="/home/clipcaptions-example-poster.jpg"
                controls
                playsInline
                preload="metadata"
                className="aspect-[9/14] w-full object-cover object-[50%_26%] sm:aspect-[9/13]"
              />
            </div>

            <div className="flex flex-col items-start text-left">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                Rendered by ClipCaptions
              </span>
              <h3 className="mt-1.5 text-xl font-bold text-ink sm:text-2xl">
                Ready-to-post MP4 with burned-in captions.
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                Export up to your source resolution (240p–4K) with original
                audio and timing preserved.
              </p>

              <a
                href="/home/clipcaptions-example-export.mp4"
                download="clipcaptions-example.mp4"
                data-testid="download-example-mp4"
                className="cc-card-interactive mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[#0B0B0F] hover:bg-accent-hover"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span>Download example MP4</span>
              </a>

              <span className="mt-2.5 font-mono text-[11px] text-ink-secondary">
                720×1280 · H.264 / AAC · 1.5 MB
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
