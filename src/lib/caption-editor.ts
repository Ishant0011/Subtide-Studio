import type { CaptionPresetId } from "@/lib/captions";
import type {
  NormalizedCaptionCue,
  NormalizedCaptionWord,
} from "@/lib/uploads";

export type CaptionFontSize = "sm" | "md" | "lg";
export type CaptionAccentId = "violet" | "mint";
export type CaptionFontId =
  | "poppins"
  | "montserrat"
  | "bebas-neue"
  | "space-mono"
  | "dm-serif"
  | "noto-devanagari";
export type CaptionCasing = "original" | "uppercase" | "lowercase";
export type CaptionShadowStrength = "none" | "soft" | "strong";
export type CaptionEmphasisMode =
  | "pill"
  | "color"
  | "underline"
  | "scale"
  | "cue";
export type CaptionAlignment = "center" | "left";
export type CaptionLetterSpacing = "tight" | "normal" | "wide";
export type CaptionTemplateCategory =
  | "Clean"
  | "Creator"
  | "Bold"
  | "Editorial";

export interface CaptionFontDescriptor {
  id: CaptionFontId;
  label: string;
  cssFamily: string;
  assFamily: string;
  file: string;
  category: string;
}

export const CAPTION_FONTS: Record<CaptionFontId, CaptionFontDescriptor> = {
  poppins: {
    id: "poppins",
    label: "Poppins",
    cssFamily: '"Poppins", "Plus Jakarta Sans", sans-serif',
    assFamily: "Poppins",
    file: "Poppins-Bold.ttf",
    category: "Geometric Sans",
  },
  montserrat: {
    id: "montserrat",
    label: "Montserrat",
    cssFamily: '"Montserrat", "Plus Jakarta Sans", sans-serif',
    assFamily: "Montserrat",
    file: "Montserrat-Bold.ttf",
    category: "Bold Sans",
  },
  "bebas-neue": {
    id: "bebas-neue",
    label: "Bebas Neue",
    cssFamily: '"Bebas Neue", Impact, sans-serif',
    assFamily: "Bebas Neue",
    file: "BebasNeue-Regular.ttf",
    category: "Condensed Display",
  },
  "space-mono": {
    id: "space-mono",
    label: "Space Mono",
    cssFamily: '"Space Mono", ui-monospace, monospace',
    assFamily: "Space Mono",
    file: "SpaceMono-Bold.ttf",
    category: "Tech Mono",
  },
  "dm-serif": {
    id: "dm-serif",
    label: "DM Serif",
    cssFamily: '"DM Serif Display", Georgia, serif',
    assFamily: "DM Serif Display",
    file: "DMSerifDisplay-Regular.ttf",
    category: "Editorial Serif",
  },
  "noto-devanagari": {
    id: "noto-devanagari",
    label: "Noto Devanagari",
    cssFamily: '"Noto Sans Devanagari", "Poppins", sans-serif',
    assFamily: "Noto Sans Devanagari",
    file: "NotoSansDevanagari-Bold.ttf",
    category: "Devanagari + Latin",
  },
};

export const CAPTION_FONT_LIST: CaptionFontDescriptor[] = [
  CAPTION_FONTS.poppins,
  CAPTION_FONTS.montserrat,
  CAPTION_FONTS["bebas-neue"],
  CAPTION_FONTS["space-mono"],
  CAPTION_FONTS["dm-serif"],
  CAPTION_FONTS["noto-devanagari"],
];

export interface CaptionStyleConfig {
  preset: CaptionPresetId;
  fontSize: CaptionFontSize;
  /** Vertical offset from bottom edge as a percentage (8..85). */
  verticalPosition: number;
  /** Legacy / quick accent token; preserved for older revisions. */
  accent?: CaptionAccentId;
  /** Phase 5B/5C creator style controls (stored by value on revisions & personal presets). */
  fontFamily?: CaptionFontId;
  textColor?: string;
  activeWordColor?: string;
  highlightBgColor?: string;
  highlightBgOpacity?: number;
  casing?: CaptionCasing;
  outlineWidth?: number;
  outlineColor?: string;
  backgroundEnabled?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  shadowStrength?: CaptionShadowStrength;
  shadowColor?: string;
  shadowOpacity?: number;
  emphasisMode?: CaptionEmphasisMode;
  alignment?: CaptionAlignment;
  letterSpacing?: CaptionLetterSpacing;
  italic?: boolean;
}

