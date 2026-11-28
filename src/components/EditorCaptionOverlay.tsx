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
    shadows.push(
      "0 3px 12px rgba(13,14,18,0.95)",
      "0 1px 3px rgba(13,14,18,0.95)"
    );
  } else if (shadowStrength === "soft") {
    shadows.push("0 2px 8px rgba(13,14,18,0.85)");
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
    activeCue.timing_mode === "word" &&
    activeCue.words.length > 0 &&
    layout.emphasisMode !== "cue";

  const containerStyle = {
    bottom: `${layout.bottomPercent}%`,
  };
  const responsiveFontSize =
    layout.fontSize === "sm"
      ? "clamp(0.44rem, 4.3cqw, 0.94rem)"
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
    ? hexToRgba(
        layout.backgroundColor,
        (layout.backgroundOpacity * 0.72) / 100
      )
    : "transparent";

  const isLeft = layout.alignment === "left";
  const wrapperJustify = isLeft ? "justify-start" : "justify-center";
  const textAlignClass = isLeft ? "text-left" : "text-center";

  const baseTypographyStyle = {
    fontFamily: layout.cssFontFamily,
    fontSize: responsiveFontSize,
    letterSpacing: layout.cssLetterSpacing,
    fontStyle: layout.italic ? ("italic" as const) : ("normal" as const),
  };

  // Pill word-highlight layout
  if (layout.preset === "word-highlight" || layout.emphasisMode === "pill") {
    return (
      <div
        data-testid="editor-caption-overlay"
        data-preset={layout.preset}
        data-emphasis={layout.emphasisMode}
        data-alignment={layout.alignment}
        data-accent={layout.accent}
        data-font-family={layout.fontFamily}
        data-font-size={layout.fontSize}
        data-vertical-position={String(layout.bottomPercent)}
        data-timing-mode={useWordTiming ? "word" : "cue"}
        style={containerStyle}
        className={`pointer-events-none absolute inset-x-3 z-20 flex ${wrapperJustify}`}
      >
        <p
          style={{
            ...baseTypographyStyle,
            maxWidth: `${layout.maxWidthPercent}%`,
          }}
          className={`flex flex-wrap items-center gap-x-1 gap-y-1 font-extrabold leading-tight ${
            isLeft ? "justify-start text-left" : "justify-center text-center"
          }`}
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
                          boxShadow: `0 4px 16px ${layout.accentShadowRgba}`,
                        }
                      : {
                          backgroundColor: isPast ? bgRgba : bgDimRgba,
                          color: layout.textColor,
                          opacity: isPast ? 1 : 0.78,
                          textShadow,
                        }
                  }
                  className={`inline-block rounded-lg px-1.5 py-0.5 transition-all duration-100 ${
                    isActive ? "scale-[1.04]" : ""
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
                backgroundColor:
                  layout.emphasisMode === "cue"
                    ? bgRgba
                    : layout.activeWordColor,
                color:
                  layout.emphasisMode === "cue"
                    ? layout.textColor
                    : layout.activeWordContrastText,
                textShadow:
                  layout.emphasisMode === "cue" ? textShadow : undefined,
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

  // Boxed plate layout (Broadcast, Underline, High Contrast, Editorial, Lower Third)
  if (layout.preset === "boxed") {
    return (
      <div
        data-testid="editor-caption-overlay"
        data-preset="boxed"
        data-emphasis={layout.emphasisMode}
        data-alignment={layout.alignment}
        data-accent={layout.accent}
        data-font-family={layout.fontFamily}
        data-font-size={layout.fontSize}
        data-vertical-position={String(layout.bottomPercent)}
        data-timing-mode={useWordTiming ? "word" : "cue"}
        style={containerStyle}
        className={`pointer-events-none absolute inset-x-3 z-20 flex ${wrapperJustify}`}
      >
        <div
          style={{
            maxWidth: `${layout.maxWidthPercent}%`,
            backgroundColor: bgRgba,
          }}
          className={`rounded-xl px-3.5 py-2 ${textAlignClass} ${
            layout.backgroundEnabled
              ? "border border-ink/12 shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
              : ""
          } ${isLeft ? "border-l-2 border-l-accent" : ""}`}
        >
          <p
            style={{
              ...baseTypographyStyle,
              textShadow,
            }}
            className="font-bold leading-snug"
          >
            {useWordTiming ? (
              activeCue.words.map((word, index) => {
                const isActive = activeWord?.id === word.id;
                const isPast = currentTimeMs >= word.end_ms;
                const isUnderline = layout.emphasisMode === "underline";
                const isScale = layout.emphasisMode === "scale";
                return (
                  <span
                    key={word.id}
                    data-active-word={isActive ? "true" : "false"}
                    style={{
                      color: isActive
                        ? layout.activeWordColor
                        : layout.textColor,
                      textDecorationColor:
                        isActive && isUnderline
                          ? layout.activeWordColor
                          : undefined,
                      opacity: isActive || isPast ? 1 : 0.75,
                    }}
                    className={`inline-block transition-all duration-100 ${
                      index < activeCue.words.length - 1 ? "mr-[0.28em]" : ""
                    } ${
                      isActive && isUnderline
                        ? "underline decoration-2 underline-offset-4"
                        : ""
                    } ${isActive && isScale ? "scale-[1.08]" : ""}`}
                  >
                    {applyCaptionCasing(word.text, layout.casing)}
                  </span>
                );
              })
            ) : (
              <span
                data-cue-highlight="true"
                style={{
                  color:
                    layout.emphasisMode === "cue"
                      ? layout.textColor
                      : layout.activeWordColor,
                }}
              >
                {applyCaptionCasing(activeCue.text, layout.casing)}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  // Floating clean layout (Minimal, Clean, Creator Pop, Poster Cutout, Documentary)
  return (
    <div
      data-testid="editor-caption-overlay"
      data-preset="clean"
      data-emphasis={layout.emphasisMode}
      data-alignment={layout.alignment}
      data-accent={layout.accent}
      data-font-family={layout.fontFamily}
      data-font-size={layout.fontSize}
      data-vertical-position={String(layout.bottomPercent)}
      data-timing-mode={useWordTiming ? "word" : "cue"}
      style={containerStyle}
      className={`pointer-events-none absolute inset-x-3 z-20 flex ${wrapperJustify}`}
    >
      <p
        style={{
          ...baseTypographyStyle,
          maxWidth: `${layout.maxWidthPercent}%`,
          textShadow,
          backgroundColor: layout.backgroundEnabled ? bgRgba : undefined,
        }}
        className={`font-bold leading-snug ${textAlignClass} ${
          layout.backgroundEnabled ? "rounded-xl px-3 py-1.5" : ""
        }`}
      >
        {useWordTiming ? (
          activeCue.words.map((word, index) => {
            const isActive = activeWord?.id === word.id;
            const isPast = currentTimeMs >= word.end_ms;
            const isUnderline = layout.emphasisMode === "underline";
            const isScale = layout.emphasisMode === "scale";
            return (
              <span
                key={word.id}
                data-active-word={isActive ? "true" : "false"}
                style={{
                  color: isActive ? layout.activeWordColor : layout.textColor,
                  textDecorationColor:
                    isActive && isUnderline
                      ? layout.activeWordColor
                      : undefined,
                  opacity: isActive || isPast ? 1 : 0.82,
                }}
                className={`inline-block transition-all duration-100 ${
                  index < activeCue.words.length - 1 ? "mr-[0.28em]" : ""
                } ${
                  isActive && isUnderline
                    ? "underline decoration-2 underline-offset-4"
                    : ""
                } ${
                  isActive && isScale
                    ? "scale-[1.1]"
                    : isActive
                      ? "scale-[1.03]"
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
            style={{
              color:
                layout.emphasisMode === "cue"
                  ? layout.textColor
                  : layout.activeWordColor,
            }}
          >
            {applyCaptionCasing(activeCue.text, layout.casing)}
          </span>
        )}
      </p>
    </div>
  );
}
