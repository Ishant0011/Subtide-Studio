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
        data-accent={layout.accent}
        data-font-size={layout.fontSize}
        data-vertical-position={String(layout.bottomPercent)}
        data-timing-mode={useWordTiming ? "word" : "cue"}
        style={containerStyle}
        className="pointer-events-none absolute inset-x-3 z-20 flex justify-center"
      >
        <p
          style={textStyle}
          className="text-center font-semibold leading-snug tracking-[-0.01em] text-ink [text-shadow:0_2px_10px_rgba(7,11,16,0.95),0_1px_2px_rgba(7,11,16,0.9)]"
        >
          {useWordTiming ? (
            activeCue.words.map((word, index) => {
              const isActive = activeWord?.id === word.id;
              const isPast = currentTimeMs >= word.end_ms;
              return (
                <span
                  key={word.id}
                  data-active-word={isActive ? "true" : "false"}
                  style={isActive ? { color: layout.accentHex } : undefined}
                  className={`inline-block transition-all duration-100 ${
                    index < activeCue.words.length - 1 ? "mr-[0.28em]" : ""
                  } ${
                    isActive
                      ? "scale-[1.04]"
                      : isPast
                        ? "text-ink"
                        : "text-ink/80"
                  }`}
                >
                  {word.text}
                </span>
              );
            })
          ) : (
            <span
              data-cue-highlight="true"
              style={{ color: layout.accentHex }}
            >
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
        data-accent={layout.accent}
        data-font-size={layout.fontSize}
        data-vertical-position={String(layout.bottomPercent)}
        data-timing-mode={useWordTiming ? "word" : "cue"}
        style={containerStyle}
        className="pointer-events-none absolute inset-x-3 z-20 flex justify-center"
      >
        <div
          style={{ maxWidth: `${layout.maxWidthPercent}%` }}
          className="rounded-2xl border border-ink/15 bg-page/82 px-4 py-2.5 text-center shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-md"
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
                    style={
                      isActive
                        ? {
                            color: layout.accentHex,
                            textDecorationColor: layout.accentHex,
                          }
                        : undefined
                    }
                    className={`inline-block transition-colors duration-100 ${
                      index < activeCue.words.length - 1 ? "mr-[0.28em]" : ""
                    } ${
                      isActive
                        ? "underline decoration-2 underline-offset-4"
                        : isPast
                          ? "text-ink"
                          : "text-ink/72"
                    }`}
                  >
                    {word.text}
                  </span>
                );
              })
            ) : (
              <span
                data-cue-highlight="true"
                style={{ color: layout.accentHex }}
              >
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
      data-accent={layout.accent}
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
                style={
                  isActive
                    ? {
                        backgroundColor: layout.accentHex,
                        color: "#070B10",
                        boxShadow: `0 4px 18px ${layout.accentShadowRgba}`,
                      }
                    : undefined
                }
                className={`inline-block rounded-lg px-1.5 py-0.5 transition-all duration-100 ${
                  isActive
                    ? "scale-[1.05]"
                    : isPast
                      ? "bg-page/55 text-ink [text-shadow:0_2px_6px_rgba(7,11,16,0.9)]"
                      : "bg-page/40 text-ink/75 [text-shadow:0_2px_6px_rgba(7,11,16,0.9)]"
                }`}
              >
                {word.text}
              </span>
            );
          })
        ) : (
          <span
            data-cue-highlight="true"
            style={{
              backgroundColor: layout.accentHex,
              color: "#070B10",
              boxShadow: `0 4px 18px ${layout.accentShadowRgba}`,
            }}
            className="inline-block rounded-lg px-2.5 py-1"
          >
            {activeCue.text}
          </span>
        )}
      </p>
    </div>
  );
}