export interface SavedCaptionPresetRow {
  id: string;
  user_id: string;
  name: string;
  style: CaptionStyleConfig;
  created_at: string;
  updated_at: string;
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
  fontFamily: CaptionFontId;
  cssFontFamily: string;
  assFontFamily: string;
  textColor: string;
  activeWordColor: string;
  activeWordContrastText: string;
  highlightBgColor: string;
  highlightBgOpacity: number;
  pillActiveTextColor: string;
  casing: CaptionCasing;
  outlineWidth: number;
  outlineColor: string;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  shadowStrength: CaptionShadowStrength;
  shadowColor: string;
  shadowOpacity: number;
  emphasisMode: CaptionEmphasisMode;
  alignment: CaptionAlignment;
  letterSpacing: CaptionLetterSpacing;
  cssLetterSpacing: string;
  assSpacing: number;
  italic: boolean;
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
  fontFamily: "poppins",
  textColor: "#F5F1E8",
  activeWordColor: "#A78BFA",
  casing: "uppercase",
  outlineWidth: 0,
  outlineColor: "#0D0E12",
  backgroundEnabled: true,
  backgroundColor: "#0D0E12",
  backgroundOpacity: 60,
  shadowStrength: "soft",
  emphasisMode: "pill",
  alignment: "center",
  letterSpacing: "normal",
  italic: false,
};

export interface BuiltInStyleTemplate {
  id: string;
  name: string;
  category: CaptionTemplateCategory;
  description: string;
  style: CaptionStyleConfig;
}

export const CAPTION_TEMPLATE_CATEGORIES: CaptionTemplateCategory[] = [
  "Creator",
  "Clean",
  "Bold",
  "Editorial",
];

