"use client";

import {
  computeCaptionLayout,
  type CaptionStyleConfig,
  type EditorCue,
} from "@/lib/caption-editor";
import type { NormalizedCaptionWord } from "@/lib/uploads";

interface EditorCaptionOverlayProps {
  activeCue: EditorCue | null;
  activeWord: NormalizedCaptionWord | null;
  style: CaptionStyleConfig;
  currentTimeMs: number;
}

export function EditorCaptionOverlay({
  activeCue,
  activeWord,
  style,
  currentTimeMs,
}: EditorCaptionOverlayProps) {
  if (!activeCue) return null;

  const layout = computeCaptionLayout(style);
  const useWordTiming =
    activeCue.timing_mode === "word" && activeCue.words.length > 0;

  const containerStyle = {
    bottom: `${layout.bottomPercent}%`,
  };
  const responsiveFontSize =
    layout.fontSize === "sm"
      ? "clamp(0.62rem, 4.4cqw, 0.96rem)"
      : layout.fontSize === "lg"
        ? "clamp(0.8rem, 6.1cqw, 1.32rem)"
        : "clamp(0.7rem, 5.2cqw, 1.12rem)";
  const textStyle = {
    fontSize: responsiveFontSize,
    maxWidth: `${layout.maxWidthPercent}%`,
  };

  if (layout.preset === "clean") {
    return (
      <div
        data-testid="editor-caption-overlay"
        data-preset="clean"
        data-font-size={layout.fontSize}
        data-vertical-position={String(layout.bottomPercent)}
        data-timing-mode={useWordTiming ? "word" : "cue"}
        style={containerStyle}
        className="pointer-events-none absolute inset-x-3 z-20 flex justify-center"
      >
        <p
          style={textStyle}
          className="text-center font-semibold leading-snug tracking-[-0.01em] text-[#F5F1E8] [text-shadow:0_2px_10px_rgba(7,11,16,0.95),0_1px_2px_rgba(7,11,16,0.9)]"
        >
          {useWordTiming ? (
            activeCue.words.map((word, index) => {
              const isActive = activeWord?.id === word.id;
              const isPast = currentTimeMs >= word.end_ms;
              return (
                <span
                  key={word.id}
                  data-active-word={isActive ? "true" : "false"}
                  className={`inline-block transition-all duration-100 ${
                    index < activeCue.words.length - 1 ? "mr-[0.28em]" : ""
                  } ${
                    isActive
                      ? "scale-[1.04] text-[#49E6B3]"
                      : isPast
                        ? "text-[#F5F1E8]"
                        : "text-[#F5F1E8]/80"
                  }`}
                >
                  {word.text}
                </span>
              );
            })
          ) : (
            <span data-cue-highlight="true" className="text-[#49E6B3]">
              {activeCue.text}
            </span>
          )}
        </p>
      </div>
    );
  }

  if (layout.preset === "boxed") {
    return (
      <div
        data-testid="editor-caption-overlay"
        data-preset="boxed"
        data-font-size={layout.fontSize}
        data-vertical-position={String(layout.bottomPercent)}
        data-timing-mode={useWordTiming ? "word" : "cue"}
        style={containerStyle}
        className="pointer-events-none absolute inset-x-3 z-20 flex justify-center"
      >
        <div
          style={{ maxWidth: `${layout.maxWidthPercent}%` }}
          className="rounded-2xl border border-[#F5F1E8]/15 bg-[#070B10]/82 px-4 py-2.5 text-center shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-md"
        >
          <p
            style={{ fontSize: responsiveFontSize }}
            className="font-semibold leading-snug tracking-[-0.01em]"
          >
            {useWordTiming ? (
              activeCue.words.map((word, index) => {
                const isActive = activeWord?.id === word.id;
                const isPast = currentTimeMs >= word.end_ms;
                return (
                  <span
                    key={word.id}
                    data-active-word={isActive ? "true" : "false"}
                    className={`inline-block transition-colors duration-100 ${
                      index < activeCue.words.length - 1 ? "mr-[0.28em]" : ""
                    } ${
                      isActive
                        ? "text-[#49E6B3] underline decoration-[#49E6B3]/70 decoration-2 underline-offset-4"
                        : isPast
                          ? "text-[#F5F1E8]"
                          : "text-[#F5F1E8]/72"
                    }`}
                  >
                    {word.text}
                  </span>
                );
              })
            ) : (
              <span data-cue-highlight="true" className="text-[#49E6B3]">
                {activeCue.text}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  // preset === "word-highlight"
  return (
    <div
      data-testid="editor-caption-overlay"
      data-preset="word-highlight"
      data-font-size={layout.fontSize}
      data-vertical-position={String(layout.bottomPercent)}
      data-timing-mode={useWordTiming ? "word" : "cue"}
      style={containerStyle}
      className="pointer-events-none absolute inset-x-3 z-20 flex justify-center"
    >
      <p
        style={textStyle}
        className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-center font-extrabold uppercase leading-tight tracking-[0.01em]"
      >
        {useWordTiming ? (
          activeCue.words.map((word) => {
            const isActive = activeWord?.id === word.id;
            const isPast = currentTimeMs >= word.end_ms;
            return (
              <span
                key={word.id}
                data-active-word={isActive ? "true" : "false"}
                className={`inline-block rounded-lg px-1.5 py-0.5 transition-all duration-100 ${
                  isActive
                    ? "scale-[1.05] bg-[#49E6B3] text-[#070B10] shadow-[0_4px_18px_rgba(73,230,179,0.45)]"
                    : isPast
                      ? "bg-[#070B10]/55 text-[#F5F1E8] [text-shadow:0_2px_6px_rgba(7,11,16,0.9)]"
                      : "bg-[#070B10]/40 text-[#F5F1E8]/75 [text-shadow:0_2px_6px_rgba(7,11,16,0.9)]"
                }`}
              >
                {word.text}
              </span>
            );
          })
        ) : (
          <span
            data-cue-highlight="true"
            className="inline-block rounded-lg bg-[#49E6B3] px-2.5 py-1 text-[#070B10] shadow-[0_4px_18px_rgba(73,230,179,0.45)]"
          >
            {activeCue.text}
          </span>
        )}
      </p>
    </div>
  );
}
