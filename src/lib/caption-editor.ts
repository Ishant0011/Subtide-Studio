import type { CaptionPresetId } from "@/lib/captions";
import type {
  NormalizedCaptionCue,
  NormalizedCaptionWord,
} from "@/lib/uploads";

export type CaptionFontSize = "sm" | "md" | "lg";
export type CaptionAccentId = "violet" | "mint";

export interface CaptionStyleConfig {
  preset: CaptionPresetId;
  fontSize: CaptionFontSize;
  /** Vertical offset from bottom edge as a percentage (8..85). */
  verticalPosition: number;
  /** Caption highlight accent color; defaults to ClipCaptions violet while preserving saved mint styles. */
  accent?: CaptionAccentId;
}

export interface EditorCue extends NormalizedCaptionCue {
  timing_mode: "word" | "cue";
}

export interface CaptionLayoutMetrics {
  preset: CaptionPresetId;
  fontSize: CaptionFontSize;
  fontScale: number;
  previewFontSizeRem: number;
  renderFontSizePx1080: number;
  bottomPercent: number;
  maxWidthPercent: number;
  accent: CaptionAccentId;
  accentHex: string;
  accentAssBgr: string;
  accentShadowRgba: string;
}

export const CAPTION_ACCENTS: Record<
  CaptionAccentId,
  { label: string; hex: string; assBgr: string; shadowRgba: string }
> = {
  violet: {
    label: "Violet",
    hex: "#A78BFA",
    assBgr: "FA8BA7",
    shadowRgba: "rgba(167,139,250,0.45)",
  },
  mint: {
    label: "Mint",
    hex: "#49E6B3",
    assBgr: "B3E649",
    shadowRgba: "rgba(73,230,179,0.45)",
  },
};

export const DEFAULT_CAPTION_STYLE: CaptionStyleConfig = {
  preset: "word-highlight",
  fontSize: "md",
  verticalPosition: 14,
  accent: "violet",
};

export const MIN_VERTICAL_POSITION = 8;
export const MAX_VERTICAL_POSITION = 85;
export const MAX_CLIP_DURATION_MS = 180_000;
export const MAX_CUES_PER_REVISION = 500;

const FONT_SIZE_TABLE: Record<
  CaptionFontSize,
  { scale: number; previewRem: number; renderPx1080: number }
> = {
  sm: { scale: 0.88, previewRem: 0.96, renderPx1080: 44 },
  md: { scale: 1.0, previewRem: 1.12, renderPx1080: 54 },
  lg: { scale: 1.18, previewRem: 1.32, renderPx1080: 66 },
};

/**
 * Shared layout calculation used by both the live browser preview overlay
 * and the future server-side video renderer (Phase 5).
 */
export function computeCaptionLayout(
  style: Partial<CaptionStyleConfig> | null | undefined
): CaptionLayoutMetrics {
  const preset: CaptionPresetId =
    style?.preset === "clean" ||
    style?.preset === "boxed" ||
    style?.preset === "word-highlight"
      ? style.preset
      : DEFAULT_CAPTION_STYLE.preset;

  const fontSize: CaptionFontSize =
    style?.fontSize === "sm" ||
    style?.fontSize === "md" ||
    style?.fontSize === "lg"
      ? style.fontSize
      : DEFAULT_CAPTION_STYLE.fontSize;

  const rawPos =
    typeof style?.verticalPosition === "number" &&
    Number.isFinite(style.verticalPosition)
      ? Math.round(style.verticalPosition)
      : DEFAULT_CAPTION_STYLE.verticalPosition;

  const bottomPercent = Math.max(
    MIN_VERTICAL_POSITION,
    Math.min(MAX_VERTICAL_POSITION, rawPos)
  );

  const accent: CaptionAccentId =
    style?.accent === "mint" ? "mint" : "violet";
  const accentMeta = CAPTION_ACCENTS[accent];

  const metrics = FONT_SIZE_TABLE[fontSize];
  return {
    preset,
    fontSize,
    fontScale: metrics.scale,
    previewFontSizeRem: metrics.previewRem,
    renderFontSizePx1080: metrics.renderPx1080,
    bottomPercent,
    maxWidthPercent: preset === "word-highlight" ? 94 : 90,
    accent,
    accentHex: accentMeta.hex,
    accentAssBgr: accentMeta.assBgr,
    accentShadowRgba: accentMeta.shadowRgba,
  };
}

export function normalizeCaptionStyle(
  input: Partial<CaptionStyleConfig> | null | undefined
): CaptionStyleConfig {
  const layout = computeCaptionLayout(input);
  return {
    preset: layout.preset,
    fontSize: layout.fontSize,
    verticalPosition: layout.bottomPercent,
    accent: layout.accent,
  };
}

function canonicalToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
}

/**
 * Preserves per-word timing when edited cue text still maps 1-to-1 to the
 * existing timed words (e.g. punctuation/casing fixes or start/end adjustments),
 * and falls back cleanly to cue-level highlighting when text changes structurally.
 */
