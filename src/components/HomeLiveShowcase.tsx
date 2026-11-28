"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pause, Play, RotateCcw, Sparkles } from "lucide-react";

type SceneId = "add" | "style" | "edit";
type StyleLookId = "highlight" | "bold" | "clean";

const SCENES: ReadonlyArray<{
  id: SceneId;
  label: string;
  startSec: number;
  mediaSeekSec: number;
}> = [
  { id: "add", label: "Add captions", startSec: 0, mediaSeekSec: 0.0 },
  { id: "style", label: "Change the style", startSec: 4.5, mediaSeekSec: 2.0 },
  { id: "edit", label: "Fix a word", startSec: 9.0, mediaSeekSec: 4.0 },
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

  // Playback state derived strictly from actual <video> media events
  const [isMediaPlaying, setIsMediaPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Scene progression state
  const [elapsed, setElapsed] = useState(0);
  const [activeScene, setActiveScene] = useState<SceneId>("add");
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [ended, setEnded] = useState(false);

  // Interactive controls inside Scene 2 (Style) and Scene 3 (Edit)
  const [styleLook, setStyleLook] = useState<StyleLookId>("highlight");
  const [editWord, setEditWord] = useState("won");
  const [manualStyleChosen, setManualStyleChosen] = useState(false);
  const [manualEditChosen, setManualEditChosen] = useState(false);

  // Refs for RAF loop & race-free playback
  const isMediaPlayingRef = useRef(false);
  const isAutoModeRef = useRef(true);
  const manualStyleRef = useRef(false);
  const manualEditRef = useRef(false);

  useEffect(() => {
    isMediaPlayingRef.current = isMediaPlaying;
  }, [isMediaPlaying]);
  useEffect(() => {
    isAutoModeRef.current = isAutoMode;
  }, [isAutoMode]);
  useEffect(() => {
    manualStyleRef.current = manualStyleChosen;
  }, [manualStyleChosen]);
  useEffect(() => {
    manualEditRef.current = manualEditChosen;
  }, [manualEditChosen]);

  // Attempt muted inline autoplay on mount ONLY when reduced motion is off.
  // If browser refuses playback, immediately stop automatic progression and expose Play.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) {
      setReducedMotion(true);
      setIsAutoMode(false);
      setIsMediaPlaying(false);
      return;
    }

    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        setAutoplayBlocked(false);
      }).catch(() => {
        setAutoplayBlocked(true);
        setIsMediaPlaying(false);
        setIsAutoMode(false);
      });
    }
  }, []);

  // Pause showcase cleanly when another clip on the page starts playing
  useEffect(() => {
    const onPauseTour = () => {
      videoRef.current?.pause();
    };
    window.addEventListener("clipcaptions:pause-tour", onPauseTour);
    return () =>
      window.removeEventListener("clipcaptions:pause-tour", onPauseTour);
  }, []);

  // Automatic 13.5s progression ONLY runs while actual <video> is playing AND in auto mode
  useEffect(() => {
    if (!isMediaPlaying || !isAutoMode || reducedMotion || ended) {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      return;
    }

    lastTsRef.current = performance.now();
    const tick = (now: number) => {
      if (!isMediaPlayingRef.current || !isAutoModeRef.current) return;
      const dt = Math.min(0.1, (now - lastTsRef.current) / 1000);
      lastTsRef.current = now;

      setElapsed((prev) => {
        const next = prev + dt;
        if (next >= TOTAL_DURATION) {
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
  }, [isMediaPlaying, isAutoMode, reducedMotion, ended]);

  // Direct scene selection: changes BOTH visible panel AND seeks media to intended scene; stays selected
  const selectScene = useCallback((sceneId: SceneId, focusTab = false) => {
    setIsAutoMode(false);
    setEnded(false);
    setActiveScene(sceneId);

    const cfg = SCENES.find((s) => s.id === sceneId) ?? SCENES[0];
    if (sceneId === "add") {
      setElapsed(2.6);
    } else if (sceneId === "style") {
      setElapsed(6.2);
      if (!manualStyleRef.current) setStyleLook("bold");
    } else {
      setElapsed(11.4);
      if (!manualEditRef.current) setEditWord("one");
    }

    const v = videoRef.current;
    if (v && Number.isFinite(cfg.mediaSeekSec)) {
      try {
        v.currentTime = cfg.mediaSeekSec;
      } catch {
        // ignore if metadata not yet loaded
      }
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

  // Single Replay handler: reliably returns to opening shot & restarts automatic sequence
  const replaySequence = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clipcaptions:pause-gallery"));
    }
    setElapsed(0);
    setEnded(false);
    setIsAutoMode(true);
    setActiveScene("add");
    setManualStyleChosen(false);
    setManualEditChosen(false);
    setStyleLook("highlight");
    setEditWord("won");
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.muted = true;
      const p = v.play();
      if (p && typeof p.then === "function") {
        p.then(() => setAutoplayBlocked(false)).catch(() => {
          setAutoplayBlocked(true);
          setIsMediaPlaying(false);
          setIsAutoMode(false);
        });
      }
    }
  }, []);

  // Play / Pause derived strictly from actual media playback state
  const togglePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused && !v.ended) {
      v.pause();
      return;
    }

    if (ended || elapsed >= TOTAL_DURATION - 0.05) {
      replaySequence();
      return;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clipcaptions:pause-gallery"));
    }
    // If autoplay was blocked at load, resume automatic sequence when user clicks Play
    if (autoplayBlocked && !manualStyleRef.current && !manualEditRef.current) {
      setIsAutoMode(true);
    }
    v.muted = true;
    const p = v.play();
    if (p && typeof p.then === "function") {
      p.then(() => setAutoplayBlocked(false)).catch(() => {
        setAutoplayBlocked(true);
        setIsMediaPlaying(false);
      });
    }
  }, [autoplayBlocked, elapsed, ended, replaySequence]);

  const chooseStyleManually = useCallback((look: StyleLookId) => {
    setIsAutoMode(false);
    setManualStyleChosen(true);
    setStyleLook(look);
    setActiveScene("style");
  }, []);

  // Scene 1 ("Add captions") bold wipe choreography:
  // 0.0 - 0.55s: Finished captioned result immediately on arrival
  // 0.55 - 2.35s: Crisp horizontal wipe from Original -> Captioned across the same shot
  // 2.35 - 4.50s: Timed word highlighting sweeping across the phrase
  const wipeActive =
    activeScene === "add" && isAutoMode && elapsed >= 0.55 && elapsed < 2.35;
  const wipePct = wipeActive
    ? Math.max(0, Math.min(100, ((elapsed - 0.55) / 1.8) * 100))
    : 100;

  const activeWordIdx =
    activeScene === "add" && isAutoMode && elapsed >= 2.35
      ? Math.min(
          CAPTION_WORDS.length - 1,
          Math.floor(((elapsed - 2.35) / 2.0) * CAPTION_WORDS.length)
        )
      : 1; // "SOUND" highlighted on arrival & manual selection

  const cleanedEditWord = editWord.trim() || "___";
  const isEditFixed = editWord.trim().toLowerCase() === "one";
  const progressPct = Math.min(100, Math.max(0, (elapsed / TOTAL_DURATION) * 100));

  return (
    <div
      data-testid="home-live-showcase"
      data-active-scene={activeScene}
      data-media-playing={isMediaPlaying ? "true" : "false"}
      data-autoplay-blocked={autoplayBlocked ? "true" : "false"}
      className="w-full"
    >
      {/* Dominant Charcoal #181B25 Media Stage — stable fixed height across every scene */}
      <div
        id="live-showcase-panel"
        role="tabpanel"
        aria-labelledby={`live-tab-${activeScene}`}
        data-testid="live-showcase-panel"
        className="relative overflow-hidden rounded-2xl bg-[#181B25] p-2 shadow-[0_24px_64px_rgba(24,27,37,0.2)] sm:rounded-[1.5rem] sm:p-3"
      >
        {/* Slim Cobalt Progress Bar */}
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/12">
          <div
            className="h-full rounded-full bg-[#2648DB]"
            style={{ width: `${progressPct.toFixed(1)}%` }}
          />
        </div>

        {/* Fixed-Height Film Canvas (zero layout shift across Add / Style / Edit) */}
        <div className="relative h-[250px] w-full overflow-hidden rounded-xl bg-[#10121A] sm:h-[360px] lg:h-[420px]">
          <video
            ref={videoRef}
            data-testid="showcase-video"
            src="/home/showcase-clean.mp4"
            poster="/home/use-case-product.jpg"
            muted
            loop
            playsInline
            preload="auto"
            onPlay={() => {
              setIsMediaPlaying(true);
              setAutoplayBlocked(false);
            }}
            onPause={() => setIsMediaPlaying(false)}
            onEnded={() => setIsMediaPlaying(false)}
            onClick={togglePlayPause}
            className={`h-full w-full cursor-pointer object-cover transition-transform duration-300 motion-reduce:transition-none ${
              activeScene === "style"
                ? "scale-[1.04] object-[50%_20%]"
                : activeScene === "edit"
                  ? "scale-[1.06] object-[50%_22%]"
                  : "scale-100 object-[50%_24%]"
            }`}
          />

          {/* Bottom legibility scrim */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#181B25]/88 via-[#181B25]/14 to-transparent" />

          {/* Scene 1 Quick Wipe Line (Original -> Captioned within first 3 seconds) */}
          {wipeActive && (
            <>
              <div
                style={{ left: `${wipePct.toFixed(1)}%` }}
                className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-[#2648DB] shadow-[0_0_16px_rgba(38,72,219,0.9)]"
              />
              <span className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-[#2648DB] px-2.5 py-0.5 text-[11px] font-bold text-white shadow">
                Captioned
              </span>
              <span className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-[#181B25]/85 px-2.5 py-0.5 text-[11px] font-semibold text-[#FAF7F0]">
                Original
              </span>
            </>
          )}

          {/* Prominent Play Action immediately when autoplay is refused or reduced motion is active */}
          {!isMediaPlaying && !ended && (autoplayBlocked || reducedMotion) && (
            <button
              type="button"
              data-testid="showcase-play-fallback"
              onClick={togglePlayPause}
              aria-label="Play showcase"
              className="absolute left-1/2 top-[44%] z-30 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-[#2648DB] px-5 py-2.5 text-sm font-semibold text-white shadow-2xl transition hover:bg-[#1E3BC0]"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Play showcase</span>
            </button>
          )}

          {/* Scene 3 ("Fix a word"): Compact Transcript Card anchored upper-left so speaker's face stays unobstructed */}
          {activeScene === "edit" && (
            <div
              data-testid="showcase-edit-transcript"
              className="absolute left-3 top-3 z-20 max-w-[calc(100%-1.5rem)] rounded-xl border border-[#181B25]/15 bg-[#FAF7F0]/96 p-2.5 text-left text-[#181B25] shadow-xl backdrop-blur-md sm:left-4 sm:top-4 sm:max-w-[330px] sm:p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-mono font-semibold text-[#50566A]">
                  Transcript · 0:01.2
                </span>
                <span
                  data-testid="showcase-edit-badge"
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${
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
                    <span>1 misheard word</span>
                  )}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-[#181B25] sm:text-base">
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
                    className={`mx-0.5 inline-block w-16 rounded-md border-2 px-1.5 py-0.5 text-center font-extrabold text-[#181B25] focus:outline-none sm:w-20 ${
                      isEditFixed
                        ? "border-emerald-600 bg-emerald-50"
                        : "border-[#2648DB] bg-[#EEF2FF]"
                    }`}
                  />
                  <span> clip.</span>
                </p>

                <div className="flex items-center gap-1.5">
                  {!isEditFixed && (
                    <button
                      type="button"
                      data-testid="showcase-fix-btn"
                      onClick={() => {
                        setIsAutoMode(false);
                        setManualEditChosen(true);
                        setEditWord("one");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#2648DB] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1E3BC0]"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Fix</span>
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
                    className="rounded-lg border border-[#181B25]/15 bg-white px-2 py-1 text-[11px] font-semibold text-[#50566A] hover:text-[#181B25]"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LIVE CAPTION LAYER (Safe Area — away from controls!) */}
          <div
            data-testid="showcase-live-caption"
            style={
              wipeActive
                ? { clipPath: `inset(0 ${(100 - wipePct).toFixed(1)}% 0 0)` }
                : undefined
            }
            className={`pointer-events-none absolute inset-x-3 z-10 flex flex-wrap justify-center gap-1.5 text-center sm:inset-x-6 ${
              activeScene === "style" ? "bottom-16 sm:bottom-20" : "bottom-5 sm:bottom-7"
            }`}
          >
            {/* Scene 1: Add captions */}
            {activeScene === "add" &&
              CAPTION_WORDS.map((word, idx) => {
                const isHi = idx === activeWordIdx;
                return (
                  <span
                    key={word}
                    style={{ fontFamily: '"Poppins", sans-serif' }}
                    className={`rounded-lg px-2 py-0.5 text-base font-extrabold uppercase tracking-tight sm:px-3 sm:py-1 sm:text-2xl ${
                      isHi
                        ? "bg-[#2648DB] text-white shadow-[0_8px_24px_rgba(38,72,219,0.58)]"
                        : "bg-[#181B25]/85 text-[#FAF7F0]"
                    }`}
                  >
                    {word}
                  </span>
                );
              })}

            {/* Scene 2: Change the style */}
            {activeScene === "style" &&
              styleLook === "highlight" &&
              CAPTION_WORDS.map((word, idx) => (
                <span
                  key={word}
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                  className={`rounded-lg px-2 py-0.5 text-base font-extrabold uppercase tracking-tight sm:px-3 sm:py-1 sm:text-2xl ${
                    idx === 1
                      ? "bg-[#2648DB] text-white shadow-lg"
                      : "bg-[#181B25]/85 text-[#FAF7F0]"
                  }`}
                >
                  {word}
                </span>
              ))}

            {activeScene === "style" && styleLook === "bold" && (
              <span
                style={{ fontFamily: '"Bebas Neue", sans-serif' }}
                className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-[#10121A]/90 px-3.5 py-1 text-2xl tracking-wider text-white sm:text-4xl"
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
                className="text-lg font-bold text-[#FAF7F0] drop-shadow-[0_3px_14px_rgba(0,0,0,0.95)] sm:text-2xl"
              >
                Studio <span className="text-[#93B4FF]">sound</span> in one
                clip.
              </span>
            )}

            {/* Scene 3: Fix a word */}
            {activeScene === "edit" && (
              <>
                <span
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                  className="rounded-lg bg-[#181B25]/88 px-2 py-0.5 text-sm font-extrabold uppercase text-[#FAF7F0] sm:px-2.5 sm:py-1 sm:text-xl"
                >
                  STUDIO SOUND IN
                </span>
                <span
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                  className="rounded-lg bg-[#2648DB] px-2.5 py-0.5 text-sm font-extrabold uppercase text-white shadow-lg sm:px-3 sm:py-1 sm:text-xl"
                >
                  {cleanedEditWord.toUpperCase()}
                </span>
                <span
                  style={{ fontFamily: '"Poppins", sans-serif' }}
                  className="rounded-lg bg-[#181B25]/88 px-2 py-0.5 text-sm font-extrabold uppercase text-[#FAF7F0] sm:px-2.5 sm:py-1 sm:text-xl"
                >
                  CLIP.
                </span>
              </>
            )}
          </div>

          {/* Scene 2 Interactive Style Dock (cleanly below the caption inside the stage) */}
          {activeScene === "style" && (
            <div
              role="radiogroup"
              aria-label="Choose caption style"
              data-testid="showcase-style-swatches"
              className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-center gap-2"
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
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? "bg-[#2648DB] text-white shadow-md"
                        : "bg-[#181B25]/88 text-[#FAF7F0] ring-1 ring-white/20 hover:bg-[#181B25]"
                    }`}
                  >
                    {swatch.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ONE Unified Control Bar below the footage — away from captions */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div
            role="tablist"
            aria-label="Showcase scenes"
            data-testid="showcase-tablist"
            className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-white/8 p-1"
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
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                    selected
                      ? "bg-[#2648DB] text-white shadow-sm"
                      : "text-[#C9CEDE] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {scene.label}
                </button>
              );
            })}
          </div>

          {/* Single Playback Control: shows Replay when ended, otherwise Pause / Play derived from actual media state */}
          <div className="flex items-center gap-1.5">
            {ended ? (
              <button
                type="button"
                data-testid="showcase-replay"
                onClick={replaySequence}
                aria-label="Replay showcase"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2648DB] px-3.5 text-xs font-semibold text-white transition hover:bg-[#1E3BC0]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Replay</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  data-testid="showcase-pause-play"
                  onClick={togglePlayPause}
                  aria-label={isMediaPlaying ? "Pause showcase" : "Play showcase"}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/12 px-3 text-xs font-semibold text-[#FAF7F0] transition hover:bg-white/20"
                >
                  {isMediaPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Play</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  data-testid="showcase-replay"
                  onClick={replaySequence}
                  aria-label="Replay showcase"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-[#C9CEDE] transition hover:bg-white/20 hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
