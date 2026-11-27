"use client";

import {
  applyCaptionCasing,
  computeCaptionLayout,
  hexToRgba,
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

function buildTextShadow(
  outlineWidth: number,
  outlineColor: string,
  shadowStrength: "none" | "soft" | "strong"
): string | undefined {
  const shadows: string[] = [];
  if (outlineWidth > 0) {
    const px = Math.min(3, Math.max(1, Math.round(outlineWidth * 0.6)));
    shadows.push(
      `-${px}px -${px}px 0 ${outlineColor}`,
      `${px}px -${px}px 0 ${outlineColor}`,
      `-${px}px ${px}px 0 ${outlineColor}`,
      `${px}px ${px}px 0 ${outlineColor}`
    );
  }
  if (shadowStrength === "strong") {
    shadows.push("0 3px 12px rgba(7,11,16,0.95)", "0 1px 3px rgba(7,11,16,0.95)");
  } else if (shadowStrength === "soft") {
    shadows.push("0 2px 8px rgba(7,11,16,0.85)");
  }
  return shadows.length > 0 ? shadows.join(", ") : undefined;
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
      ? "clamp(0.44rem, 4.4cqw, 0.96rem)"
      : layout.fontSize === "lg"
        ? "clamp(0.56rem, 6.1cqw, 1.32rem)"
        : "clamp(0.48rem, 5.2cqw, 1.12rem)";
  const textShadow = buildTextShadow(
    layout.outlineWidth,
    layout.outlineColor,
    layout.shadowStrength
  );
  const bgRgba = layout.backgroundEnabled
    ? hexToRgba(layout.backgroundColor, layout.backgroundOpacity / 100)
    : "transparent";
  const bgDimRgba = layout.backgroundEnabled
    ? hexToRgba(layout.backgroundColor, (layout.backgroundOpacity * 0.72) / 100)
    : "transparent";

  const textStyle = {
    fontFamily: layout.cssFontFamily,
    fontSize: responsiveFontSize,
    maxWidth: `${layout.maxWidthPercent}%`,
  };

  if (layout.preset === "clean") {
    return (
      <div
        data-testid="editor-caption-overlay"
        data-preset="clean"
        data-accent={layout.accent}
        data-font-family={layout.fontFamily}
        data-font-size={layout.fontSize}
        data-vertical-position={String(layout.bottomPercent)}
        data-timing-mode={useWordTiming ? "word" : "cue"}
        style={containerStyle}
        className="pointer-events-none absolute inset-x-3 z-20 flex justify-center"
      >
        <p
          style={{
            ...textStyle,
            textShadow,
            backgroundColor: layout.backgroundEnabled ? bgRgba : undefined,
          }}
          className={`text-center font-bold leading-snug tracking-[-0.01em] ${
            layout.backgroundEnabled ? "rounded-xl px-3 py-1.5" : ""
          }`}
        >
          {useWordTiming ? (
            activeCue.words.map((word, index) => {
              const isActive = activeWord?.id === word.id;
              const isPast = currentTimeMs >= word.end_ms;
              return (
                <span
                  key={word.id}
                  data-active-word={isActive ? "true" : "false"}
                  style={{
                    color: isActive ? layout.activeWordColor : layout.textColor,
                    opacity: isActive || isPast ? 1 : 0.8,
                  }}
                  className={`inline-block transition-all duration-100 ${
                    index < activeCue.words.length - 1 ? "mr-[0.28em]" : ""
                  } ${isActive ? "scale-[1.04]" : ""}`}
                >
                  {applyCaptionCasing(word.text, layout.casing)}
                </span>
              );
            })
          ) : (
            <span
              data-cue-highlight="true"
              style={{ color: layout.activeWordColor }}
            >
              {applyCaptionCasing(activeCue.text, layout.casing)}
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
        data-font-family={layout.fontFamily}
        data-font-size={layout.fontSize}
        data-vertical-position={String(layout.bottomPercent)}
        data-timing-mode={useWordTiming ? "word" : "cue"}
        style={containerStyle}
        className="pointer-events-none absolute inset-x-3 z-20 flex justify-center"
      >
        <div
          style={{
            maxWidth: `${layout.maxWidthPercent}%`,
            backgroundColor: bgRgba,
          }}
          className={`rounded-2xl px-4 py-2.5 text-center ${
            layout.backgroundEnabled
              ? "border border-ink/15 shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-md"
              : ""
          }`}
        >
          <p
            style={{
              fontFamily: layout.cssFontFamily,
              fontSize: responsiveFontSize,
              textShadow,
            }}
            className="font-bold leading-snug tracking-[-0.01em]"
          >
            {useWordTiming ? (
              activeCue.words.map((word, index) => {
                const isActive = activeWord?.id === word.id;
                const isPast = currentTimeMs >= word.end_ms;
                return (
                  <span
                    key={word.id}
                    data-active-word={isActive ? "true" : "false"}
                    style={{
                      color: isActive ? layout.activeWordColor : layout.textColor,
                      textDecorationColor: isActive
                        ? layout.activeWordColor
                        : undefined,
                      opacity: isActive || isPast ? 1 : 0.72,
                    }}
                    className={`inline-block transition-colors duration-100 ${
                      index < activeCue.words.length - 1 ? "mr-[0.28em]" : ""
                    } ${
                      isActive
                        ? "underline decoration-2 underline-offset-4"
                        : ""
                    }`}
                  >
                    {applyCaptionCasing(word.text, layout.casing)}
                  </span>
                );
              })
            ) : (
              <span
                data-cue-highlight="true"
                style={{ color: layout.activeWordColor }}
              >
                {applyCaptionCasing(activeCue.text, layout.casing)}
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
      data-font-family={layout.fontFamily}
      data-font-size={layout.fontSize}
      data-vertical-position={String(layout.bottomPercent)}
      data-timing-mode={useWordTiming ? "word" : "cue"}
      style={containerStyle}
      className="pointer-events-none absolute inset-x-3 z-20 flex justify-center"
    >
      <p
        style={textStyle}
        className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-center font-extrabold leading-tight tracking-[0.01em]"
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
                        backgroundColor: layout.activeWordColor,
                        color: layout.activeWordContrastText,
                        boxShadow: `0 4px 18px ${layout.accentShadowRgba}`,
                      }
                    : {
                        backgroundColor: isPast ? bgRgba : bgDimRgba,
                        color: layout.textColor,
                        opacity: isPast ? 1 : 0.78,
                        textShadow,
                      }
                }
                className={`inline-block rounded-lg px-1.5 py-0.5 transition-all duration-100 ${
                  isActive ? "scale-[1.05]" : ""
                }`}
              >
                {applyCaptionCasing(word.text, layout.casing)}
              </span>
            );
          })
        ) : (
          <span
            data-cue-highlight="true"
            style={{
              backgroundColor: layout.activeWordColor,
              color: layout.activeWordContrastText,
              boxShadow: `0 4px 18px ${layout.accentShadowRgba}`,
            }}
            className="inline-block rounded-lg px-2.5 py-1"
          >
            {applyCaptionCasing(activeCue.text, layout.casing)}
          </span>
        )}
      </p>
    </div>
  );
}
