"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Merge, Play, Scissors, ZoomIn, ZoomOut } from "lucide-react";
import {
  formatMsClock,
  reconcileCueWords,
  validateCaptionRevisionInput,
  type CaptionStyleConfig,
  type EditorCue,
} from "@/lib/caption-editor";

const ZOOM_LEVELS = [1, 1.5, 2, 3, 4] as const;
const MIN_CUE_DURATION_MS = 200;

interface EditorTimelineProps {
  cues: EditorCue[];
  style: CaptionStyleConfig;
  durationMs: number;
  currentTimeMs: number;
  activeCueId: string | null;
  selectedCueId: string | null;
  /** Signed media preview URL for decoding real audio waveform peaks */
  audioSourceUrl?: string;
  onSeekMs: (ms: number) => void;
  onSelectCue: (cueId: string, startMs: number) => void;
  onPreviewCuesChange: (nextCues: EditorCue[]) => void;
  onCommitCuesChange: (beforeCues: EditorCue[], afterCues: EditorCue[]) => void;
  onSplitAtPlayhead?: () => void;
  canSplitAtPlayhead?: boolean;
  onMergeSelectedWithNext?: () => void;
  canMergeSelected?: boolean;
  onPlaySelectedCue?: () => void;
  canPlaySelectedCue?: boolean;
}

type DragState =
  | {
      kind: "scrub";
      pointerId: number;
      trackRect: DOMRect;
    }
  | {
      kind: "boundary";
      pointerId: number;
      cueIndex: number;
      edge: "start" | "end";
      initialCues: EditorCue[];
      initialMs: number;
      startClientX: number;
      trackWidth: number;
      latestCues: EditorCue[];
      didChange: boolean;
    };

function chooseTickStepMs(durationMs: number, zoom: number): number {
  const effectiveSec = durationMs / 1000 / zoom;
  if (effectiveSec <= 3) return 500;
  if (effectiveSec <= 12) return 1000;
  if (effectiveSec <= 28) return 2000;
  if (effectiveSec <= 75) return 5000;
  return 10000;
}