export const BUILTIN_STYLE_TEMPLATES: BuiltInStyleTemplate[] = [
  // --- CREATOR ---
  {
    id: "word-highlight",
    name: "Keyword Highlight",
    category: "Creator",
    description: "Kinetic violet pill tracking every spoken word.",
    style: {
      preset: "word-highlight",
      fontSize: "md",
      verticalPosition: 14,
      accent: "violet",
      fontFamily: "poppins",
      textColor: "#F5F1E8",
      activeWordColor: "#A78BFA",
      casing: "uppercase",
      outlineWidth: 0,
      outlineColor: "#0D0E12",
      backgroundEnabled: true,
      backgroundColor: "#0D0E12",
      backgroundOpacity: 60,
      shadowStrength: "soft",
      emphasisMode: "pill",
      alignment: "center",
      letterSpacing: "normal",
      italic: false,
    },
  },
  {
    id: "underline",
    name: "Underline",
    category: "Creator",
    description: "Crisp violet underline gliding under each active word.",
    style: {
      preset: "boxed",
      fontSize: "md",
      verticalPosition: 15,
      accent: "violet",
      fontFamily: "poppins",
      textColor: "#F5F1E8",
      activeWordColor: "#A78BFA",
      casing: "original",
      outlineWidth: 0,
      outlineColor: "#0D0E12",
      backgroundEnabled: true,
      backgroundColor: "#13151B",
      backgroundOpacity: 84,
      shadowStrength: "soft",
      emphasisMode: "underline",
      alignment: "center",
      letterSpacing: "normal",
      italic: false,
    },
  },
  {
    id: "creator-pop",
    name: "Creator Pop",
    category: "Creator",
    description: "Floating bold type with sky-blue active word scale pop.",
    style: {
      preset: "clean",
      fontSize: "lg",
      verticalPosition: 17,
      accent: "violet",
      fontFamily: "poppins",
      textColor: "#FFFFFF",
      activeWordColor: "#38BDF8",
      casing: "original",
      outlineWidth: 3,
      outlineColor: "#0D0E12",
      backgroundEnabled: false,
      backgroundColor: "#0D0E12",
      backgroundOpacity: 0,
      shadowStrength: "strong",
      emphasisMode: "scale",
      alignment: "center",
      letterSpacing: "tight",
      italic: false,
    },
  },

  // --- CLEAN ---
  {
    id: "minimal",
    name: "Minimal",
    category: "Clean",
    description: "Quiet, steady subtitle line with zero word-by-word motion.",
    style: {
      preset: "clean",
      fontSize: "sm",
      verticalPosition: 12,
      accent: "violet",
      fontFamily: "poppins",
      textColor: "#F5F1E8",
      activeWordColor: "#F5F1E8",
      casing: "original",
      outlineWidth: 1,
      outlineColor: "#0D0E12",
      backgroundEnabled: false,
      backgroundColor: "#0D0E12",
      backgroundOpacity: 0,
      shadowStrength: "soft",
      emphasisMode: "cue",
      alignment: "center",
      letterSpacing: "normal",
      italic: false,
    },
  },
  {
    id: "clean",
    name: "Clean",
    category: "Clean",
    description: "Floating sans with crisp stroke and subtle active word color.",
    style: {
      preset: "clean",
      fontSize: "md",
      verticalPosition: 14,
      accent: "violet",
      fontFamily: "poppins",
      textColor: "#F5F1E8",
      activeWordColor: "#C4B5FD",
      casing: "original",
      outlineWidth: 2,
      outlineColor: "#0D0E12",
      backgroundEnabled: false,
      backgroundColor: "#0D0E12",
      backgroundOpacity: 0,
      shadowStrength: "strong",
      emphasisMode: "color",
      alignment: "center",
      letterSpacing: "normal",
      italic: false,
    },
  },
  {
    id: "broadcast",
    name: "Broadcast",
    category: "Clean",
    description: "Steady dark subtitle bar built for interviews and explainers.",
    style: {
      preset: "boxed",
      fontSize: "md",
      verticalPosition: 11,
      accent: "violet",
      fontFamily: "poppins",
      textColor: "#FFFFFF",
      activeWordColor: "#FFFFFF",
      casing: "original",
      outlineWidth: 0,
      outlineColor: "#0D0E12",
      backgroundEnabled: true,
      backgroundColor: "#0D0E12",
      backgroundOpacity: 88,
      shadowStrength: "none",
      emphasisMode: "cue",
      alignment: "center",
      letterSpacing: "normal",
      italic: false,
    },
  },

  // --- BOLD ---
  {
    id: "punch-display",
    name: "Punch Display",
    category: "Bold",
    description: "Tall condensed Bebas Neue with gold keyword pill.",
    style: {
      preset: "word-highlight",
      fontSize: "lg",
      verticalPosition: 18,
      accent: "violet",
      fontFamily: "bebas-neue",
      textColor: "#FFFFFF",
      activeWordColor: "#FACC15",
      casing: "uppercase",
      outlineWidth: 2,
      outlineColor: "#0D0E12",
      backgroundEnabled: true,
      backgroundColor: "#0D0E12",
      backgroundOpacity: 55,
      shadowStrength: "strong",
      emphasisMode: "pill",
      alignment: "center",
      letterSpacing: "wide",
      italic: false,
    },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    category: "Bold",
    description: "Solid black plate with vivid yellow active words for maximum clarity.",
    style: {
      preset: "boxed",
      fontSize: "lg",
      verticalPosition: 14,
      accent: "violet",
      fontFamily: "poppins",
      textColor: "#FFFFFF",
      activeWordColor: "#FACC15",
      casing: "uppercase",
      outlineWidth: 0,
      outlineColor: "#000000",
      backgroundEnabled: true,
      backgroundColor: "#000000",
      backgroundOpacity: 96,
      shadowStrength: "none",
      emphasisMode: "color",
      alignment: "center",
      letterSpacing: "normal",
      italic: false,
    },
  },
  {
    id: "street-cutout",
    name: "Poster Cutout",
    category: "Bold",
    description: "Heavy outlined display caps with coral-rose active word emphasis.",
    style: {
      preset: "clean",
      fontSize: "lg",
      verticalPosition: 19,
      accent: "violet",
      fontFamily: "bebas-neue",
      textColor: "#F5F1E8",
      activeWordColor: "#FB7185",
      casing: "uppercase",
      outlineWidth: 4,
      outlineColor: "#0D0E12",
      backgroundEnabled: false,
      backgroundColor: "#0D0E12",
      backgroundOpacity: 0,
      shadowStrength: "strong",
      emphasisMode: "scale",
      alignment: "center",
      letterSpacing: "wide",
      italic: false,
    },
  },

  // --- EDITORIAL ---
  {
    id: "editorial-serif",
    name: "Editorial",
    category: "Editorial",
    description: "Refined DM Serif Display over a dark translucent plate.",
    style: {
      preset: "boxed",
      fontSize: "md",
      verticalPosition: 15,
      accent: "violet",
      fontFamily: "dm-serif",
      textColor: "#F5F1E8",
      activeWordColor: "#C4B5FD",
      casing: "original",
      outlineWidth: 0,
      outlineColor: "#0D0E12",
      backgroundEnabled: true,
      backgroundColor: "#13151B",
      backgroundOpacity: 86,
      shadowStrength: "soft",
      emphasisMode: "underline",
      alignment: "center",
      letterSpacing: "normal",
      italic: false,
    },
  },
  {
    id: "lower-third",
    name: "Lower Third",
    category: "Editorial",
    description: "Left-aligned Space Mono lower-third tag with mint keyword accent.",
    style: {
      preset: "boxed",
      fontSize: "sm",
      verticalPosition: 12,
      accent: "mint",
      fontFamily: "space-mono",
      textColor: "#F5F1E8",
      activeWordColor: "#49E6B3",
      casing: "uppercase",
      outlineWidth: 0,
      outlineColor: "#0D0E12",
      backgroundEnabled: true,
      backgroundColor: "#0D0E12",
      backgroundOpacity: 90,
      shadowStrength: "soft",
      emphasisMode: "color",
      alignment: "left",
      letterSpacing: "wide",
      italic: false,
    },
  },
  {
    id: "documentary",
    name: "Documentary",
    category: "Editorial",
    description: "Warm cinema-gold italic serif for storytelling and essays.",
    style: {
      preset: "clean",
      fontSize: "md",
      verticalPosition: 11,
      accent: "violet",
      fontFamily: "dm-serif",
      textColor: "#FDE68A",
      activeWordColor: "#FDE68A",
      casing: "original",
      outlineWidth: 2,
      outlineColor: "#0D0E12",
      backgroundEnabled: false,
      backgroundColor: "#0D0E12",
      backgroundOpacity: 0,
      shadowStrength: "strong",
      emphasisMode: "cue",
      alignment: "center",
      letterSpacing: "normal",
      italic: true,
    },
  },
  {
    id: "devanagari-clean",
    name: "Devanagari Clean",
    category: "Clean",
    description: "Noto Sans Devanagari tuned for Hindi and bilingual clips.",
    style: {
      preset: "clean",
      fontSize: "md",
      verticalPosition: 14,
      accent: "violet",
      fontFamily: "noto-devanagari",
      textColor: "#F2F1F6",
      activeWordColor: "#A99AF2",
      casing: "original",
      outlineWidth: 2,
      outlineColor: "#101116",
      backgroundEnabled: false,
      backgroundColor: "#101116",
      backgroundOpacity: 0,
      shadowStrength: "strong",
      shadowColor: "#0D0E12",
      shadowOpacity: 85,
      emphasisMode: "color",
      alignment: "center",
      letterSpacing: "normal",
      italic: false,
    },
  },
  {
    id: "devanagari-pop",
    name: "Devanagari Pop",
    category: "Creator",
    description: "High-visibility periwinkle highlight pill for Devanagari speech.",
    style: {
      preset: "word-highlight",
      fontSize: "md",
      verticalPosition: 16,
      accent: "violet",
      fontFamily: "noto-devanagari",
      textColor: "#FFFFFF",
      activeWordColor: "#A99AF2",
      highlightBgColor: "#A99AF2",
      highlightBgOpacity: 100,
      casing: "original",
      outlineWidth: 0,
      outlineColor: "#101116",
      backgroundEnabled: true,
      backgroundColor: "#101116",
      backgroundOpacity: 68,
      shadowStrength: "soft",
      shadowColor: "#0D0E12",
      shadowOpacity: 80,
      emphasisMode: "pill",
      alignment: "center",
      letterSpacing: "normal",
      italic: false,
    },
  },
  {
    id: "studio-bold",
    name: "Studio Bold",
    category: "Bold",
    description: "Heavy Montserrat caps with dark-violet pill and crisp yellow text.",
    style: {
      preset: "word-highlight",
      fontSize: "lg",
      verticalPosition: 16,
      accent: "violet",
      fontFamily: "montserrat",
      textColor: "#F2F1F6",
      activeWordColor: "#FDE047",
      highlightBgColor: "#34304A",
      highlightBgOpacity: 95,
      casing: "uppercase",
      outlineWidth: 1,
      outlineColor: "#101116",
      backgroundEnabled: true,
      backgroundColor: "#101116",
      backgroundOpacity: 55,
      shadowStrength: "soft",
      shadowColor: "#0D0E12",
      shadowOpacity: 85,
      emphasisMode: "pill",
      alignment: "center",
      letterSpacing: "normal",
      italic: false,
    },
  },
  {
    id: "cinema-sub",
    name: "Cinema Sub",
    category: "Editorial",
    description: "Balanced Montserrat subtitle bar with warm off-white ink.",
    style: {
      preset: "boxed",
      fontSize: "sm",
      verticalPosition: 11,
      accent: "violet",
      fontFamily: "montserrat",
      textColor: "#F2F1F6",
      activeWordColor: "#A99AF2",
      casing: "original",
      outlineWidth: 0,
      outlineColor: "#101116",
      backgroundEnabled: true,
      backgroundColor: "#101116",
      backgroundOpacity: 82,
      shadowStrength: "soft",
      shadowColor: "#0D0E12",
      shadowOpacity: 75,
      emphasisMode: "color",
      alignment: "center",
      letterSpacing: "normal",
      italic: false,
    },
  },
];

