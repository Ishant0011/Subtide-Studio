"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  Bookmark,
  Check,
  ChevronDown,
  Frame,
  Loader2,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  BUILTIN_STYLE_TEMPLATES,
  CAPTION_FONTS,
  CAPTION_FONT_LIST,
  CAPTION_TEMPLATE_CATEGORIES,
  MAX_VERTICAL_POSITION,
  MIN_VERTICAL_POSITION,
  QUICK_PICK_FONT_IDS,
  applyCaptionCasing,
  computeCaptionLayout,
  hexToRgba,
  normalizeCaptionStyle,
  type CaptionCasing,
  type CaptionEmphasisMode,
  type CaptionFontSize,
  type CaptionLetterSpacing,
  type CaptionShadowStrength,
  type CaptionStyleConfig,
  type CaptionTemplateCategory,
  type SavedCaptionPresetRow,
} from "@/lib/caption-editor";

export type StylePanelSubtab = "presets" | "style";

interface StudioStylePanelProps {
  style: CaptionStyleConfig;
  onUpdateStyle: (patch: Partial<CaptionStyleConfig>) => void;
  showSizeAndPosition?: boolean;
  subtitle?: string;
  showSafeArea?: boolean;
  onToggleSafeArea?: (next: boolean) => void;
  personalPresets?: SavedCaptionPresetRow[];
  onPersonalPresetsChange?: (next: SavedCaptionPresetRow[]) => void;
  enablePersonalPresets?: boolean;
  defaultTab?: StylePanelSubtab;
}

const FONT_SIZE_OPTIONS: Array<{ id: CaptionFontSize; label: string }> = [
  { id: "sm", label: "Small" },
  { id: "md", label: "Medium" },
  { id: "lg", label: "Large" },
];

const CASING_OPTIONS: Array<{ id: CaptionCasing; label: string }> = [
  { id: "original", label: "Original" },
  { id: "uppercase", label: "UPPER" },
  { id: "lowercase", label: "lower" },
];

const SHADOW_OPTIONS: Array<{ id: CaptionShadowStrength; label: string }> = [
  { id: "none", label: "None" },
  { id: "soft", label: "Soft" },
  { id: "strong", label: "Strong" },
];

const EMPHASIS_OPTIONS: Array<{ id: CaptionEmphasisMode; label: string }> = [
  { id: "pill", label: "Pill" },
  { id: "color", label: "Color" },
  { id: "underline", label: "Underline" },
  { id: "scale", label: "Pop" },
  { id: "cue", label: "Steady" },
];

const SPACING_OPTIONS: Array<{ id: CaptionLetterSpacing; label: string }> = [
  { id: "tight", label: "Tight" },
  { id: "normal", label: "Normal" },
  { id: "wide", label: "Wide" },
];

const PLACEMENT_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "Bottom", value: 14 },
  { label: "Middle", value: 45 },
  { label: "Top", value: 74 },
];

const TEXT_COLOR_SWATCHES = ["#F5F1E8", "#FFFFFF", "#FDE68A", "#E2E8F0"];
const ACTIVE_WORD_SWATCHES = [
  "#A78BFA",
  "#49E6B3",
  "#FACC15",
  "#38BDF8",
  "#FB7185",
];
const BG_COLOR_SWATCHES = ["#0D0E12", "#191C24", "#1E1B4B", "#000000"];

function isMatchingStyle(
  current: CaptionStyleConfig,
  candidate: CaptionStyleConfig
): boolean {
  const a = computeCaptionLayout(current);
  const b = computeCaptionLayout(candidate);
  return (
    a.preset === b.preset &&
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.activeWordColor === b.activeWordColor &&
    a.textColor === b.textColor &&
    a.emphasisMode === b.emphasisMode &&
    a.alignment === b.alignment &&
    a.casing === b.casing &&
    a.italic === b.italic
  );
}

