"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pause, Play, RotateCcw, Sparkles } from "lucide-react";

type SceneId = "add" | "style" | "edit";
type StyleLookId = "highlight" | "bold" | "clean";

const SCENES: ReadonlyArray<{
  id: SceneId;
  label: string;
  startSec: number;
  endSec: number;
}> = [
  { id: "add", label: "Add captions", startSec: 0, endSec: 4.5 },
  { id: "style", label: "Change the style", startSec: 4.5, endSec: 9.0 },
  { id: "edit", label: "Fix a word", startSec: 9.0, endSec: 13.5 },
];

const TOTAL_DURATION = 13.5;

const STYLE_SWATCHES: ReadonlyArray<{
  id: StyleLookId;
  label: string;
}> = [
  { id: "highlight", label: "Word Highlight" },
  { id: "bold", label: "Bold" },
  { id: "clean", label: "Clean" },
];

const CAPTION_WORDS = ["STUDIO", "SOUND", "IN", "ONE", "CLIP."];

export function HomeLiveShowcase() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);

  // Automatic sequence state
  const [elapsed, setElapsed] = useState(0);
  const [activeScene, setActiveScene] = useState<SceneId>("add");
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isRunning, setIsRunning] = useState(true);
  const [ended, setEnded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Interactive controls inside Scene 2 (Style) and Scene 3 (Edit)
  const [styleLook, setStyleLook] = useState<StyleLookId>("highlight");
  const [editWord, setEditWord] = useState("won");
  const [manualStyleChosen, setManualStyleChosen] = useState(false);
  const [manualEditChosen, setManualEditChosen] = useState(false);

  // Keep refs in sync for the animation loop
  const isRunningRef = useRef(true);
  const isAutoModeRef = useRef(true);
  const manualStyleRef = useRef(false);
  const manualEditRef = useRef(false);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);
  useEffect(() => {
    isAutoModeRef.current = isAutoMode;
  }, [isAutoMode]);
  useEffect(() => {
    manualStyleRef.current = manualStyleChosen;
  }, [manualStyleChosen]);
  useEffect(() => {
    manualEditRef.current = manualEditChosen;
  }, [manualEditChosen]);

  // Initialize muted inline video + check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) {
      setReducedMotion(true);
      setIsRunning(false);
      setIsAutoMode(false);
      return;
    }

    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.then === "function") {
      p.catch(() => {
        setAutoplayBlocked(true);
      });
    }
  }, []);

  // Pause showcase cleanly when another clip on the page starts playing
  useEffect(() => {
    const onPauseTour = () => {
      setIsRunning(false);
      videoRef.current?.pause();
    };
    window.addEventListener("clipcaptions:pause-tour", onPauseTour);
    return () =>
      window.removeEventListener("clipcaptions:pause-tour", onPauseTour);
  }, []);

  // Automatic ~13.5s 3-scene clock (only runs when isRunning && isAutoMode)
  useEffect(() => {
    if (!isRunning || !isAutoMode || reducedMotion) {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      return;
    }

    lastTsRef.current = performance.now();
    const tick = (now: number) => {
      if (!isRunningRef.current || !isAutoModeRef.current) return;
      const dt = Math.min(0.1, (now - lastTsRef.current) / 1000);
      lastTsRef.current = now;

      setElapsed((prev) => {
        const next = prev + dt;
        if (next >= TOTAL_DURATION) {
          setIsRunning(false);
          setEnded(true);
          setActiveScene("edit");
          if (!manualEditRef.current) setEditWord("one");
          videoRef.current?.pause();
          return TOTAL_DURATION;
        }

        if (next < 4.5) {
          setActiveScene("add");
        } else if (next < 9.0) {
          setActiveScene("style");
          if (!manualStyleRef.current) {
            const local = next - 4.5;
            if (local < 1.5) setStyleLook("highlight");
            else if (local < 3.1) setStyleLook("bold");
            else setStyleLook("clean");
          }
        } else {
          setActiveScene("edit");
          if (!manualEditRef.current) {
            setEditWord(next - 9.0 >= 1.8 ? "one" : "won");
          }
        }

        return next;
      });

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [isRunning, isAutoMode, reducedMotion]);

  // Direct scene selection: takes over from automatic advancement on first press
  const selectScene = useCallback((sceneId: SceneId, focusTab = false) => {
    setIsAutoMode(false);
    setEnded(false);
    setActiveScene(sceneId);

    if (sceneId === "add") {
      setElapsed(2.6);
    } else if (sceneId === "style") {
      setElapsed(6.2);
      if (!manualStyleRef.current) setStyleLook("bold");
    } else {
      setElapsed(11.4);
      if (!manualEditRef.current) setEditWord("one");
    }

    if (focusTab) {
      const idx = SCENES.findIndex((s) => s.id === sceneId);
      if (idx >= 0) tabRefs.current[idx]?.focus();
    }
  }, []);

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      selectScene(SCENES[(idx + 1) % SCENES.length].id, true);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      selectScene(SCENES[(idx + SCENES.length - 1) % SCENES.length].id, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectScene(SCENES[0].id, true);
    } else if (e.key === "End") {
      e.preventDefault();
      selectScene(SCENES[SCENES.length - 1].id, true);
    }
  };

  const togglePausePlay = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
      videoRef.current?.pause();
    } else {
      if (ended || elapsed >= TOTAL_DURATION - 0.05) {
        setElapsed(0);
        setEnded(false);
        setIsAutoMode(true);
        setActiveScene("add");
        setManualStyleChosen(false);
        setManualEditChosen(false);
        setStyleLook("highlight");
        setEditWord("won");
      }
      setIsRunning(true);
      const v = videoRef.current;
      if (v) {
        v.muted = true;
        v.play().catch(() => setAutoplayBlocked(true));
      }
    }
  }, [elapsed, ended, isRunning]);

  const replaySequence = useCallback(() => {
    setElapsed(0);
    setEnded(false);
    setIsAutoMode(true);
    setIsRunning(true);
    setActiveScene("add");
    setManualStyleChosen(false);
    setManualEditChosen(false);
    setStyleLook("highlight");
    setEditWord("won");
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.muted = true;
      v.play().catch(() => setAutoplayBlocked(true));
    }
  }, []);

  const chooseStyleManually = useCallback((look: StyleLookId) => {
    setIsAutoMode(false);
    setManualStyleChosen(true);
    setStyleLook(look);
    setActiveScene("style");
  }, []);

  // Derive Scene 1 ("Add captions") sub-states:
  // 0.0 - 0.6s: Opening finished captioned poster state
  // 0.6 - 1.5s: Brief original shot (no captions)
  // 1.5 - 4.5s: Timed words animate in word-by-word
  const inOriginalFlash =
    activeScene === "add" && isAutoMode && elapsed >= 0.6 && elapsed < 1.5;

  const activeWordIdx =
    activeScene === "add" && isAutoMode && elapsed >= 1.5
      ? Math.min(
          CAPTION_WORDS.length - 1,
          Math.floor(((elapsed - 1.5) / 2.8) * CAPTION_WORDS.length)
        )
      : 1; // "SOUND" highlighted on arrival & manual view

  const cleanedEditWord = editWord.trim() || "___";
  const isEditFixed = editWord.trim().toLowerCase() === "one";
  const progressPct = Math.min(100, Math.max(0, (elapsed / TOTAL_DURATION) * 100));

  return (
    <div
      data-testid="home-live-showcase"
      data-active-scene={activeScene}
      className="mt-4 w-full sm:mt-5"
    >
      {/* Top Bar: Direct 3-Scene Tablist + Pause/Play & Replay */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Live product showcase scenes"
          data-testid="showcase-tablist"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-[#181B25]/12 bg-white p-1"
        >
          {SCENES.map((scene, idx) => {
            const selected = activeScene === scene.id;
            return (
              <button
                key={scene.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`live-tab-${scene.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="live-showcase-panel"
                tabIndex={selected ? 0 : -1}
                data-testid={`showcase-scene-${scene.id}`}
                onClick={() => selectScene(scene.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3.5 sm:text-sm ${
                  selected
                    ? "bg-[#2648DB] text-white shadow-sm"
                    : "text-[#50566A] hover:bg-[#EEF2FF] hover:text-[#181B25]"
                }`}
              >
                {scene.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="showcase-pause-play"
            onClick={togglePausePlay}
            aria-label={isRunning ? "Pause showcase" : "Play showcase"}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#181B25]/15 bg-white px-3 text-xs font-semibold text-[#181B25] transition hover:border-[#2648DB]/45 hover:bg-[#EEF2FF]"
          >
            {isRunning ? (
              <>
                <Pause className="h-3.5 w-3.5 fill-current text-[#2648DB]" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current text-[#2648DB]" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="showcase-replay"
            onClick={replaySequence}
            aria-label="Replay showcase"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#181B25]/15 bg-white px-3 text-xs font-semibold text-[#181B25] transition hover:border-[#2648DB]/45 hover:bg-[#EEF2FF]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#2648DB]" />
            <span className="hidden sm:inline">Replay</span>
          </button>
        </div>
      </div>

      {/* Shared Charcoal #181B25 Stage with Distinct Composition Per Scene */}
      <div
        id="live-showcase-panel"
        role="tabpanel"
        aria-labelledby={`live-tab-${activeScene}`}
        data-testid="live-showcase-panel"
        className="relative overflow-hidden rounded-2xl bg-[#181B25] p-2.5 shadow-[0_24px_60px_rgba(24,27,37,0.18)] sm:rounded-[1.5rem] sm:p-3.5"
      >
        {/* Slim Progress Indicator */}
        <div className="mb-2.5 h-1 w-full overflow-hidden rounded-full bg-white/12">
          <div
            className="h-full rounded-full bg-[#2648DB]"
            style={{ width: `${progressPct.toFixed(1)}%` }}
          />
        </div>

        <div
          className={`grid grid-cols-1 items-center gap-3 sm:gap-4 ${
            activeScene === "add"
              ? "lg:grid-cols-1"
              : activeScene === "style"
                ? "lg:grid-cols-[minmax(0,1fr)_240px]"
                : "lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
          }`}
        >
          {/* SCENE 3 ("Fix a word"): Readable Transcript Panel beside the video */}
          {activeScene === "edit" && (
            <div
              data-testid="showcase-edit-transcript"
              className="order-2 flex flex-col justify-between rounded-xl bg-[#FAF7F0] p-4 text-left text-[#181B25] sm:p-5 lg:order-1 lg:h-[365px]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-[#50566A]">
                    0:01.2 – 0:04.0
                  </span>
                  <span
                    data-testid="showcase-edit-badge"
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      isEditFixed
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-[#EEF2FF] text-[#2648DB]"
                    }`}
                  >
                    {isEditFixed ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Updated</span>
                      </>
                    ) : (
                      <span>Misheard word</span>
                    )}
                  </span>
                </div>

                <p className="mt-4 text-lg font-bold leading-relaxed text-[#181B25] sm:text-xl">
                  <span>Studio sound in </span>
                  <label htmlFor="live-edit-word" className="sr-only">
                    Fix the misheard word
                  </label>
                  <input
                    id="live-edit-word"
                    data-testid="showcase-edit-input"
                    type="text"
                    value={editWord}
                    maxLength={14}
                    onChange={(e) => {
                      setIsAutoMode(false);
                      setManualEditChosen(true);
                      setEditWord(e.target.value);
                    }}
                    className={`mx-0.5 inline-block w-20 rounded-lg border-2 px-2 py-0.5 text-center font-extrabold text-[#181B25] focus:outline-none ${
                      isEditFixed
                        ? "border-emerald-600 bg-emerald-50"
                        : "border-[#2648DB] bg-[#EEF2FF]"
                    }`}
                  />
                  <span> clip.</span>
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {!isEditFixed && (
                    <button
                      type="button"
                      data-testid="showcase-fix-btn"
                      onClick={() => {
                        setIsAutoMode(false);
                        setManualEditChosen(true);
                        setEditWord("one");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2648DB] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#1E3BC0]"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Fix to &ldquo;one&rdquo;</span>
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="showcase-reset-word"
                    onClick={() => {
                      setIsAutoMode(false);
                      setManualEditChosen(true);
                      setEditWord("won");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#181B25]/15 bg-white px-3 py-2 text-xs font-semibold text-[#50566A] transition hover:text-[#181B25]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#181B25]/10 pt-3 text-xs text-[#50566A]">
                <span>Caption updates live as you type.</span>
                {ended && (
                  <button
                    type="button"
                    onClick={replaySequence}
                    className="font-semibold text-[#2648DB] hover:underline"
                  >
                    Replay
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PERSISTENT SUNLIT FOOTAGE CANVAS (wide context, face + full caption visible on desktop & mobile) */}
          <div
            className={`relative mx-auto w-full overflow-hidden rounded-xl bg-[#10121A] ${
              activeScene === "add"
                ? "aspect-[16/10] sm:aspect-[16/9] lg:h-[385px] lg:aspect-auto"
                : activeScene === "style"
                  ? "order-1 aspect-[16/10] sm:aspect-[16/9] lg:order-1 lg:h-[365px] lg:aspect-auto"
                  : "order-1 aspect-[16/10] sm:aspect-[16/9] lg:order-2 lg:h-[365px] lg:aspect-auto"
            }`}
          >
            <video
              ref={videoRef}
              data-testid="showcase-video"
              src="/home/showcase-clean.mp4"
              poster="/home/use-case-product.jpg"
              muted
              loop
              playsInline
              preload="auto"
              className="h-full w-full object-cover object-[50%_24%]"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#181B25]/82 via-[#181B25]/12 to-transparent" />

            {/* Original shot indicator during brief 0.6-1.5s flash */}
            {inOriginalFlash && (
              <div className="pointer-events-none absolute left-3.5 top-3.5 rounded-full bg-[#181B25]/82 px-3 py-1 text-xs font-semibold text-[#FAF7F0] backdrop-blur-md">
                Original clip
              </div>
            )}

            {/* Explicit Replay pill on finished landing frame */}
            {ended && (
              <button
                type="button"
                data-testid="showcase-ended-replay"
                onClick={replaySequence}
                aria-label="Replay showcase"
                className="absolute right-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full bg-[#2648DB] px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-[#1E3BC0]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Replay</span>
              </button>
            )}

            {/* Explicit Play action when autoplay is blocked or reduced motion is enabled */}
            {!isRunning && !ended && (reducedMotion || autoplayBlocked) && (
              <button
                type="button"
                data-testid="showcase-play-explicit"
                onClick={togglePausePlay}
                aria-label="Play showcase"
                className="absolute right-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full bg-[#2648DB] px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-[#1E3BC0]"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Play</span>
              </button>
            )}

            {/* LIVE READABLE HTML CAPTION OVERLAY */}
            {!inOriginalFlash && (
              <div
                data-testid="showcase-live-caption"
                className="pointer-events-none absolute inset-x-3 bottom-4 flex flex-wrap justify-center gap-1.5 text-center sm:inset-x-6 sm:bottom-6"
              >
                {/* Scene 1: Add captions (Word Highlight pill) */}
                {activeScene === "add" &&
                  CAPTION_WORDS.map((word, idx) => {
                    const isHi = idx === activeWordIdx;
                    return (
                      <span
                        key={word}
                        style={{ fontFamily: '"Poppins", sans-serif' }}
                        className={`rounded-lg px-2 py-0.5 text-base font-extrabold uppercase tracking-tight sm:px-2.5 sm:py-1 sm:text-2xl ${
                          isHi
                            ? "bg-[#2648DB] text-white shadow-[0_6px_20px_rgba(38,72,219,0.55)]"
                            : "bg-[#181B25]/82 text-[#FAF7F0]"
                        }`}
                      >
                        {word}
                      </span>
                    );
                  })}

                {/* Scene 2: Change the style (3 visibly distinct treatments) */}
                {activeScene === "style" && styleLook === "highlight" &&
                  CAPTION_WORDS.map((word, idx) => (
                    <span
                      key={word}
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className={`rounded-lg px-2 py-0.5 text-base font-extrabold uppercase tracking-tight sm:px-2.5 sm:py-1 sm:text-2xl ${
                        idx === 1
                          ? "bg-[#2648DB] text-white shadow-lg"
                          : "bg-[#181B25]/82 text-[#FAF7F0]"
                      }`}
                    >
                      {word}
                    </span>
                  ))}

                {activeScene === "style" && styleLook === "bold" && (
                  <span
                    style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                    className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-[#10121A]/88 px-3.5 py-1 text-2xl tracking-wider text-white sm:text-4xl"
                  >
                    <span>STUDIO</span>
                    <span className="rounded-md bg-[#FACC15] px-2 text-[#10121A]">
                      SOUND
                    </span>
                    <span>IN ONE CLIP.</span>
                  </span>
                )}

                {activeScene === "style" && styleLook === "clean" && (
                  <span
                    style={{ fontFamily: '"Poppins", sans-serif' }}
                    className="text-lg font-bold text-[#FAF7F0] drop-shadow-[0_3px_12px_rgba(0,0,0,0.95)] sm:text-2xl"
                  >
                    Studio <span className="text-[#93B4FF]">sound</span> in one
                    clip.
                  </span>
                )}

                {/* Scene 3: Fix a word (Live corrected caption) */}
                {activeScene === "edit" && (
                  <>
                    <span
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className="rounded-lg bg-[#181B25]/84 px-2 py-0.5 text-sm font-extrabold uppercase text-[#FAF7F0] sm:text-xl"
                    >
                      STUDIO SOUND IN
                    </span>
                    <span
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className="rounded-lg bg-[#2648DB] px-2.5 py-0.5 text-sm font-extrabold uppercase text-white shadow-lg sm:text-xl"
                    >
                      {cleanedEditWord.toUpperCase()}
                    </span>
                    <span
                      style={{ fontFamily: '"Poppins", sans-serif' }}
                      className="rounded-lg bg-[#181B25]/84 px-2 py-0.5 text-sm font-extrabold uppercase text-[#FAF7F0] sm:text-xl"
                    >
                      CLIP.
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* SCENE 2 ("Change the style"): 3 Large Interactive Style Swatches */}
          {activeScene === "style" && (
            <div
              role="radiogroup"
              aria-label="Caption style treatments"
              data-testid="showcase-style-swatches"
              className="order-2 grid grid-cols-3 gap-2 lg:order-2 lg:grid-cols-1 lg:gap-2.5"
            >
              {STYLE_SWATCHES.map((swatch) => {
                const selected = styleLook === swatch.id;
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-testid={`live-style-${swatch.id}`}
                    onClick={() => chooseStyleManually(swatch.id)}
                    className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition sm:p-3.5 ${
                      selected
                        ? "bg-[#EEF2FF] text-[#181B25] ring-2 ring-[#2648DB]"
                        : "bg-white/10 text-[#FAF7F0] hover:bg-white/16"
                    }`}
                  >
                    <div className="flex h-10 w-full items-center justify-center rounded-lg bg-[#181B25] px-2">
                      {swatch.id === "highlight" && (
                        <span
                          style={{ fontFamily: '"Poppins", sans-serif' }}
                          className="rounded bg-[#2648DB] px-1.5 py-0.5 text-xs font-extrabold uppercase text-white"
                        >
                          SOUND
                        </span>
                      )}
                      {swatch.id === "bold" && (
                        <span
                          style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                          className="rounded bg-[#FACC15] px-2 text-lg tracking-wider text-[#10121A]"
                        >
                          BOLD
                        </span>
                      )}
                      {swatch.id === "clean" && (
                        <span
                          style={{ fontFamily: '"Poppins", sans-serif' }}
                          className="text-xs font-bold text-[#FAF7F0]"
                        >
                          Clean <span className="text-[#93B4FF]">type</span>
                        </span>
                      )}
                    </div>
                    <span className="mt-1.5 text-[11px] font-bold sm:text-xs">
                      {swatch.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