export const MIN_VERTICAL_POSITION = 8;
export const MAX_VERTICAL_POSITION = 85;
export const MAX_CLIP_DURATION_MS = 180_000;
export const MAX_CUES_PER_REVISION = 500;
export const MIN_CUE_SPAN_MS = 200;

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value.trim());
}

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (isValidHexColor(value)) {
    return value.trim().toUpperCase();
  }
  return fallback.toUpperCase();
}

export function hexToRgba(hex: string, alpha01: number): string {
  const clean = normalizeHexColor(hex, "#070B10").slice(1);
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const clamped = Math.max(0, Math.min(1, alpha01));
  return `rgba(${r}, ${g}, ${b}, ${clamped.toFixed(2)})`;
}

export function hexToAssBgr(hex: string): string {
  const clean = normalizeHexColor(hex, "#A78BFA").slice(1);
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `${b}${g}${r}`;
}

export function getContrastingInkForHex(hex: string): string {
  const clean = normalizeHexColor(hex, "#A78BFA").slice(1);
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  // Relative luminance heuristic for crisp text contrast on active-word pill
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? "#070B10" : "#F5F1E8";
}

export function applyCaptionCasing(text: string, casing: CaptionCasing): string {
  if (casing === "uppercase") return text.toUpperCase();
  if (casing === "lowercase") return text.toLowerCase();
  return text;
}

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
 * and the server-side FFmpeg/libass renderer. Preserves legacy saved styles.
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

  const fontFamily: CaptionFontId =
    style?.fontFamily && style.fontFamily in CAPTION_FONTS
      ? style.fontFamily
      : "poppins";
  const fontDesc = CAPTION_FONTS[fontFamily];

  const textColor = normalizeHexColor(style?.textColor, "#F5F1E8");
  const activeWordColor = normalizeHexColor(
    style?.activeWordColor,
    accentMeta.hex
  );
  const highlightBgColor = normalizeHexColor(
    style?.highlightBgColor,
    activeWordColor
  );
  const highlightBgOpacity =
    typeof style?.highlightBgOpacity === "number" &&
    Number.isFinite(style.highlightBgOpacity)
      ? Math.max(0, Math.min(100, Math.round(style.highlightBgOpacity)))
      : 100;
  const activeWordContrastText = getContrastingInkForHex(highlightBgColor);
  const pillActiveTextColor =
    highlightBgColor !== activeWordColor
      ? activeWordColor
      : activeWordContrastText;

  const casing: CaptionCasing =
    style?.casing === "original" ||
    style?.casing === "uppercase" ||
    style?.casing === "lowercase"
      ? style.casing
      : preset === "word-highlight"
        ? "uppercase"
        : "original";

  const defaultOutline = preset === "clean" ? 2 : 0;
  const outlineWidth =
    typeof style?.outlineWidth === "number" && Number.isFinite(style.outlineWidth)
      ? Math.max(0, Math.min(6, Math.round(style.outlineWidth)))
      : defaultOutline;
  const outlineColor = normalizeHexColor(style?.outlineColor, "#070B10");

  const defaultBgEnabled = preset !== "clean";
  const backgroundEnabled =
    typeof style?.backgroundEnabled === "boolean"
      ? style.backgroundEnabled
      : defaultBgEnabled;
  const backgroundColor = normalizeHexColor(style?.backgroundColor, "#070B10");
  const defaultBgOpacity = preset === "boxed" ? 82 : preset === "word-highlight" ? 60 : 0;
  const backgroundOpacity =
    typeof style?.backgroundOpacity === "number" &&
    Number.isFinite(style.backgroundOpacity)
      ? Math.max(0, Math.min(100, Math.round(style.backgroundOpacity)))
      : defaultBgOpacity;

  const shadowStrength: CaptionShadowStrength =
    style?.shadowStrength === "none" ||
    style?.shadowStrength === "soft" ||
    style?.shadowStrength === "strong"
      ? style.shadowStrength
      : preset === "clean"
        ? "strong"
        : "soft";
  const shadowColor = normalizeHexColor(style?.shadowColor, "#0D0E12");
  const shadowOpacity =
    typeof style?.shadowOpacity === "number" &&
    Number.isFinite(style.shadowOpacity)
      ? Math.max(0, Math.min(100, Math.round(style.shadowOpacity)))
      : 85;

  const defaultEmphasis: CaptionEmphasisMode =
    preset === "word-highlight"
      ? "pill"
      : preset === "boxed"
        ? "underline"
        : "color";
  const emphasisMode: CaptionEmphasisMode =
    style?.emphasisMode === "pill" ||
    style?.emphasisMode === "color" ||
    style?.emphasisMode === "underline" ||
    style?.emphasisMode === "scale" ||
    style?.emphasisMode === "cue"
      ? style.emphasisMode
      : defaultEmphasis;

  const alignment: CaptionAlignment =
    style?.alignment === "left" ? "left" : "center";

  const letterSpacing: CaptionLetterSpacing =
    style?.letterSpacing === "tight" ||
    style?.letterSpacing === "normal" ||
    style?.letterSpacing === "wide"
      ? style.letterSpacing
      : "normal";

  const cssLetterSpacing =
    letterSpacing === "tight"
      ? "-0.02em"
      : letterSpacing === "wide"
        ? "0.06em"
        : preset === "word-highlight"
          ? "0.01em"
          : "-0.01em";

  const assSpacing =
    letterSpacing === "tight"
      ? -0.5
      : letterSpacing === "wide"
        ? 2.2
        : preset === "word-highlight"
          ? 0.4
          : 0;

  const italic = Boolean(style?.italic);

  const metrics = FONT_SIZE_TABLE[fontSize];
  return {
    preset,
    fontSize,
    fontScale: metrics.scale,
    previewFontSizeRem: metrics.previewRem,
    renderFontSizePx1080: metrics.renderPx1080,
    bottomPercent,
    maxWidthPercent:
      alignment === "left" ? 88 : preset === "word-highlight" ? 94 : 90,
    accent,
    accentHex: activeWordColor,
    accentAssBgr: hexToAssBgr(activeWordColor),
    accentShadowRgba: hexToRgba(activeWordColor, 0.4),
    fontFamily,
    cssFontFamily: fontDesc.cssFamily,
    assFontFamily: fontDesc.assFamily,
    textColor,
    activeWordColor,
    activeWordContrastText,
    highlightBgColor,
    highlightBgOpacity,
    pillActiveTextColor,
    casing,
    outlineWidth,
    outlineColor,
    backgroundEnabled,
    backgroundColor,
    backgroundOpacity,
    shadowStrength,
    shadowColor,
    shadowOpacity,
    emphasisMode,
    alignment,
    letterSpacing,
    cssLetterSpacing,
    assSpacing,
    italic,
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
    fontFamily: layout.fontFamily,
    textColor: layout.textColor,
    activeWordColor: layout.activeWordColor,
    highlightBgColor: layout.highlightBgColor,
    highlightBgOpacity: layout.highlightBgOpacity,
    casing: layout.casing,
    outlineWidth: layout.outlineWidth,
    outlineColor: layout.outlineColor,
    backgroundEnabled: layout.backgroundEnabled,
    backgroundColor: layout.backgroundColor,
    backgroundOpacity: layout.backgroundOpacity,
    shadowStrength: layout.shadowStrength,
    shadowColor: layout.shadowColor,
    shadowOpacity: layout.shadowOpacity,
    emphasisMode: layout.emphasisMode,
    alignment: layout.alignment,
    letterSpacing: layout.letterSpacing,
    italic: layout.italic,
  };
}