export function reconcileCueWords(
  previousCue: EditorCue,
  nextText: string,
  nextStartMs: number,
  nextEndMs: number
): { words: NormalizedCaptionWord[]; timing_mode: "word" | "cue" } {
  const tokens = nextText.trim().split(/\s+/).filter(Boolean);

  if (
    previousCue.timing_mode === "word" &&
    previousCue.words.length > 0 &&
    tokens.length === previousCue.words.length
  ) {
    const tokensMap = tokens.every((tok, idx) => {
      const prevTok = previousCue.words[idx]?.text ?? "";
      return canonicalToken(tok) === canonicalToken(prevTok);
    });

    if (tokensMap) {
      const oldSpan = Math.max(1, previousCue.end_ms - previousCue.start_ms);
      const newSpan = Math.max(1, nextEndMs - nextStartMs);
      const timingChanged =
        nextStartMs !== previousCue.start_ms || nextEndMs !== previousCue.end_ms;

      let prevEnd = nextStartMs;
      const mappedWords: NormalizedCaptionWord[] = previousCue.words.map(
        (w, idx) => {
          let wStart = w.start_ms;
          let wEnd = w.end_ms;

          if (timingChanged) {
            const relStart = (w.start_ms - previousCue.start_ms) / oldSpan;
            const relEnd = (w.end_ms - previousCue.start_ms) / oldSpan;
            wStart = Math.round(nextStartMs + relStart * newSpan);
            wEnd = Math.round(nextStartMs + relEnd * newSpan);
          }

          wStart = Math.max(prevEnd, Math.min(nextEndMs, wStart));
          wEnd = Math.max(wStart, Math.min(nextEndMs, wEnd));
          prevEnd = wEnd;

          return {
            ...w,
            text: tokens[idx],
            start_ms: wStart,
            end_ms: wEnd,
          };
        }
      );

      return { words: mappedWords, timing_mode: "word" };
    }
  }

  return { words: [], timing_mode: "cue" };
}

export function hydrateEditorCues(rawCues: unknown): EditorCue[] {
  if (!Array.isArray(rawCues)) return [];

  return rawCues.map((raw, idx) => {
    const c = raw as Partial<EditorCue>;
    const words = Array.isArray(c.words) ? c.words : [];
    const timingMode: "word" | "cue" =
      c.timing_mode === "cue"
        ? "cue"
        : words.length > 0
          ? "word"
          : "cue";

    return {
      id: typeof c.id === "string" && c.id ? c.id : `cue-${idx + 1}`,
      start_ms: typeof c.start_ms === "number" ? Math.round(c.start_ms) : 0,
      end_ms: typeof c.end_ms === "number" ? Math.round(c.end_ms) : 0,
      text: typeof c.text === "string" ? c.text : "",
      words,
      timing_mode: timingMode,
    };
  });
}

export function findActiveEditorCue(
  cues: EditorCue[],
  timeMs: number
): EditorCue | null {
  for (const cue of cues) {
    if (timeMs >= cue.start_ms && timeMs <= cue.end_ms) {
      return cue;
    }
  }
  return null;
}

export function findActiveEditorWord(
  cue: EditorCue | null,
  timeMs: number
): NormalizedCaptionWord | null {
  if (!cue || cue.timing_mode !== "word" || cue.words.length === 0) {
    return null;
  }
  for (const w of cue.words) {
    if (timeMs >= w.start_ms && timeMs < w.end_ms) {
      return w;
    }
  }
  const last = cue.words[cue.words.length - 1];
  if (last && timeMs >= last.start_ms && timeMs <= last.end_ms) {
    return last;
  }
  return null;
}

export interface ValidationSuccess {
  ok: true;
  normalizedCues: EditorCue[];
  flatWords: NormalizedCaptionWord[];
  normalizedStyle: CaptionStyleConfig;
}

export interface ValidationFailure {
  ok: false;
  error: string;
}

/**
 * Validates cue text, integer ms timing, monotonic cue order, non-overlap,
 * clip duration bounds, and style settings. Used on both client and server.
 */