function LivePresetSwatch({ style }: { style: Partial<CaptionStyleConfig> }) {
  const layout = computeCaptionLayout(style);
  const isDevanagari = layout.fontFamily === "noto-devanagari";
  const w1 = isDevanagari ? "हर" : applyCaptionCasing("Keep", layout.casing);
  const w2 = isDevanagari ? "शब्द" : applyCaptionCasing("your", layout.casing);
  const w3 = isDevanagari ? "साफ़" : applyCaptionCasing("style", layout.casing);
  const bgRgba = layout.backgroundEnabled
    ? hexToRgba(layout.backgroundColor, layout.backgroundOpacity / 100)
    : "transparent";
  const highlightBgRgba = hexToRgba(
    layout.highlightBgColor,
    layout.highlightBgOpacity / 100
  );

  const textShadow =
    layout.outlineWidth > 0
      ? `-1px -1px 0 ${layout.outlineColor}, 1px -1px 0 ${layout.outlineColor}, -1px 1px 0 ${layout.outlineColor}, 1px 1px 0 ${layout.outlineColor}`
      : layout.shadowStrength !== "none"
        ? "0 1px 4px rgba(0,0,0,0.85)"
        : undefined;

  const typoStyle = {
    fontFamily: layout.cssFontFamily,
    letterSpacing: layout.cssLetterSpacing,
    fontStyle: layout.italic ? ("italic" as const) : ("normal" as const),
  };

  const alignClass =
    layout.alignment === "left" ? "justify-start px-2.5" : "justify-center px-2";

  if (layout.preset === "word-highlight" || layout.emphasisMode === "pill") {
    return (
      <div
        aria-hidden="true"
        style={typoStyle}
        className={`flex h-9 w-full items-center gap-1 rounded-lg bg-page ${alignClass} text-[11px] font-extrabold`}
      >
        <span style={{ color: layout.textColor, opacity: 0.85, textShadow }}>
          {w1}
        </span>
        <span
          className="rounded px-1.5 py-0.5"
          style={{
            backgroundColor: highlightBgRgba,
            color: layout.pillActiveTextColor,
          }}
        >
          {w2}
        </span>
        <span style={{ color: layout.textColor, opacity: 0.85, textShadow }}>
          {w3}
        </span>
      </div>
    );
  }

  if (layout.preset === "boxed") {
    return (
      <div
        aria-hidden="true"
        style={typoStyle}
        className={`flex h-9 w-full items-center rounded-lg bg-page ${alignClass}`}
      >
        <span
          style={{ backgroundColor: bgRgba, color: layout.textColor, textShadow }}
          className={`truncate rounded-md px-2 py-0.5 text-[11px] font-bold ${
            layout.alignment === "left"
              ? "border-l-2 border-l-accent"
              : "border border-ink/12"
          }`}
        >
          {w1}{" "}
          <span
            className={
              layout.emphasisMode === "underline"
                ? "underline decoration-2 underline-offset-2"
                : ""
            }
            style={{
              color:
                layout.emphasisMode === "cue"
                  ? layout.textColor
                  : layout.activeWordColor,
              textDecorationColor:
                layout.emphasisMode === "underline"
                  ? layout.activeWordColor
                  : undefined,
            }}
          >
            {w2}
          </span>{" "}
          {w3}
        </span>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      style={typoStyle}
      className={`flex h-9 w-full items-center gap-1 rounded-lg bg-page ${alignClass} text-[11px] font-bold`}
    >
      <span style={{ color: layout.textColor, opacity: 0.88, textShadow }}>
        {w1}
      </span>
      <span
        className={
          layout.emphasisMode === "scale"
            ? " inline-block scale-110 font-extrabold"
            : layout.emphasisMode === "underline"
              ? "underline decoration-2 underline-offset-2"
              : ""
        }
        style={{
          color:
            layout.emphasisMode === "cue"
              ? layout.textColor
              : layout.activeWordColor,
          textShadow,
        }}
      >
        {w2}
      </span>
      <span style={{ color: layout.textColor, opacity: 0.88, textShadow }}>
        {w3}
      </span>
    </div>
  );
}

export function StudioStylePanel({
  style,
  onUpdateStyle,
  showSizeAndPosition = true,
  subtitle = "Live preview",
  showSafeArea = false,
  onToggleSafeArea,
  personalPresets = [],
  onPersonalPresetsChange,
  enablePersonalPresets = false,
  defaultTab = "presets",
}: StudioStylePanelProps) {
  const layout = computeCaptionLayout(style);
  const positionPercent =
    ((style.verticalPosition - MIN_VERTICAL_POSITION) /
      (MAX_VERTICAL_POSITION - MIN_VERTICAL_POSITION)) *
    100;

  const [activeSubtab, setActiveSubtab] =
    useState<StylePanelSubtab>(defaultTab);
  const [categoryFilter, setCategoryFilter] = useState<
    "All" | CaptionTemplateCategory
  >("All");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [presetSavedNotice, setPresetSavedNotice] = useState<string | null>(
    null
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busyPresetId, setBusyPresetId] = useState<string | null>(null);
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState("");
  const fontDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!fontDropdownOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        fontDropdownRef.current &&
        !fontDropdownRef.current.contains(event.target as Node)
      ) {
        setFontDropdownOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFontDropdownOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [fontDropdownOpen]);

  const filteredFonts = useMemo(() => {
    const q = fontSearch.trim().toLowerCase();
    if (!q) return CAPTION_FONT_LIST;
    return CAPTION_FONT_LIST.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
    );
  }, [fontSearch]);

  const activeFontDesc = CAPTION_FONTS[layout.fontFamily];
  const isCustomLibraryFont = !QUICK_PICK_FONT_IDS.includes(layout.fontFamily);

  const presetInputRef = useRef<HTMLInputElement | null>(null);
  const subtabRefs = useRef<Record<StylePanelSubtab, HTMLButtonElement | null>>({
    presets: null,
    style: null,
  });

  const filteredTemplates = useMemo(
    () =>
      categoryFilter === "All"
        ? BUILTIN_STYLE_TEMPLATES
        : BUILTIN_STYLE_TEMPLATES.filter((t) => t.category === categoryFilter),
    [categoryFilter]
  );

  const handleSubtabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    current: StylePanelSubtab
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: StylePanelSubtab = current === "presets" ? "style" : "presets";
    setActiveSubtab(next);
    subtabRefs.current[next]?.focus();
  };

  const handleSavePersonalPreset = async () => {
    const trimmed = newPresetName.trim();
    if (!trimmed || !onPersonalPresetsChange) return;
    setSavingPreset(true);
    setPresetError(null);

    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          style: normalizeCaptionStyle(style),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.preset) {
        setPresetError(data.error || "Could not save preset.");
        return;
      }
      onPersonalPresetsChange([
        data.preset as SavedCaptionPresetRow,
        ...personalPresets,
      ]);
      setNewPresetName("");
      setPresetSavedNotice(`Saved "${trimmed}"`);
      setTimeout(() => {
        setPresetSavedNotice((curr) =>
          curr === `Saved "${trimmed}"` ? null : curr
        );
      }, 2400);
    } catch {
      setPresetError("Network error while saving preset.");
    } finally {
      setSavingPreset(false);
    }
  };

  const handleRenamePreset = async (id: string) => {
    const trimmed = renameDraft.trim();
    if (!trimmed || !onPersonalPresetsChange) return;
    setBusyPresetId(id);
    setPresetError(null);

    try {
      const res = await fetch(`/api/presets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.preset) {
        setPresetError(data.error || "Could not rename preset.");
        return;
      }
      onPersonalPresetsChange(
        personalPresets.map((p) =>
          p.id === id ? (data.preset as SavedCaptionPresetRow) : p
        )
      );
      setRenamingId(null);
    } catch {
      setPresetError("Network error while renaming preset.");
    } finally {
      setBusyPresetId(null);
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!onPersonalPresetsChange) return;
    setBusyPresetId(id);
    setPresetError(null);

    try {
      const res = await fetch(`/api/presets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPresetError(data.error || "Could not delete preset.");
        return;
      }
      onPersonalPresetsChange(personalPresets.filter((p) => p.id !== id));
    } catch {
      setPresetError("Network error while deleting preset.");
    } finally {
      setBusyPresetId(null);
    }
  };

  const renderSavePresetBox = (compactLabel?: boolean) => (
    <div
      data-testid="personal-presets-save-box"
      className={
        compactLabel
          ? "rounded-xl border border-ink/10 bg-inset p-2.5"
          : "mt-2"
      }
    >
      {compactLabel && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
            <Bookmark className="h-3 w-3 text-ink-muted" />
            <span>Save as preset</span>
          </span>
          {presetSavedNotice && (
            <span className="text-[10px] font-medium text-accent-hover">
              {presetSavedNotice}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          ref={presetInputRef}
          type="text"
          data-testid="preset-name-input"
          maxLength={60}
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSavePersonalPreset();
            }
          }}
          placeholder="Save current style as..."
          aria-label="New preset name"
          className="min-w-0 flex-1 rounded-lg border border-ink/12 bg-page px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          data-testid="preset-save-btn"
          disabled={savingPreset || !newPresetName.trim()}
          onClick={() => void handleSavePersonalPreset()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink/15 bg-elevated px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-accent/55 hover:text-accent-hover disabled:opacity-45"
        >
          {savingPreset ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          <span>Save</span>
        </button>
      </div>
      {presetError && (
        <p role="alert" className="mt-1.5 text-[11px] text-rose-300">
          {presetError}
        </p>
      )}
    </div>
  );

  return (
    <div
      data-testid="studio-style-panel"
      className="flex flex-col rounded-2xl border border-ink/10 bg-panel p-3.5 sm:p-4"
    >
      {/* Header + Presets / Style Tabs */}
      <div className="flex items-center justify-between gap-2 pb-2.5">
        <h2 className="text-sm font-semibold tracking-tight text-ink">
          Appearance
        </h2>
        <span className="text-[11px] text-ink-muted">{subtitle}</span>
      </div>

      <div
        role="tablist"
        aria-label="Styling sections"
        className="grid grid-cols-2 gap-1 rounded-xl border border-ink/10 bg-page p-1"
      >
        <button
          ref={(el) => {
            subtabRefs.current.presets = el;
          }}
          id="style-tab-presets"
          type="button"
          role="tab"
          data-testid="style-subtab-presets"
          aria-selected={activeSubtab === "presets"}
          aria-controls="style-tabpanel-presets"
          tabIndex={activeSubtab === "presets" ? 0 : -1}
          onClick={() => setActiveSubtab("presets")}
          onKeyDown={(e) => handleSubtabKeyDown(e, "presets")}
          className={`flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
            activeSubtab === "presets"
              ? "bg-accent text-page"
              : "text-ink-secondary hover:bg-panel hover:text-ink"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>Presets</span>
          <span
            className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
              activeSubtab === "presets"
                ? "bg-page/20 text-page"
                : "bg-elevated text-ink-muted"
            }`}
          >
            {BUILTIN_STYLE_TEMPLATES.length}
          </span>
        </button>

        <button
          ref={(el) => {
            subtabRefs.current.style = el;
          }}
          id="style-tab-style"
          type="button"
          role="tab"
          data-testid="style-subtab-style"
          aria-selected={activeSubtab === "style"}
          aria-controls="style-tabpanel-style"
          tabIndex={activeSubtab === "style" ? 0 : -1}
          onClick={() => setActiveSubtab("style")}
          onKeyDown={(e) => handleSubtabKeyDown(e, "style")}
          className={`flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
            activeSubtab === "style"
              ? "bg-accent text-page"
              : "text-ink-secondary hover:bg-panel hover:text-ink"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          <span>Style</span>
        </button>
      </div>

      {/* TAB 1: PRESETS GALLERY (12 Distinct Styles Across Clean, Creator, Bold, Editorial + Saved Presets) */}
      <div
        id="style-tabpanel-presets"
        role="tabpanel"
        aria-labelledby="style-tab-presets"
        data-testid="style-panel-presets"
        className={
          activeSubtab === "presets"
            ? "cc-panel-enter mt-3 space-y-3.5"
            : "hidden"
        }
      >
        {/* Category Filter Bar */}
        <div
          role="group"
          aria-label="Filter preset categories"
          data-testid="preset-category-filters"
          className="flex flex-wrap items-center gap-1"
        >
          {(["All", ...CAPTION_TEMPLATE_CATEGORIES] as const).map((cat) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                data-testid={`preset-category-${cat.toLowerCase()}`}
                aria-pressed={active}
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? "bg-accent text-page font-semibold"
                    : "bg-inset text-ink-secondary hover:bg-elevated hover:text-ink"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Compact 2-Column Visual Preset Gallery */}
        <div
          role="group"
          aria-label="Caption presets"
          data-testid="preset-gallery-grid"
          className="grid grid-cols-2 gap-2"
        >
          {filteredTemplates.map((tpl) => {
            const selected = isMatchingStyle(style, tpl.style);
            return (
              <button
                key={tpl.id}
                type="button"
                data-testid={`builtin-preset-${tpl.id}`}
                data-preset-category={tpl.category}
                aria-pressed={selected}
                title={tpl.description}
                onClick={() => onUpdateStyle(tpl.style)}
                className={`group flex min-w-0 flex-col gap-1.5 rounded-xl border p-2 text-left transition ${
                  selected
                    ? "border-accent bg-accent-soft"
                    : "border-ink/10 bg-inset hover:border-ink/25 hover:bg-elevated"
                }`}
              >
                <LivePresetSwatch style={tpl.style} />
                <div className="flex items-center justify-between gap-1 px-0.5">
                  <span
                    className={`truncate text-[11px] font-semibold ${
                      selected ? "text-accent-hover" : "text-ink"
                    }`}
                  >
                    {tpl.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-muted">
                    {tpl.category}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Personal Saved Presets (Owner-Scoped) or Guest Sample Mode Explanation */}
        {enablePersonalPresets ? (
          <div
            data-testid="personal-presets-section"
            className="border-t border-ink/10 pt-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
                <Bookmark className="h-3 w-3 text-ink-muted" />
                <span>Saved Presets</span>
              </span>
              <span className="font-mono text-[10px] text-ink-muted">
                {personalPresets.length}
              </span>
            </div>

            {renderSavePresetBox(false)}

            {presetSavedNotice && (
              <p className="mt-1.5 text-[11px] font-medium text-accent-hover">
                {presetSavedNotice}
              </p>
            )}

            {personalPresets.length > 0 && (
              <div className="mt-2.5 grid grid-cols-1 gap-1.5">
                {personalPresets.map((preset) => {
                  const isRenaming = renamingId === preset.id;
                  const isBusy = busyPresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      data-testid={`personal-preset-${preset.id}`}
                      className="rounded-xl border border-ink/10 bg-inset p-2"
                    >
                      {isRenaming ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            data-testid="preset-rename-input"
                            maxLength={60}
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleRenamePreset(preset.id);
                              } else if (e.key === "Escape") {
                                setRenamingId(null);
                              }
                            }}
                            aria-label="Rename preset"
                            className="min-w-0 flex-1 rounded-md border border-accent bg-page px-2 py-1 text-xs text-ink focus:outline-none"
                          />
                          <button
                            type="button"
                            data-testid="preset-rename-save-btn"
                            disabled={isBusy || !renameDraft.trim()}
                            onClick={() => void handleRenamePreset(preset.id)}
                            aria-label="Confirm rename"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent text-page"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingId(null)}
                            aria-label="Cancel rename"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-ink/12 text-ink-secondary"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            data-testid={`apply-personal-preset-${preset.name}`}
                            onClick={() =>
                              onUpdateStyle(normalizeCaptionStyle(preset.style))
                            }
                            className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-ink transition hover:text-accent-hover"
                          >
                            {preset.name}
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              disabled={isBusy}
                              aria-label={`Rename preset ${preset.name}`}
                              onClick={() => {
                                setRenamingId(preset.id);
                                setRenameDraft(preset.name);
                              }}
                              className="rounded p-1 text-ink-muted hover:bg-elevated hover:text-ink"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              aria-label={`Delete preset ${preset.name}`}
                              onClick={() => void handleDeletePreset(preset.id)}
                              className="rounded p-1 text-ink-muted hover:bg-rose-500/15 hover:text-rose-300"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="mt-1.5">
                        <LivePresetSwatch style={preset.style} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div
            data-testid="sample-presets-note"
            className="rounded-xl border border-ink/10 bg-inset px-3 py-2.5 text-[11px] leading-relaxed text-ink-secondary"
          >
            Click any preset above to preview it on the sample clip. Upload your
            own clip to save custom brand presets and export video.
          </div>
        )}
      </div>

      {/* TAB 2: STYLE (Everyday Controls First + Advanced Disclosure) */}
      <div
        id="style-tabpanel-style"
        role="tabpanel"
        aria-labelledby="style-tab-style"
        data-testid="style-panel-controls"
        className={
          activeSubtab === "style" ? "cc-panel-enter mt-3.5 space-y-4" : "hidden"
        }
      >
        {/* 1. Font Family: 4 Quick-Pick Live Cards + Single Searchable Full-Library Dropdown */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Font
            </span>
            <span
              data-testid="style-active-font-badge"
              style={{ fontFamily: activeFontDesc.cssFamily }}
              className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                isCustomLibraryFont
                  ? "border border-accent/55 bg-accent-soft text-accent-hover"
                  : "text-ink-secondary"
              }`}
            >
              {activeFontDesc.label}
            </span>
          </div>

          {/* 4 Quick-Pick Live-Preview Cards */}
          <div
            role="group"
            aria-label="Quick-pick caption fonts"
            data-testid="style-font-quick-picks"
            className="mt-2 grid grid-cols-2 gap-1.5"
          >
            {QUICK_PICK_FONT_IDS.map((fontId) => {
              const font = CAPTION_FONTS[fontId];
              const selected = layout.fontFamily === font.id;
              return (
                <button
                  key={font.id}
                  type="button"
                  data-testid={`style-font-${font.id}`}
                  aria-pressed={selected}
                  onClick={() => onUpdateStyle({ fontFamily: font.id })}
                  className={`cc-card-interactive rounded-xl border px-2.5 py-2 text-left ${
                    selected
                      ? "border-accent bg-accent-soft text-accent-hover"
                      : "border-ink/10 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
                  }`}
                >
                  <span
                    style={{ fontFamily: font.cssFamily }}
                    className="block truncate text-xs font-bold"
                  >
                    {font.id === "noto-devanagari" ? "Noto Devanagari" : font.label}
                  </span>
                  <span
                    style={{ fontFamily: font.cssFamily }}
                    className="mt-0.5 block truncate text-[10px] opacity-75"
                  >
                    {font.id === "noto-devanagari"
                      ? "नमस्ते · Aa Bb"
                      : "Make words land"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Single Accessible, Searchable Full-Library Dropdown (All 10 Bundled Fonts) */}
          <div ref={fontDropdownRef} className="relative mt-2">
            <button
              type="button"
              data-testid="style-font-dropdown-trigger"
              aria-haspopup="listbox"
              aria-expanded={fontDropdownOpen}
              onClick={() => setFontDropdownOpen((open) => !open)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                isCustomLibraryFont || fontDropdownOpen
                  ? "border-accent bg-accent-soft/60 text-ink"
                  : "border-ink/12 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
              }`}
            >
              <span className="min-w-0 truncate">
                <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                  All {CAPTION_FONT_LIST.length} fonts:{" "}
                </span>
                <span
                  style={{ fontFamily: activeFontDesc.cssFamily }}
                  className="font-bold text-ink"
                >
                  {activeFontDesc.label}
                </span>
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform ${
                  fontDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {fontDropdownOpen && (
              <div
                data-testid="style-font-dropdown-menu"
                className="cc-panel-enter absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-ink/15 bg-elevated shadow-[0_18px_48px_rgba(0,0,0,0.65)]"
              >
                <div className="flex items-center gap-2 border-b border-ink/10 bg-page/80 px-2.5 py-2">
                  <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                  <input
                    type="text"
                    autoFocus
                    data-testid="style-font-search-input"
                    value={fontSearch}
                    onChange={(e) => setFontSearch(e.target.value)}
                    placeholder="Search all 10 fonts..."
                    aria-label="Search caption fonts"
                    className="min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none"
                  />
                  {fontSearch && (
                    <button
                      type="button"
                      onClick={() => setFontSearch("")}
                      aria-label="Clear font search"
                      className="text-ink-muted hover:text-ink"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div
                  role="listbox"
                  aria-label="All supported caption fonts"
                  className="studio-scroll max-h-56 overflow-y-auto p-1.5"
                >
                  {filteredFonts.length === 0 ? (
                    <p className="px-2.5 py-3 text-center text-xs text-ink-muted">
                      No matching fonts
                    </p>
                  ) : (
                    filteredFonts.map((font) => {
                      const selected = layout.fontFamily === font.id;
                      return (
                        <button
                          key={font.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          data-testid={`style-font-option-${font.id}`}
                          onClick={() => {
                            onUpdateStyle({ fontFamily: font.id });
                            setFontDropdownOpen(false);
                            setFontSearch("");
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                            selected
                              ? "bg-accent-soft text-accent-hover"
                              : "text-ink hover:bg-panel"
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span
                              style={{ fontFamily: font.cssFamily }}
                              className="block truncate text-sm font-bold"
                            >
                              {font.label}
                            </span>
                            <span className="block truncate text-[10px] text-ink-muted">
                              {font.category}
                            </span>
                          </span>
                          {selected && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Font Size + Alignment */}
        {showSizeAndPosition && (
          <div className="border-t border-ink/10 pt-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Size &amp; Alignment
              </span>
              <div
                role="group"
                aria-label="Caption alignment"
                className="inline-flex rounded-lg border border-ink/10 bg-page p-0.5"
              >
                <button
                  type="button"
                  data-testid="style-align-center"
                  aria-pressed={layout.alignment === "center"}
                  aria-label="Center align captions"
                  onClick={() => onUpdateStyle({ alignment: "center" })}
                  className={`rounded-md p-1 transition ${
                    layout.alignment === "center"
                      ? "bg-accent text-page"
                      : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  data-testid="style-align-left"
                  aria-pressed={layout.alignment === "left"}
                  aria-label="Left align captions"
                  onClick={() => onUpdateStyle({ alignment: "left" })}
                  className={`rounded-md p-1 transition ${
                    layout.alignment === "left"
                      ? "bg-accent text-page"
                      : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div
              role="group"
              aria-label="Font size"
              className="mt-2 grid grid-cols-3 gap-1.5"
            >
              {FONT_SIZE_OPTIONS.map((opt) => {
                const selected = style.fontSize === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`style-size-${opt.id}`}
                    aria-pressed={selected}
                    onClick={() => onUpdateStyle({ fontSize: opt.id })}
                    className={`min-h-[34px] rounded-xl border py-1 text-xs font-semibold transition ${
                      selected
                        ? "border-accent bg-accent-soft text-accent-hover"
                        : "border-ink/10 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Highlight Color */}
        <div className="border-t border-ink/10 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Highlight color
            </span>
            <span className="font-mono text-[10px] text-ink-secondary">
              {layout.activeWordColor}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {ACTIVE_WORD_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                data-testid={`active-color-${hex.slice(1).toLowerCase()}`}
                aria-label={`Set active word color ${hex}`}
                onClick={() =>
                  onUpdateStyle({
                    activeWordColor: hex,
                    accent: hex === "#49E6B3" ? "mint" : "violet",
                  })
                }
                style={{ backgroundColor: hex }}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  layout.activeWordColor === hex
                    ? "scale-110 border-ink ring-2 ring-accent/55"
                    : "border-ink/20"
                }`}
              />
            ))}
            <input
              type="color"
              aria-label="Custom active word color"
              value={layout.activeWordColor}
              onChange={(e) =>
                onUpdateStyle({
                  activeWordColor: e.target.value.toUpperCase(),
                })
              }
              className="h-6 w-8 cursor-pointer rounded border border-ink/15 bg-page p-0.5"
            />
          </div>
        </div>

        {/* 4. Vertical Position + Safe-Area Guide */}
        {showSizeAndPosition && (
          <div className="border-t border-ink/10 pt-3.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="vertical-position-slider"
                className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted"
              >
                Vertical position
              </label>
              <span className="rounded-md border border-ink/12 bg-page px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-ink-secondary">
                {style.verticalPosition}%
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {PLACEMENT_OPTIONS.map((p) => {
                const active = Math.abs(style.verticalPosition - p.value) <= 4;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => onUpdateStyle({ verticalPosition: p.value })}
                    className={`min-h-[32px] rounded-xl border py-1 text-xs font-semibold transition ${
                      active
                        ? "border-accent bg-accent-soft text-accent-hover"
                        : "border-ink/10 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="relative mt-2.5 flex h-6 items-center">
              <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-track">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.min(100, Math.max(0, positionPercent))}%`,
                  }}
                />
              </div>
              <input
                id="vertical-position-slider"
                type="range"
                min={MIN_VERTICAL_POSITION}
                max={MAX_VERTICAL_POSITION}
                step={1}
                value={style.verticalPosition}
                onChange={(e) =>
                  onUpdateStyle({ verticalPosition: Number(e.target.value) })
                }
                aria-label="Vertical position"
                aria-valuetext={`${style.verticalPosition} percent from bottom`}
                className="studio-scrubber relative z-10 w-full"
              />
            </div>

            {onToggleSafeArea && (
              <button
                type="button"
                data-testid="safe-area-toggle"
                aria-pressed={showSafeArea}
                onClick={() => onToggleSafeArea(!showSafeArea)}
                className={`mt-2.5 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  showSafeArea
                    ? "border-accent bg-accent-soft text-accent-hover"
                    : "border-ink/10 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Frame className="h-3.5 w-3.5" />
                  <span>Safe-area guide</span>
                </span>
                <span className="font-mono text-[10px]">
                  {showSafeArea ? "ON" : "OFF"}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Quick Save as Preset inside Style tab */}
        {enablePersonalPresets && (
          <div className="border-t border-ink/10 pt-3.5">
            {renderSavePresetBox(true)}
          </div>
        )}

        {/* Collapsible Advanced Adjustments */}
        <div className="border-t border-ink/10 pt-3">
          <button
            type="button"
            data-testid="style-advanced-toggle"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-lg py-1.5 text-xs font-semibold text-ink-secondary transition hover:text-ink"
          >
            <span>Advanced</span>
            <ChevronDown
              className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>

          {advancedOpen && (
            <div
              data-testid="style-advanced-panel"
              className="cc-panel-enter mt-2.5 space-y-3.5 rounded-xl border border-ink/10 bg-inset p-3"
            >
              {/* Word Emphasis Mode */}
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Word emphasis
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {EMPHASIS_OPTIONS.map((opt) => {
                    const selected = layout.emphasisMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`style-emphasis-${opt.id}`}
                        aria-pressed={selected}
                        onClick={() =>
                          onUpdateStyle({
                            emphasisMode: opt.id,
                            preset:
                              opt.id === "pill"
                                ? "word-highlight"
                                : style.preset === "word-highlight"
                                  ? "clean"
                                  : style.preset,
                          })
                        }
                        className={`min-h-[30px] rounded-lg border py-1 text-xs font-semibold transition ${
                          selected
                            ? "border-accent bg-accent-soft text-accent-hover"
                            : "border-ink/10 bg-page text-ink-secondary hover:text-ink"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Text Color */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    Text color
                  </span>
                  <span className="font-mono text-[10px] text-ink-secondary">
                    {layout.textColor}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {TEXT_COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Set text color ${hex}`}
                      onClick={() => onUpdateStyle({ textColor: hex })}
                      style={{ backgroundColor: hex }}
                      className={`h-6 w-6 rounded-full border-2 transition ${
                        layout.textColor === hex
                          ? "scale-110 border-accent"
                          : "border-ink/25"
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label="Custom text color"
                    value={layout.textColor}
                    onChange={(e) =>
                      onUpdateStyle({ textColor: e.target.value.toUpperCase() })
                    }
                    className="h-6 w-8 cursor-pointer rounded border border-ink/15 bg-page p-0.5"
                  />
                </div>
              </div>

              {/* Casing + Italic */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    Casing &amp; Style
                  </span>
                  <button
                    type="button"
                    data-testid="style-italic-toggle"
                    aria-pressed={layout.italic}
                    onClick={() => onUpdateStyle({ italic: !layout.italic })}
                    className={`rounded-md border px-2 py-0.5 text-[11px] italic font-semibold transition ${
                      layout.italic
                        ? "border-accent bg-accent-soft text-accent-hover"
                        : "border-ink/12 bg-page text-ink-secondary hover:text-ink"
                    }`}
                  >
                    Italic
                  </button>
                </div>
                <div
                  role="group"
                  aria-label="Text casing"
                  className="mt-1.5 grid grid-cols-3 gap-1.5"
                >
                  {CASING_OPTIONS.map((opt) => {
                    const selected = layout.casing === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`style-casing-${opt.id}`}
                        aria-pressed={selected}
                        onClick={() => onUpdateStyle({ casing: opt.id })}
                        className={`min-h-[30px] rounded-lg border py-1 text-xs font-semibold transition ${
                          selected
                            ? "border-accent bg-accent-soft text-accent-hover"
                            : "border-ink/10 bg-page text-ink-secondary hover:text-ink"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Letter Spacing */}
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Letter spacing
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {SPACING_OPTIONS.map((opt) => {
                    const selected = layout.letterSpacing === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          onUpdateStyle({ letterSpacing: opt.id })
                        }
                        className={`min-h-[30px] rounded-lg border py-1 text-xs font-semibold transition ${
                          selected
                            ? "border-accent bg-accent-soft text-accent-hover"
                            : "border-ink/10 bg-page text-ink-secondary hover:text-ink"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Outline */}
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold uppercase tracking-wider text-ink-muted">
                    Outline
                  </span>
                  <span className="font-mono text-ink-secondary">
                    {layout.outlineWidth}px · {layout.outlineColor}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={1}
                    value={layout.outlineWidth}
                    aria-label="Outline width"
                    onChange={(e) =>
                      onUpdateStyle({ outlineWidth: Number(e.target.value) })
                    }
                    className="studio-scrubber flex-1"
                  />
                  <input
                    type="color"
                    aria-label="Outline color"
                    value={layout.outlineColor}
                    onChange={(e) =>
                      onUpdateStyle({
                        outlineColor: e.target.value.toUpperCase(),
                      })
                    }
                    className="h-6 w-8 cursor-pointer rounded border border-ink/15 bg-page p-0.5"
                  />
                </div>
              </div>

              {/* Background Plate */}
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold uppercase tracking-wider text-ink-muted">
                    Background plate
                  </span>
                  <button
                    type="button"
                    aria-pressed={layout.backgroundEnabled}
                    onClick={() =>
                      onUpdateStyle({
                        preset: !layout.backgroundEnabled
                          ? layout.emphasisMode === "pill"
                            ? "word-highlight"
                            : "boxed"
                          : "clean",
                        backgroundEnabled: !layout.backgroundEnabled,
                        backgroundOpacity:
                          !layout.backgroundEnabled &&
                          layout.backgroundOpacity === 0
                            ? 80
                            : layout.backgroundOpacity,
                      })
                    }
                    className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                      layout.backgroundEnabled
                        ? "border-accent bg-accent-soft text-accent-hover"
                        : "border-ink/12 bg-page text-ink-muted"
                    }`}
                  >
                    {layout.backgroundEnabled ? "ON" : "OFF"}
                  </button>
                </div>
                {layout.backgroundEnabled && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-1.5">
                      {BG_COLOR_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          aria-label={`Set background color ${hex}`}
                          onClick={() =>
                            onUpdateStyle({ backgroundColor: hex })
                          }
                          style={{ backgroundColor: hex }}
                          className={`h-5 w-5 rounded-full border-2 ${
                            layout.backgroundColor === hex
                              ? "border-accent"
                              : "border-ink/25"
                          }`}
                        />
                      ))}
                      <input
                        type="color"
                        aria-label="Custom background color"
                        value={layout.backgroundColor}
                        onChange={(e) =>
                          onUpdateStyle({
                            backgroundColor: e.target.value.toUpperCase(),
                          })
                        }
                        className="h-5 w-7 cursor-pointer rounded border border-ink/15 bg-page p-0.5"
                      />
                      <span className="ml-auto font-mono text-[10px] text-ink-secondary">
                        {layout.backgroundOpacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={layout.backgroundOpacity}
                      aria-label="Background opacity"
                      onChange={(e) =>
                        onUpdateStyle({
                          backgroundOpacity: Number(e.target.value),
                        })
                      }
                      className="studio-scrubber w-full"
                    />
                  </div>
                )}
              </div>

              {/* Highlight Box Color & Opacity (Pill mode) */}
              {(layout.preset === "word-highlight" ||
                layout.emphasisMode === "pill") && (
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold uppercase tracking-wider text-ink-muted">
                      Highlight box
                    </span>
                    <span className="font-mono text-ink-secondary">
                      {layout.highlightBgColor} · {layout.highlightBgOpacity}%
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="color"
                      data-testid="style-highlight-bg-color"
                      aria-label="Highlight box color"
                      value={layout.highlightBgColor}
                      onChange={(e) =>
                        onUpdateStyle({
                          highlightBgColor: e.target.value.toUpperCase(),
                        })
                      }
                      className="h-6 w-8 cursor-pointer rounded border border-ink/15 bg-page p-0.5"
                    />
                    <input
                      type="range"
                      data-testid="style-highlight-bg-opacity"
                      min={15}
                      max={100}
                      step={5}
                      value={layout.highlightBgOpacity}
                      aria-label="Highlight box opacity"
                      onChange={(e) =>
                        onUpdateStyle({
                          highlightBgOpacity: Number(e.target.value),
                        })
                      }
                      className="studio-scrubber flex-1"
                    />
                  </div>
                </div>
              )}

              {/* Shadow Strength, Color & Opacity */}
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold uppercase tracking-wider text-ink-muted">
                    Shadow
                  </span>
                  {layout.shadowStrength !== "none" && (
                    <span className="font-mono text-ink-secondary">
                      {layout.shadowColor} · {layout.shadowOpacity}%
                    </span>
                  )}
                </div>
                <div
                  role="group"
                  aria-label="Shadow strength"
                  className="mt-1.5 grid grid-cols-3 gap-1.5"
                >
                  {SHADOW_OPTIONS.map((opt) => {
                    const selected = layout.shadowStrength === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          onUpdateStyle({ shadowStrength: opt.id })
                        }
                        className={`min-h-[30px] rounded-lg border py-1 text-xs font-semibold transition ${
                          selected
                            ? "border-accent bg-accent-soft text-accent-hover"
                            : "border-ink/10 bg-page text-ink-secondary hover:text-ink"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {layout.shadowStrength !== "none" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      data-testid="style-shadow-color"
                      aria-label="Shadow color"
                      value={layout.shadowColor}
                      onChange={(e) =>
                        onUpdateStyle({
                          shadowColor: e.target.value.toUpperCase(),
                        })
                      }
                      className="h-6 w-8 cursor-pointer rounded border border-ink/15 bg-page p-0.5"
                    />
                    <input
                      type="range"
                      data-testid="style-shadow-opacity"
                      min={10}
                      max={100}
                      step={5}
                      value={layout.shadowOpacity}
                      aria-label="Shadow opacity"
                      onChange={(e) =>
                        onUpdateStyle({
                          shadowOpacity: Number(e.target.value),
                        })
                      }
                      className="studio-scrubber flex-1"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