export function validateCaptionStyle(
  rawStyle: unknown
):
  | { ok: true; normalizedStyle: CaptionStyleConfig }
  | { ok: false; error: string } {
  if (!rawStyle || typeof rawStyle !== "object") {
    return { ok: false, error: "Caption style configuration is required." };
  }

  const s = rawStyle as Partial<CaptionStyleConfig>;
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
  if (s.fontFamily !== undefined && !(s.fontFamily in CAPTION_FONTS)) {
    return { ok: false, error: "Invalid caption font family." };
  }
  if (s.textColor !== undefined && !isValidHexColor(s.textColor)) {
    return { ok: false, error: "Invalid text color hex value." };
  }
  if (s.activeWordColor !== undefined && !isValidHexColor(s.activeWordColor)) {
    return { ok: false, error: "Invalid active word color hex value." };
  }
  if (
    s.highlightBgColor !== undefined &&
    !isValidHexColor(s.highlightBgColor)
  ) {
    return { ok: false, error: "Invalid highlight box color hex value." };
  }
  if (
    s.highlightBgOpacity !== undefined &&
    (typeof s.highlightBgOpacity !== "number" ||
      !Number.isFinite(s.highlightBgOpacity) ||
      s.highlightBgOpacity < 0 ||
      s.highlightBgOpacity > 100)
  ) {
    return {
      ok: false,
      error: "Highlight box opacity must be between 0 and 100.",
    };
  }
  if (
    s.casing !== undefined &&
    s.casing !== "original" &&
    s.casing !== "uppercase" &&
    s.casing !== "lowercase"
  ) {
    return { ok: false, error: "Invalid caption casing." };
  }
  if (
    s.outlineWidth !== undefined &&
    (typeof s.outlineWidth !== "number" ||
      !Number.isFinite(s.outlineWidth) ||
      s.outlineWidth < 0 ||
      s.outlineWidth > 6)
  ) {
    return { ok: false, error: "Outline width must be between 0 and 6." };
  }
  if (s.outlineColor !== undefined && !isValidHexColor(s.outlineColor)) {
    return { ok: false, error: "Invalid outline color hex value." };
  }
  if (
    s.backgroundEnabled !== undefined &&
    typeof s.backgroundEnabled !== "boolean"
  ) {
    return { ok: false, error: "Invalid background toggle." };
  }
  if (s.backgroundColor !== undefined && !isValidHexColor(s.backgroundColor)) {
    return { ok: false, error: "Invalid background color hex value." };
  }
  if (
    s.backgroundOpacity !== undefined &&
    (typeof s.backgroundOpacity !== "number" ||
      !Number.isFinite(s.backgroundOpacity) ||
      s.backgroundOpacity < 0 ||
      s.backgroundOpacity > 100)
  ) {
    return { ok: false, error: "Background opacity must be between 0 and 100." };
  }
  if (
    s.shadowStrength !== undefined &&
    s.shadowStrength !== "none" &&
    s.shadowStrength !== "soft" &&
    s.shadowStrength !== "strong"
  ) {
    return { ok: false, error: "Invalid shadow strength." };
  }
  if (s.shadowColor !== undefined && !isValidHexColor(s.shadowColor)) {
    return { ok: false, error: "Invalid shadow color hex value." };
  }
  if (
    s.shadowOpacity !== undefined &&
    (typeof s.shadowOpacity !== "number" ||
      !Number.isFinite(s.shadowOpacity) ||
      s.shadowOpacity < 0 ||
      s.shadowOpacity > 100)
  ) {
    return { ok: false, error: "Shadow opacity must be between 0 and 100." };
  }
  if (
    s.emphasisMode !== undefined &&
    s.emphasisMode !== "pill" &&
    s.emphasisMode !== "color" &&
    s.emphasisMode !== "underline" &&
    s.emphasisMode !== "scale" &&
    s.emphasisMode !== "cue"
  ) {
    return { ok: false, error: "Invalid caption emphasis mode." };
  }
  if (
    s.alignment !== undefined &&
    s.alignment !== "center" &&
    s.alignment !== "left"
  ) {
    return { ok: false, error: "Invalid caption alignment." };
  }
  if (
    s.letterSpacing !== undefined &&
    s.letterSpacing !== "tight" &&
    s.letterSpacing !== "normal" &&
    s.letterSpacing !== "wide"
  ) {
    return { ok: false, error: "Invalid caption letter spacing." };
  }
  if (s.italic !== undefined && typeof s.italic !== "boolean") {
    return { ok: false, error: "Invalid italic setting." };
  }

  return {
    ok: true,
    normalizedStyle: normalizeCaptionStyle(s),
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

function clampMonotonicWords(
  words: NormalizedCaptionWord[],
  cueStartMs: number,
  cueEndMs: number
): NormalizedCaptionWord[] {
  let prevEnd = cueStartMs;
  return words.map((w) => {
    const start = Math.max(prevEnd, Math.min(cueEndMs, Math.round(w.start_ms)));
    const end = Math.max(start, Math.min(cueEndMs, Math.round(w.end_ms)));
    prevEnd = end;
    return { ...w, start_ms: start, end_ms: end };
  });
}

/**
 * Splits a cue cleanly at playhead `splitMs`, preserving valid word-level timing
 * whenever words partition cleanly across the split boundary, and falling back
 * to cue-level timing when alignment is uncertain.
 */
export function splitCueAtTimeMs(
  cues: EditorCue[],
  cueId: string,
  splitMs: number
):
  | { ok: true; cues: EditorCue[]; firstCueId: string; secondCueId: string }
  | { ok: false; error: string } {
  const idx = cues.findIndex((c) => c.id === cueId);
  if (idx < 0) return { ok: false, error: "Select a cue to split." };

  const cue = cues[idx];
  const roundedSplit = Math.round(splitMs);
  if (
    roundedSplit < cue.start_ms + MIN_CUE_SPAN_MS ||
    roundedSplit > cue.end_ms - MIN_CUE_SPAN_MS
  ) {
    return {
      ok: false,
      error: `Move the playhead inside Cue #${idx + 1} (at least 0.20s from both edges) to split.`,
    };
  }

  const secondId = `${cue.id}-s${Date.now().toString(36).slice(-4)}`;
  const isWordSynced = cue.timing_mode === "word" && cue.words.length >= 2;

  let firstCue: EditorCue;
  let secondCue: EditorCue;

  if (isWordSynced) {
    // Partition words by midpoint relative to splitMs, ensuring both halves get >= 1 word
    let splitWordIdx = cue.words.findIndex(
      (w) => (w.start_ms + w.end_ms) / 2 >= roundedSplit
    );
    if (splitWordIdx <= 0) splitWordIdx = 1;
    if (splitWordIdx >= cue.words.length) splitWordIdx = cue.words.length - 1;

    const leftWordsRaw = cue.words.slice(0, splitWordIdx);
    const rightWordsRaw = cue.words.slice(splitWordIdx);

    const leftBoundary = Math.max(
      cue.start_ms + MIN_CUE_SPAN_MS,
      Math.min(cue.end_ms - MIN_CUE_SPAN_MS, roundedSplit)
    );

    const leftWords = clampMonotonicWords(leftWordsRaw, cue.start_ms, leftBoundary);
    const rightWords = clampMonotonicWords(rightWordsRaw, leftBoundary, cue.end_ms);

    firstCue = {
      id: cue.id,
      start_ms: cue.start_ms,
      end_ms: leftBoundary,
      text: leftWords.map((w) => w.text).join(" "),
      words: leftWords,
      timing_mode: "word",
    };
    secondCue = {
      id: secondId,
      start_ms: leftBoundary,
      end_ms: cue.end_ms,
      text: rightWords.map((w) => w.text).join(" "),
      words: rightWords,
      timing_mode: "word",
    };
  } else {
    // Cue-level fallback when words aren't available or single-word cue is split
    const tokens = cue.text.trim().split(/\s+/).filter(Boolean);
    let leftText = cue.text.trim();
    let rightText = cue.text.trim();
    if (tokens.length >= 2) {
      const ratio =
        (roundedSplit - cue.start_ms) / Math.max(1, cue.end_ms - cue.start_ms);
      const cut = Math.max(
        1,
        Math.min(tokens.length - 1, Math.round(tokens.length * ratio))
      );
      leftText = tokens.slice(0, cut).join(" ");
      rightText = tokens.slice(cut).join(" ");
    }

    firstCue = {
      id: cue.id,
      start_ms: cue.start_ms,
      end_ms: roundedSplit,
      text: leftText,
      words: [],
      timing_mode: "cue",
    };
    secondCue = {
      id: secondId,
      start_ms: roundedSplit,
      end_ms: cue.end_ms,
      text: rightText,
      words: [],
      timing_mode: "cue",
    };
  }

  const nextCues = [
    ...cues.slice(0, idx),
    firstCue,
    secondCue,
    ...cues.slice(idx + 1),
  ];
  return {
    ok: true,
    cues: nextCues,
    firstCueId: firstCue.id,
    secondCueId: secondCue.id,
  };
}

/**
 * Merges cue at `firstCueIndex` with its immediate successor (`firstCueIndex + 1`).
 * Preserves per-word timing when both cues are word-synced and monotonic; falls back
 * to cue-level otherwise.
 */
export function mergeAdjacentCues(
  cues: EditorCue[],
  firstCueIndex: number
):
  | { ok: true; cues: EditorCue[]; mergedCueId: string }
  | { ok: false; error: string } {
  if (firstCueIndex < 0 || firstCueIndex >= cues.length - 1) {
    return { ok: false, error: "Select a cue that has a following cue to merge." };
  }

  const first = cues[firstCueIndex];
  const second = cues[firstCueIndex + 1];
  const combinedText = `${first.text.trim()} ${second.text.trim()}`.trim();
  if (combinedText.length > 240) {
    return {
      ok: false,
      error: "Merged cue text exceeds the 240-character limit.",
    };
  }

  const canKeepWords =
    first.timing_mode === "word" &&
    second.timing_mode === "word" &&
    first.words.length > 0 &&
    second.words.length > 0;

  let mergedWords: NormalizedCaptionWord[] = [];
  let timingMode: "word" | "cue" = "cue";

  if (canKeepWords) {
    mergedWords = clampMonotonicWords(
      [...first.words, ...second.words],
      first.start_ms,
      second.end_ms
    );
    timingMode = "word";
  }

  const mergedCue: EditorCue = {
    id: first.id,
    start_ms: first.start_ms,
    end_ms: second.end_ms,
    text: combinedText,
    words: mergedWords,
    timing_mode: timingMode,
  };

  const nextCues = [
    ...cues.slice(0, firstCueIndex),
    mergedCue,
    ...cues.slice(firstCueIndex + 2),
  ];
  return { ok: true, cues: nextCues, mergedCueId: mergedCue.id };
}

/**
 * Edits a single timed word inside a word-synced cue.
 * - Single non-empty token -> preserves exact word-level timestamps!
 * - Multi-word replacement or deletion -> updates cue text cleanly and falls back to cue-level timing.
 */
export function editSingleWordInCue(
  cues: EditorCue[],
  cueId: string,
  wordId: string,
  nextWordText: string
): EditorCue[] {
  const cleaned = nextWordText.trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  return cues.map((cue) => {
    if (cue.id !== cueId || cue.timing_mode !== "word") return cue;
    const wIdx = cue.words.findIndex((w) => w.id === wordId);
    if (wIdx < 0) return cue;

    if (tokens.length === 1) {
      const nextWords = cue.words.map((w, idx) =>
        idx === wIdx ? { ...w, text: tokens[0] } : w
      );
      return {
        ...cue,
        text: nextWords.map((w) => w.text).join(" "),
        words: nextWords,
        timing_mode: "word",
      };
    }

    // Multi-word insertion or word deletion: update text and fall back safely to cue-level timing
    const nextTokens = [
      ...cue.words.slice(0, wIdx).map((w) => w.text),
      ...tokens,
      ...cue.words.slice(wIdx + 1).map((w) => w.text),
    ];
    const nextText = nextTokens.join(" ").trim();
    if (!nextText) return cue;
    return {
      ...cue,
      text: nextText,
      words: [],
      timing_mode: "cue",
    };
  });
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
  const styleCheck = validateCaptionStyle(input.style);
  if (!styleCheck.ok) {
    return styleCheck;
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
    normalizedStyle: styleCheck.normalizedStyle,
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
