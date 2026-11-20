"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  CAPTION_PRESETS,
  SAMPLE_CAPTIONS,
  SAMPLE_CLIP,
  formatTime,
  getActiveCue,
  getActiveWord,
  type CaptionPresetId,
} from "@/lib/captions";
import { CaptionOverlay } from "@/components/CaptionOverlay";

export function StudioWorkspace() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cueButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0.55);
  const [duration, setDuration] = useState(SAMPLE_CLIP.duration);
  const [preset, setPreset] = useState<CaptionPresetId>("word-highlight");
  const [hasInitializedTime, setHasInitializedTime] = useState(false);

  const activeCue = useMemo(
    () => getActiveCue(SAMPLE_CAPTIONS, currentTime),
    [currentTime]
  );
  const activeWord = useMemo(
    () => getActiveWord(activeCue, currentTime),
    [activeCue, currentTime]
  );

  // Sync media playback time at 60fps while playing so word highlights feel instantaneous
  useEffect(() => {
    if (!isPlaying) return;

    let frameId = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        setCurrentTime(video.currentTime);
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying]);

  // Keep active cue visible in the caption list while playing
  useEffect(() => {
    if (!isPlaying || !activeCue) return;
    const node = cueButtonRefs.current[activeCue.id];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeCue, isPlaying]);

  const seekTo = useCallback(
    (nextTime: number) => {
      const clamped = Math.max(0, Math.min(duration, nextTime));
      const video = videoRef.current;
      if (video) {
        video.currentTime = clamped;
      }
      setCurrentTime(clamped);
    },
    [duration]
  );

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      if (video.ended || video.currentTime >= duration - 0.05) {
        video.currentTime = 0;
        setCurrentTime(0);
      }
      try {
        await video.play();
      } catch {
        // Fallback if browser blocks unmuted autoplay on programmatic trigger
        video.muted = true;
        setIsMuted(true);
        await video.play().catch(() => {});
      }
    } else {
      video.pause();
    }
  }, [duration]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      setDuration(video.duration);
    }
    // Start parked on the first caption cue so the user immediately sees the styled caption preview
    if (!hasInitializedTime) {
      video.currentTime = 0.55;
      setCurrentTime(0.55);
      setHasInitializedTime(true);
    }
  }, [hasInitializedTime]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  }, []);

  // Keyboard shortcuts: Space to play/pause, Left/Right arrows to nudge 1s
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "BUTTON" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        void togglePlay();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekTo(currentTime - 1);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        seekTo(currentTime + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentTime, seekTo, togglePlay]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#070B10] text-[#F5F1E8]">
      {/* Studio Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#F5F1E8]/10 bg-[#070B10]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-[#F5F1E8]/10 bg-[#0D131C] px-2.5 py-1.5 text-xs font-medium text-[#B6B0A4] transition hover:border-[#49E6B3]/40 hover:text-[#F5F1E8]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Home</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#49E6B3] shadow-[0_0_10px_rgba(73,230,179,0.75)]" />
              <span className="text-sm font-semibold tracking-tight text-[#F5F1E8]">
                Subtide Studio
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#B6B0A4]">
            <span className="hidden rounded-full border border-[#F5F1E8]/10 bg-[#0D131C] px-3 py-1 sm:inline-block">
              {SAMPLE_CLIP.title}
            </span>
            <span className="rounded-full border border-[#49E6B3]/25 bg-[#102E28] px-2.5 py-1 font-medium text-[#49E6B3]">
              {SAMPLE_CLIP.aspectLabel}
            </span>
          </div>
        </div>
      </header>

      {/* Main Responsive Workspace: Side-by-side on desktop (lg+), stacked on phones */}
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(320px,390px)_1fr] lg:items-start lg:gap-8">
          {/* Left / Top Column: Portrait Preview & Transport */}
          <section
            aria-label="Portrait video preview"
            className="flex flex-col items-center lg:sticky lg:top-20"
          >
            <div className="w-full max-w-[340px] sm:max-w-[360px] lg:max-w-none">
              {/* 9:16 Video Viewport */}
              <div className="relative aspect-[9/16] w-full overflow-hidden rounded-3xl border border-[#F5F1E8]/12 bg-[#0D131C] shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
                <video
                  ref={videoRef}
                  src={SAMPLE_CLIP.src}
                  playsInline
                  preload="auto"
                  muted={isMuted}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onSeeked={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onClick={() => void togglePlay()}
                  className="h-full w-full cursor-pointer object-cover"
                />

                {/* Subtle top & bottom gradient scrims for caption legibility */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#070B10]/55 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#070B10]/85 via-[#070B10]/35 to-transparent" />

                {/* Top Viewport Status Pill */}
                <div className="pointer-events-none absolute left-3.5 top-3.5 flex items-center gap-2 rounded-full border border-[#F5F1E8]/15 bg-[#070B10]/65 px-2.5 py-1 text-[11px] font-medium text-[#F5F1E8]/90 backdrop-blur-md">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isPlaying ? "animate-pulse bg-[#49E6B3]" : "bg-[#B6B0A4]"
                    }`}
                  />
                  <span>{isPlaying ? "Playing" : "Paused"}</span>
                </div>

                {/* Live Caption Overlay */}
                <CaptionOverlay
                  activeCue={activeCue}
                  activeWord={activeWord}
                  preset={preset}
                  currentTime={currentTime}
                />

                {/* Center Play Hint when Paused */}
                {!isPlaying && (
                  <button
                    type="button"
                    onClick={() => void togglePlay()}
                    aria-label="Play clip"
                    className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#49E6B3]/50 bg-[#070B10]/70 text-[#49E6B3] shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md transition hover:scale-105 hover:bg-[#49E6B3] hover:text-[#070B10]"
                  >
                    <Play className="ml-0.5 h-6 w-6 fill-current" />
                  </button>
                )}
              </div>

              {/* Scrubber & Transport Controls */}
              <div className="mt-4 rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-3.5">
                {/* Timeline Scrubber */}
                <div className="relative flex h-6 items-center">
                  {/* Track background */}
                  <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-[#1A2636]">
                    <div
                      className="h-full rounded-full bg-[#49E6B3]"
                      style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                    />
                  </div>
                  {/* Cue start markers */}
                  <div className="pointer-events-none absolute inset-x-0 h-1.5">
                    {SAMPLE_CAPTIONS.map((cue) => {
                      const leftPct = duration > 0 ? (cue.start / duration) * 100 : 0;
                      return (
                        <span
                          key={cue.id}
                          style={{ left: `${leftPct}%` }}
                          className="absolute top-0 h-1.5 w-0.5 bg-[#F5F1E8]/35"
                        />
                      );
                    })}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.01}
                    value={currentTime}
                    onChange={(e) => seekTo(parseFloat(e.target.value))}
                    aria-label="Seek timeline"
                    className="studio-scrubber relative z-10 w-full"
                  />
                </div>

                {/* Buttons + Time Readout */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void togglePlay()}
                      aria-label={isPlaying ? "Pause" : "Play"}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#49E6B3] text-[#070B10] transition hover:bg-[#2FD49F]"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4 fill-current" />
                      ) : (
                        <Play className="ml-0.5 h-4 w-4 fill-current" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => seekTo(currentTime - 2)}
                      aria-label="Rewind 2 seconds"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#F5F1E8]/10 bg-[#131C28] text-[#B6B0A4] transition hover:border-[#49E6B3]/40 hover:text-[#F5F1E8]"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => seekTo(currentTime + 2)}
                      aria-label="Forward 2 seconds"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#F5F1E8]/10 bg-[#131C28] text-[#B6B0A4] transition hover:border-[#49E6B3]/40 hover:text-[#F5F1E8]"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted ? "Unmute" : "Mute"}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#F5F1E8]/10 bg-[#131C28] text-[#B6B0A4] transition hover:border-[#49E6B3]/40 hover:text-[#F5F1E8]"
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div
                    data-testid="time-readout"
                    className="font-mono text-xs font-medium tabular-nums text-[#B6B0A4]"
                  >
                    <span className="text-[#F5F1E8]">{formatTime(currentTime)}</span>
                    <span className="mx-1 text-[#7D7A72]">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Right / Bottom Column: Style Presets & Caption List */}
          <section className="flex flex-col gap-6">
            {/* Style Presets Panel */}
            <div className="rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#49E6B3]" />
                  <h2 className="text-sm font-semibold tracking-tight text-[#F5F1E8]">
                    Caption Style Presets
                  </h2>
                </div>
                <span className="text-xs text-[#7D7A72]">Instant preview</span>
              </div>

              <div
                role="group"
                aria-label="Caption style presets"
                className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
              >
                {CAPTION_PRESETS.map((item) => {
                  const selected = preset === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPreset(item.id)}
                      className={`group flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                        selected
                          ? "border-[#49E6B3] bg-[#102E28]/70 shadow-[0_0_0_1px_rgba(73,230,179,0.25)]"
                          : "border-[#F5F1E8]/10 bg-[#131C28]/70 hover:border-[#F5F1E8]/25 hover:bg-[#131C28]"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            selected ? "text-[#49E6B3]" : "text-[#F5F1E8]"
                          }`}
                        >
                          {item.name}
                        </span>
                        <span
                          className={`h-2 w-2 rounded-full transition ${
                            selected
                              ? "bg-[#49E6B3] shadow-[0_0_8px_rgba(73,230,179,0.8)]"
                              : "bg-[#F5F1E8]/20 group-hover:bg-[#F5F1E8]/40"
                          }`}
                        />
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#B6B0A4]">
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hand-Timed Caption List */}
            <div className="rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-[#F5F1E8]">
                    Caption Timeline
                  </h2>
                  <p className="mt-0.5 text-xs text-[#7D7A72]">
                    Click any caption cue to jump straight to that moment.
                  </p>
                </div>
                <span className="rounded-full border border-[#F5F1E8]/10 bg-[#131C28] px-2.5 py-1 font-mono text-[11px] tabular-nums text-[#B6B0A4]">
                  {SAMPLE_CAPTIONS.length} cues
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-2.5">
                {SAMPLE_CAPTIONS.map((cue, cueIndex) => {
                  const isCueActive = activeCue?.id === cue.id;
                  return (
                    <button
                      key={cue.id}
                      ref={(el) => {
                        cueButtonRefs.current[cue.id] = el;
                      }}
                      type="button"
                      data-testid={`cue-item-${cue.id}`}
                      data-active-cue={isCueActive ? "true" : "false"}
                      onClick={() => seekTo(cue.start)}
                      className={`group relative flex w-full flex-col gap-1.5 rounded-xl border px-4 py-3 text-left transition ${
                        isCueActive
                          ? "border-[#49E6B3]/55 bg-[#131C28] shadow-[0_6px_24px_rgba(0,0,0,0.3)]"
                          : "border-[#F5F1E8]/8 bg-[#0A1018] hover:border-[#F5F1E8]/20 hover:bg-[#131C28]/70"
                      }`}
                    >
                      {/* Active left accent bar */}
                      <span
                        className={`absolute bottom-2.5 left-0 top-2.5 w-1 rounded-r-full transition ${
                          isCueActive ? "bg-[#49E6B3]" : "bg-transparent"
                        }`}
                      />

                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-medium tabular-nums text-[#7D7A72]">
                          <span className={isCueActive ? "text-[#49E6B3]" : ""}>
                            #{cueIndex + 1}
                          </span>
                          <span className="mx-1.5">·</span>
                          <span>
                            {formatTime(cue.start)} – {formatTime(cue.end)}
                          </span>
                        </span>
                        {isCueActive && (
                          <span className="rounded-full bg-[#102E28] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#49E6B3]">
                            Active
                          </span>
                        )}
                      </div>

                      <p className="text-[15px] leading-relaxed text-[#F5F1E8]">
                        {cue.words.map((word, wordIdx) => {
                          const isWordActive =
                            isCueActive && activeWord?.id === word.id;
                          return (
                            <span
                              key={word.id}
                              className={`inline-block rounded px-0.5 transition-colors ${
                                wordIdx < cue.words.length - 1 ? "mr-1" : ""
                              } ${
                                isWordActive
                                  ? "bg-[#49E6B3]/20 font-semibold text-[#49E6B3]"
                                  : isCueActive
                                    ? "text-[#F5F1E8]"
                                    : "text-[#B6B0A4] group-hover:text-[#F5F1E8]"
                              }`}
                            >
                              {word.text}
                            </span>
                          );
                        })}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