export function validateCaptionRevisionInput(input: {
  cues: unknown;
  style: unknown;
  durationMs: number | null | undefined;
}): ValidationSuccess | ValidationFailure {
  if (!input.style || typeof input.style !== "object") {
    return { ok: false, error: "Caption style configuration is required." };
  }

  const s = input.style as Partial<CaptionStyleConfig>;
  if (
    s.preset !== "clean" &&
    s.preset !== "boxed" &&
    s.preset !== "word-highlight"
  ) {
    return { ok: false, error: "Invalid caption preset." };
  }
  if (s.fontSize !== "sm" && s.fontSize !== "md" && s.fontSize !== "lg") {
    return { ok: false, error: "Invalid caption font size." };
  }
  if (
    typeof s.verticalPosition !== "number" ||
    !Number.isFinite(s.verticalPosition) ||
    s.verticalPosition < MIN_VERTICAL_POSITION ||
    s.verticalPosition > MAX_VERTICAL_POSITION
  ) {
    return {
      ok: false,
      error: `Vertical position must be between ${MIN_VERTICAL_POSITION}% and ${MAX_VERTICAL_POSITION}%.`,
    };
  }

  if (
    s.accent !== undefined &&
    s.accent !== "violet" &&
    s.accent !== "mint"
  ) {
    return { ok: false, error: "Invalid caption highlight accent." };
  }

  if (!Array.isArray(input.cues)) {
    return { ok: false, error: "Cues must be an array." };
  }
  if (input.cues.length > MAX_CUES_PER_REVISION) {
    return {
      ok: false,
      error: `Too many cues (max ${MAX_CUES_PER_REVISION}).`,
    };
  }

  const clipBoundMs =
    typeof input.durationMs === "number" && input.durationMs > 0
      ? Math.min(MAX_CLIP_DURATION_MS, Math.round(input.durationMs))
      : MAX_CLIP_DURATION_MS;

  const normalizedCues: EditorCue[] = [];
  const flatWords: NormalizedCaptionWord[] = [];

  for (let i = 0; i < input.cues.length; i++) {
    const raw = input.cues[i] as Partial<EditorCue>;
    const text = typeof raw?.text === "string" ? raw.text.trim() : "";
    if (!text || text.length > 240) {
      return {
        ok: false,
        error: `Cue #${i + 1} text must be between 1 and 240 characters.`,
      };
    }

    const startMs = raw?.start_ms;
    const endMs = raw?.end_ms;
    if (
      typeof startMs !== "number" ||
      !Number.isInteger(startMs) ||
      typeof endMs !== "number" ||
      !Number.isInteger(endMs)
    ) {
      return {
        ok: false,
        error: `Cue #${i + 1} start and end times must be integer milliseconds.`,
      };
    }

    if (startMs < 0) {
      return {
        ok: false,
        error: `Cue #${i + 1} start time cannot be negative.`,
      };
    }

    if (endMs <= startMs) {
      return {
        ok: false,
        error: `Cue #${i + 1} end time must be after its start time.`,
      };
    }

    if (endMs > clipBoundMs) {
      return {
        ok: false,
        error: `Cue #${i + 1} end time (${(endMs / 1000).toFixed(2)}s) exceeds clip duration (${(clipBoundMs / 1000).toFixed(2)}s).`,
      };
    }

    if (i > 0) {
      const prev = normalizedCues[i - 1];
      if (startMs < prev.start_ms) {
        return {
          ok: false,
          error: `Cue #${i + 1} is out of order (starts before Cue #${i}).`,
        };
      }
      if (startMs < prev.end_ms) {
        return {
          ok: false,
          error: `Cue #${i + 1} overlaps with Cue #${i} (${(startMs / 1000).toFixed(2)}s < ${(prev.end_ms / 1000).toFixed(2)}s).`,
        };
      }
    }

    const timingMode: "word" | "cue" =
      raw?.timing_mode === "word" && Array.isArray(raw.words) && raw.words.length > 0
        ? "word"
        : "cue";

    const words: NormalizedCaptionWord[] = [];
    if (timingMode === "word" && Array.isArray(raw.words)) {
      let prevWordEnd = startMs;
      for (let wIdx = 0; wIdx < raw.words.length; wIdx++) {
        const w = raw.words[wIdx];
        const wText = typeof w?.text === "string" ? w.text.trim() : "";
        if (!wText) {
          return {
            ok: false,
            error: `Cue #${i + 1} contains an empty word token.`,
          };
        }
        if (
          typeof w.start_ms !== "number" ||
          !Number.isInteger(w.start_ms) ||
          typeof w.end_ms !== "number" ||
          !Number.isInteger(w.end_ms) ||
          w.start_ms < startMs ||
          w.end_ms > endMs ||
          w.end_ms < w.start_ms ||
          w.start_ms < prevWordEnd
        ) {
          return {
            ok: false,
            error: `Cue #${i + 1} has invalid word timing bounds.`,
          };
        }
        prevWordEnd = w.end_ms;
        const cleanWord: NormalizedCaptionWord = {
          id: typeof w.id === "string" && w.id ? w.id : `c${i + 1}-w${wIdx + 1}`,
          text: wText,
          start_ms: w.start_ms,
          end_ms: w.end_ms,
          confidence:
            typeof w.confidence === "number" && Number.isFinite(w.confidence)
              ? w.confidence
              : null,
        };
        words.push(cleanWord);
        flatWords.push(cleanWord);
      }
    }

    normalizedCues.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : `cue-${i + 1}`,
      start_ms: startMs,
      end_ms: endMs,
      text,
      words,
      timing_mode: timingMode,
    });
  }

  return {
    ok: true,
    normalizedCues,
    flatWords,
    normalizedStyle: {
      preset: s.preset,
      fontSize: s.fontSize,
      verticalPosition: Math.round(s.verticalPosition),
      accent: s.accent === "mint" ? "mint" : "violet",
    },
  };
}

export function formatMsClock(ms: number): string {
  const safe = Number.isFinite(ms) && ms >= 0 ? ms : 0;
  const totalSecs = Math.floor(safe / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const tenths = Math.floor((safe % 1000) / 100);
  return `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
}