export function EditorTimeline({
  cues,
  style,
  durationMs,
  currentTimeMs,
  activeCueId,
  selectedCueId,
  audioSourceUrl,
  onSeekMs,
  onSelectCue,
  onPreviewCuesChange,
  onCommitCuesChange,
  onSplitAtPlayhead,
  canSplitAtPlayhead = false,
  onMergeSelectedWithNext,
  canMergeSelected = false,
  onPlaySelectedCue,
  canPlaySelectedCue = false,
}: EditorTimelineProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const [zoomIndex, setZoomIndex] = useState(0);
  const [draggingEdge, setDraggingEdge] = useState<{
    cueId: string;
    edge: "start" | "end";
  } | null>(null);
  // Real decoded audio peaks only (null when unavailable — never draws fake bars)
  const [waveformPeaks, setWaveformPeaks] = useState<number[] | null>(null);

  const zoom = ZOOM_LEVELS[zoomIndex];
  const safeDurationMs = Math.max(1000, durationMs);

  // Decode real audio peaks from signed preview media using Web Audio API
  useEffect(() => {
    if (!audioSourceUrl || typeof window === "undefined") {
      setWaveformPeaks(null);
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      setWaveformPeaks(null);
      return;
    }

    const abortController = new AbortController();
    let audioCtx: AudioContext | null = null;
    let cancelled = false;

    const decode = async () => {
      try {
        const res = await fetch(audioSourceUrl, {
          signal: abortController.signal,
        });
        if (!res.ok) return;
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;

        audioCtx = new AudioCtx();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        if (cancelled) return;

        const channelData = audioBuffer.getChannelData(0);
        const bucketCount = 160;
        const samplesPerBucket = Math.max(
          1,
          Math.floor(channelData.length / bucketCount)
        );
        const peaks: number[] = [];
        let maxPeak = 0.0001;

        for (let i = 0; i < bucketCount; i++) {
          const start = i * samplesPerBucket;
          const end = Math.min(channelData.length, start + samplesPerBucket);
          let peak = 0;
          const step = Math.max(1, Math.floor((end - start) / 64));
          for (let j = start; j < end; j += step) {
            const abs = Math.abs(channelData[j]);
            if (abs > peak) peak = abs;
          }
          peaks.push(peak);
          if (peak > maxPeak) maxPeak = peak;
        }

        if (!cancelled) {
          setWaveformPeaks(peaks.map((p) => p / maxPeak));
        }
      } catch {
        // Real audio unavailable or unsupported codec — gracefully omit waveform
        if (!cancelled) setWaveformPeaks(null);
      } finally {
        if (audioCtx) {
          await audioCtx.close().catch(() => {});
        }
      }
    };

    void decode();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [audioSourceUrl]);

  // Render real decoded waveform peaks to canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !waveformPeaks || waveformPeaks.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / waveformPeaks.length;
    ctx.fillStyle = "rgba(167, 139, 250, 0.24)";
    for (let i = 0; i < waveformPeaks.length; i++) {
      const amp = waveformPeaks[i];
      const barH = Math.max(2, Math.round(amp * (height - 4)));
      const y = Math.round((height - barH) / 2);
      ctx.fillRect(
        Math.round(i * barWidth),
        y,
        Math.max(1, Math.floor(barWidth - 1)),
        barH
      );
    }
  }, [waveformPeaks, zoom]);

  const ticks = useMemo(() => {
    const stepMs = chooseTickStepMs(safeDurationMs, zoom);
    const list: Array<{ ms: number; pct: number; label: string }> = [];
    for (let ms = 0; ms <= safeDurationMs; ms += stepMs) {
      const pct = (ms / safeDurationMs) * 100;
      if (pct > 86 && pct < 100) continue;
      list.push({
        ms,
        pct,
        label: formatMsClock(ms),
      });
    }
    return list;
  }, [safeDurationMs, zoom]);

  const playheadPct = Math.min(
    100,
    Math.max(0, (currentTimeMs / safeDurationMs) * 100)
  );

  const clientXToMs = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (rect.width <= 0) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(ratio * safeDurationMs);
    },
    [safeDurationMs]
  );

  const startScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    event.preventDefault();
    const rect = track.getBoundingClientRect();
    dragRef.current = {
      kind: "scrub",
      pointerId: event.pointerId,
      trackRect: rect,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSeekMs(clientXToMs(event.clientX, rect));
  };

  const handleScrubMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "scrub" || drag.pointerId !== event.pointerId) {
      return;
    }
    onSeekMs(clientXToMs(event.clientX, drag.trackRect));
  };

  const endScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "scrub" || drag.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const startBoundaryDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    cueIndex: number,
    edge: "start" | "end"
  ) => {
    const track = trackRef.current;
    if (!track) return;
    event.stopPropagation();
    event.preventDefault();

    const cue = cues[cueIndex];
    if (!cue) return;

    const rect = track.getBoundingClientRect();
    dragRef.current = {
      kind: "boundary",
      pointerId: event.pointerId,
      cueIndex,
      edge,
      initialCues: cues,
      initialMs: edge === "start" ? cue.start_ms : cue.end_ms,
      startClientX: event.clientX,
      trackWidth: Math.max(1, rect.width),
      latestCues: cues,
      didChange: false,
    };
    setDraggingEdge({ cueId: cue.id, edge });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveBoundaryDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "boundary" || drag.pointerId !== event.pointerId) {
      return;
    }
    event.stopPropagation();

    const deltaPx = event.clientX - drag.startClientX;
    const deltaMs = Math.round((deltaPx / drag.trackWidth) * safeDurationMs);
    const targetCue = drag.initialCues[drag.cueIndex];
    if (!targetCue) return;

    const prevCue = drag.cueIndex > 0 ? drag.initialCues[drag.cueIndex - 1] : null;
    const nextCue =
      drag.cueIndex < drag.initialCues.length - 1
        ? drag.initialCues[drag.cueIndex + 1]
        : null;

    let nextStart = targetCue.start_ms;
    let nextEnd = targetCue.end_ms;

    if (drag.edge === "start") {
      const minStart = prevCue ? prevCue.end_ms : 0;
      const maxStart = targetCue.end_ms - MIN_CUE_DURATION_MS;
      nextStart = Math.max(minStart, Math.min(maxStart, drag.initialMs + deltaMs));
    } else {
      const minEnd = targetCue.start_ms + MIN_CUE_DURATION_MS;
      const maxEnd = nextCue ? nextCue.start_ms : safeDurationMs;
      nextEnd = Math.max(minEnd, Math.min(maxEnd, drag.initialMs + deltaMs));
    }

    if (nextStart === targetCue.start_ms && nextEnd === targetCue.end_ms) {
      if (drag.didChange) {
        drag.latestCues = drag.initialCues;
        onPreviewCuesChange(drag.initialCues);
      }
      return;
    }

    const reconciled = reconcileCueWords(
      targetCue,
      targetCue.text,
      nextStart,
      nextEnd
    );
    const candidateCues = drag.initialCues.map((c, idx) =>
      idx === drag.cueIndex
        ? {
            ...c,
            start_ms: nextStart,
            end_ms: nextEnd,
            words: reconciled.words,
            timing_mode: reconciled.timing_mode,
          }
        : c
    );

    const validation = validateCaptionRevisionInput({
      cues: candidateCues,
      style,
      durationMs: safeDurationMs,
    });
    if (!validation.ok) return;

    drag.latestCues = validation.normalizedCues;
    drag.didChange = true;
    onPreviewCuesChange(validation.normalizedCues);
  };

  const endBoundaryDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "boundary" || drag.pointerId !== event.pointerId) {
      return;
    }
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const { initialCues, latestCues, didChange } = drag;
    dragRef.current = null;
    setDraggingEdge(null);

    if (didChange) {
      onCommitCuesChange(initialCues, latestCues);
    }
  };

  const selectedCue = useMemo(
    () =>
      cues.find((c) => c.id === selectedCueId) ??
      cues.find((c) => c.id === activeCueId) ??
      null,
    [cues, selectedCueId, activeCueId]
  );

  return (
    <div
      data-testid="editor-timeline"
      className="rounded-2xl border border-ink/10 bg-panel p-3"
    >
      {/* Timeline Toolbar: Cue readout + Split / Merge / Play Cue + Zoom */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-ink">Timeline</span>
          {selectedCue && (
            <span
              data-testid="timeline-selected-range"
              className="truncate rounded-md border border-ink/10 bg-inset px-2 py-0.5 font-mono text-[11px] tabular-nums text-ink-secondary"
            >
              {formatMsClock(selectedCue.start_ms)} –{" "}
              {formatMsClock(selectedCue.end_ms)}
            </span>
          )}
          {waveformPeaks && (
            <span
              data-testid="timeline-waveform-badge"
              className="hidden rounded-full border border-accent/25 bg-accent-soft/60 px-2 py-0.5 text-[10px] font-medium text-accent-hover sm:inline-block"
            >
              Audio waveform
            </span>
          )}
        </div>

        {/* Correction Actions + Zoom Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {onSplitAtPlayhead && (
            <button
              type="button"
              data-testid="timeline-split-btn"
              disabled={!canSplitAtPlayhead}
              onClick={onSplitAtPlayhead}
              title="Split selected cue at playhead"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-ink/12 bg-elevated px-2 text-[11px] font-medium text-ink transition hover:border-accent/55 hover:text-accent-hover disabled:opacity-35"
            >
              <Scissors className="h-3 w-3" />
              <span>Split</span>
            </button>
          )}

          {onMergeSelectedWithNext && (
            <button
              type="button"
              data-testid="timeline-merge-btn"
              disabled={!canMergeSelected}
              onClick={onMergeSelectedWithNext}
              title="Merge selected cue with next cue"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-ink/12 bg-elevated px-2 text-[11px] font-medium text-ink transition hover:border-accent/55 hover:text-accent-hover disabled:opacity-35"
            >
              <Merge className="h-3 w-3" />
              <span>Merge</span>
            </button>
          )}

          {onPlaySelectedCue && (
            <button
              type="button"
              data-testid="timeline-play-cue-btn"
              disabled={!canPlaySelectedCue}
              onClick={onPlaySelectedCue}
              title="Play only the selected cue"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-accent/40 bg-accent-soft px-2 text-[11px] font-semibold text-accent-hover transition hover:bg-accent hover:text-page disabled:opacity-35"
            >
              <Play className="h-3 w-3 fill-current" />
              <span className="hidden sm:inline">Play cue</span>
            </button>
          )}

          <span
            aria-hidden="true"
            className="mx-0.5 hidden h-4 w-px bg-ink/12 sm:inline-block"
          />

          <button
            type="button"
            data-testid="timeline-zoom-out"
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            aria-label="Zoom out timeline"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink/10 bg-elevated text-ink-secondary transition hover:border-accent/50 hover:text-ink disabled:opacity-40"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span
            data-testid="timeline-zoom-level"
            className="min-w-[34px] text-center font-mono text-[11px] font-semibold tabular-nums text-accent-hover"
          >
            {zoom}x
          </span>
          <button
            type="button"
            data-testid="timeline-zoom-in"
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            onClick={() =>
              setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))
            }
            aria-label="Zoom in timeline"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink/10 bg-elevated text-ink-secondary transition hover:border-accent/50 hover:text-ink disabled:opacity-40"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Zoomed Ruler + Real Audio Waveform + Cue Blocks + Playhead */}
      <div
        ref={scrollRef}
        className="studio-scroll mt-2.5 overflow-x-auto rounded-xl border border-ink/10 bg-page pb-2 pt-1"
      >
        <div
          ref={trackRef}
          style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
          className="relative select-none px-2"
        >
          {/* Time Ruler (click/drag to scrub) */}
          <div
            data-testid="timeline-ruler"
            onPointerDown={startScrub}
            onPointerMove={handleScrubMove}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            className="relative h-6 cursor-ew-resize border-b border-ink/10"
          >
            {ticks.map((tick) => {
              const nearRightEdge = tick.pct > 90;
              return (
                <div
                  key={tick.ms}
                  style={{ left: `${tick.pct}%` }}
                  className={`pointer-events-none absolute bottom-0 top-0 flex flex-col justify-end ${
                    nearRightEdge ? "-translate-x-full items-end" : ""
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] leading-none tabular-nums text-ink-muted ${
                      nearRightEdge ? "mr-1" : "ml-1"
                    }`}
                  >
                    {tick.label}
                  </span>
                  <span className="mt-1 h-1.5 w-px bg-ink/20" />
                </div>
              );
            })}
          </div>

          {/* Cue Track with Optional Real Audio Waveform Behind Cues */}
          <div
            data-testid="timeline-track"
            onPointerDown={startScrub}
            onPointerMove={handleScrubMove}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            className="relative mt-2 h-12 cursor-pointer overflow-hidden rounded-lg bg-inset/90"
          >
            {waveformPeaks && (
              <canvas
                ref={waveformCanvasRef}
                width={960}
                height={48}
                data-testid="timeline-waveform-canvas"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
            )}

            {cues.map((cue, idx) => {
              const leftPct = (cue.start_ms / safeDurationMs) * 100;
              const widthPct = ((cue.end_ms - cue.start_ms) / safeDurationMs) * 100;
              const isSelected = selectedCueId === cue.id;
              const isActive = activeCueId === cue.id;
              const isDraggingThis = draggingEdge?.cueId === cue.id;

              return (
                <div
                  key={cue.id}
                  role="button"
                  tabIndex={0}
                  data-testid={`timeline-cue-${idx + 1}`}
                  data-selected={isSelected ? "true" : "false"}
                  data-active={isActive ? "true" : "false"}
                  aria-label={`Cue ${idx + 1}: ${cue.text.slice(0, 40)} (${formatMsClock(cue.start_ms)} to ${formatMsClock(cue.end_ms)})`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelectCue(cue.id, cue.start_ms);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectCue(cue.id, cue.start_ms);
                    }
                  }}
                  style={{
                    left: `${Math.min(100, Math.max(0, leftPct))}%`,
                    width: `${Math.max(2, Math.min(100 - leftPct, widthPct))}%`,
                  }}
                  className={`group absolute bottom-1 top-1 flex items-center overflow-hidden rounded-lg border text-left transition-colors ${
                    isSelected || isDraggingThis
                      ? "z-20 border-accent bg-accent-soft/90 text-ink shadow-[0_0_0_1px_rgba(167,139,250,0.45)]"
                      : isActive
                        ? "z-10 border-accent/65 bg-accent-soft/75 text-ink"
                        : "z-10 border-ink/15 bg-elevated/90 text-ink-secondary hover:border-accent/45 hover:text-ink"
                  }`}
                >
                  {/* Left (Start) Draggable Handle */}
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid={`timeline-cue-${idx + 1}-handle-start`}
                    aria-label={`Drag cue ${idx + 1} start boundary`}
                    onPointerDown={(e) => startBoundaryDrag(e, idx, "start")}
                    onPointerMove={moveBoundaryDrag}
                    onPointerUp={endBoundaryDrag}
                    onPointerCancel={endBoundaryDrag}
                    className="flex h-full w-2.5 shrink-0 cursor-ew-resize items-center justify-center bg-accent/20 transition hover:bg-accent/70 group-hover:bg-accent/45"
                  >
                    <span className="h-4 w-0.5 rounded-full bg-accent" />
                  </button>

                  {/* Cue Snippet Label */}
                  <span className="min-w-0 flex-1 truncate px-1.5 text-[10px] font-medium">
                    <span className="mr-1 font-mono font-semibold text-accent-hover">
                      #{idx + 1}
                    </span>
                    {cue.text}
                  </span>

                  {/* Right (End) Draggable Handle */}
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid={`timeline-cue-${idx + 1}-handle-end`}
                    aria-label={`Drag cue ${idx + 1} end boundary`}
                    onPointerDown={(e) => startBoundaryDrag(e, idx, "end")}
                    onPointerMove={moveBoundaryDrag}
                    onPointerUp={endBoundaryDrag}
                    onPointerCancel={endBoundaryDrag}
                    className="flex h-full w-2.5 shrink-0 cursor-ew-resize items-center justify-center bg-accent/20 transition hover:bg-accent/70 group-hover:bg-accent/45"
                  >
                    <span className="h-4 w-0.5 rounded-full bg-accent" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Playhead Needle + Cap */}
          <div
            data-testid="timeline-playhead"
            style={{ left: `calc(8px + (100% - 16px) * ${playheadPct / 100})` }}
            className="pointer-events-none absolute bottom-0 top-0 z-30 -translate-x-1/2"
          >
            <div className="mx-auto h-2.5 w-2.5 rounded-b-sm rounded-t-full bg-accent shadow-[0_0_10px_rgba(167,139,250,0.85)]" />
            <div className="mx-auto h-[calc(100%-10px)] w-0.5 bg-accent shadow-[0_0_8px_rgba(167,139,250,0.65)]" />
          </div>
        </div>
      </div>

      {/* Accessible Keyboard Timeline Scrubber */}
      <div className="relative mt-2 flex h-5 items-center">
        <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${playheadPct}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={safeDurationMs}
          step={20}
          value={currentTimeMs}
          onChange={(e) => onSeekMs(Number(e.target.value))}
          aria-label="Seek timeline"
          aria-valuetext={`${formatMsClock(currentTimeMs)} of ${formatMsClock(safeDurationMs)}`}
          className="studio-scrubber relative z-10 w-full"
        />
      </div>
    </div>
  );
}
