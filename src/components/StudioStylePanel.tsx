"use client";

import { useState } from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  Frame,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  BUILTIN_STYLE_TEMPLATES,
  CAPTION_FONT_LIST,
  MAX_VERTICAL_POSITION,
  MIN_VERTICAL_POSITION,
  applyCaptionCasing,
  computeCaptionLayout,
  hexToRgba,
  normalizeCaptionStyle,
  type CaptionCasing,
  type CaptionFontSize,
  type CaptionShadowStrength,
  type CaptionStyleConfig,
  type SavedCaptionPresetRow,
} from "@/lib/caption-editor";

interface StudioStylePanelProps {
  style: CaptionStyleConfig;
  onUpdateStyle: (patch: Partial<CaptionStyleConfig>) => void;
  showSizeAndPosition?: boolean;
  subtitle?: string;
  showSafeArea?: boolean;
  onToggleSafeArea?: (next: boolean) => void;
  /** Personal saved presets (owner-scoped, only enabled in signed-in project editor) */
  personalPresets?: SavedCaptionPresetRow[];
  onPersonalPresetsChange?: (next: SavedCaptionPresetRow[]) => void;
  enablePersonalPresets?: boolean;
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

const PLACEMENT_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "Bottom", value: 14 },
  { label: "Middle", value: 45 },
  { label: "Top", value: 74 },
];

const TEXT_COLOR_SWATCHES = ["#F5F1E8", "#FFFFFF", "#FDE68A", "#E2E8F0"];
const ACTIVE_WORD_SWATCHES = ["#A78BFA", "#49E6B3", "#FACC15", "#38BDF8", "#FB7185"];
const BG_COLOR_SWATCHES = ["#070B10", "#10121A", "#1E1B4B", "#000000"];

function LivePresetSwatch({ style }: { style: Partial<CaptionStyleConfig> }) {
  const layout = computeCaptionLayout(style);
  const w1 = applyCaptionCasing("Keep", layout.casing);
  const w2 = applyCaptionCasing("your", layout.casing);
  const w3 = applyCaptionCasing("style", layout.casing);
  const bgRgba = layout.backgroundEnabled
    ? hexToRgba(layout.backgroundColor, layout.backgroundOpacity / 100)
    : "transparent";

  if (layout.preset === "clean") {
    return (
      <div
        aria-hidden="true"
        style={{ fontFamily: layout.cssFontFamily }}
        className="flex h-8 w-full items-center justify-center rounded-lg bg-page/90 px-2 text-xs font-bold"
      >
        <span style={{ color: layout.textColor, opacity: 0.8 }}>{w1}</span>
        <span className="mx-1" style={{ color: layout.activeWordColor }}>
          {w2}
        </span>
        <span style={{ color: layout.textColor, opacity: 0.8 }}>{w3}</span>
      </div>
    );
  }
  if (layout.preset === "boxed") {
    return (
      <div
        aria-hidden="true"
        style={{ fontFamily: layout.cssFontFamily }}
        className="flex h-8 w-full items-center justify-center rounded-lg bg-page/90 px-2"
      >
        <span
          style={{ backgroundColor: bgRgba, color: layout.textColor }}
          className="rounded-md border border-ink/15 px-2 py-0.5 text-xs font-bold"
        >
          {w1}{" "}
          <span
            className="underline underline-offset-2"
            style={{
              color: layout.activeWordColor,
              textDecorationColor: layout.activeWordColor,
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
      style={{ fontFamily: layout.cssFontFamily }}
      className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-page/90 px-2 text-[11px] font-extrabold"
    >
      <span style={{ color: layout.textColor, opacity: 0.8 }}>{w1}</span>
      <span
        className="rounded px-1.5 py-0.5"
        style={{
          backgroundColor: layout.activeWordColor,
          color: layout.activeWordContrastText,
        }}
      >
        {w2}
      </span>
      <span style={{ color: layout.textColor, opacity: 0.8 }}>{w3}</span>
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
}: StudioStylePanelProps) {
  const layout = computeCaptionLayout(style);
  const positionPercent =
    ((style.verticalPosition - MIN_VERTICAL_POSITION) /
      (MAX_VERTICAL_POSITION - MIN_VERTICAL_POSITION)) *
    100;

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busyPresetId, setBusyPresetId] = useState<string | null>(null);

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
      onPersonalPresetsChange([data.preset as SavedCaptionPresetRow, ...personalPresets]);
      setNewPresetName("");
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

  return (
    <div className="rounded-2xl border border-ink/10 bg-panel p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2 border-b border-ink/8 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-ink">
            Style Inspector
          </h2>
        </div>
        <span className="text-[11px] text-ink-muted">{subtitle}</span>
      </div>

      {/* Live Preset Previews */}
      <div className="mt-3.5">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Presets
        </span>
        <div
          role="group"
          aria-label="Caption presets"
          className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1"
        >
          {BUILTIN_STYLE_TEMPLATES.map((tpl) => {
            const selected =
              layout.preset === tpl.style.preset &&
              layout.fontFamily === tpl.style.fontFamily &&
              layout.activeWordColor === tpl.style.activeWordColor;
            return (
              <button
                key={tpl.id}
                type="button"
                data-testid={`builtin-preset-${tpl.id}`}
                aria-pressed={selected}
                onClick={() => onUpdateStyle(tpl.style)}
                className={`group flex flex-col gap-1.5 rounded-xl border p-2 text-left transition ${
                  selected
                    ? "border-accent bg-accent-soft/75 shadow-[0_0_0_1px_rgba(167,139,250,0.22)]"
                    : "border-ink/10 bg-inset hover:border-ink/25 hover:bg-elevated/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      selected ? "text-accent-hover" : "text-ink"
                    }`}
                  >
                    {tpl.name}
                  </span>
                  <span className="text-[10px] text-ink-muted">
                    {tpl.style.fontFamily}
                  </span>
                </div>
                <LivePresetSwatch style={tpl.style} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Personal Saved Presets (Owner-Scoped) */}
      {enablePersonalPresets && (
        <div
          data-testid="personal-presets-section"
          className="mt-4 border-t border-ink/8 pt-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              <Bookmark className="h-3 w-3 text-accent" />
              <span>Your Presets</span>
            </span>
            <span className="font-mono text-[10px] text-ink-muted">
              {personalPresets.length}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <input
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
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-page transition hover:bg-accent-hover disabled:opacity-45"
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

          {personalPresets.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
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
      )}

      {/* Curated Redistributable Fonts */}
      <div className="mt-4 border-t border-ink/8 pt-4">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Font
        </span>
        <div
          role="group"
          aria-label="Caption font family"
          className="mt-2 grid grid-cols-2 gap-1.5"
        >
          {CAPTION_FONT_LIST.map((font) => {
            const selected = layout.fontFamily === font.id;
            return (
              <button
                key={font.id}
                type="button"
                data-testid={`style-font-${font.id}`}
                aria-pressed={selected}
                onClick={() => onUpdateStyle({ fontFamily: font.id })}
                style={{ fontFamily: font.cssFamily }}
                className={`rounded-xl border px-2.5 py-2 text-left text-xs transition ${
                  selected
                    ? "border-accent bg-accent-soft text-accent-hover"
                    : "border-ink/10 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
                }`}
              >
                <span className="block truncate font-bold">{font.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Text & Active Word Color */}
      <div className="mt-4 border-t border-ink/8 pt-4 space-y-3">
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
              onChange={(e) => onUpdateStyle({ textColor: e.target.value.toUpperCase() })}
              className="h-6 w-8 cursor-pointer rounded border border-ink/15 bg-page p-0.5"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Active word color
            </span>
            <span className="font-mono text-[10px] text-ink-secondary">
              {layout.activeWordColor}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
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
                    ? "scale-110 border-ink"
                    : "border-ink/20"
                }`}
              />
            ))}
            <input
              type="color"
              aria-label="Custom active word color"
              value={layout.activeWordColor}
              onChange={(e) =>
                onUpdateStyle({ activeWordColor: e.target.value.toUpperCase() })
              }
              className="h-6 w-8 cursor-pointer rounded border border-ink/15 bg-page p-0.5"
            />
          </div>
        </div>
      </div>

      {/* Casing */}
      <div className="mt-4 border-t border-ink/8 pt-4">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Casing
        </span>
        <div
          role="group"
          aria-label="Text casing"
          className="mt-2 grid grid-cols-3 gap-1.5"
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
                className={`min-h-[32px] rounded-xl border py-1 text-xs font-semibold transition ${
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

      {/* Placement + Safe-Area Guide */}
      {showSizeAndPosition && (
        <div className="mt-4 border-t border-ink/8 pt-4">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="vertical-position-slider"
              className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted"
            >
              Placement
            </label>
            <span className="rounded-md border border-accent/30 bg-accent-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-accent-hover">
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
                  className={`rounded-lg border py-1 text-[11px] font-semibold transition ${
                    active
                      ? "border-accent bg-accent-soft text-accent-hover"
                      : "border-ink/10 bg-page text-ink-secondary hover:text-ink"
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

      {/* Collapsible Advanced Settings: Font size, Outline, Background, Shadow */}
      <div className="mt-4 border-t border-ink/8 pt-3">
        <button
          type="button"
          data-testid="style-advanced-toggle"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-lg py-1 text-xs font-semibold text-ink-secondary transition hover:text-ink"
        >
          <span>Advanced styling (Size, Outline, Box, Shadow)</span>
          <ChevronDown
            className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`}
          />
        </button>

        {advancedOpen && (
          <div
            data-testid="style-advanced-panel"
            className="mt-3 space-y-3.5 rounded-xl border border-ink/10 bg-inset p-3"
          >
            {/* Font Size */}
            {showSizeAndPosition && (
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Font size
                </span>
                <div
                  role="group"
                  aria-label="Font size"
                  className="mt-1.5 grid grid-cols-3 gap-1.5"
                >
                  {FONT_SIZE_OPTIONS.map((opt) => {
                    const selected = style.fontSize === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onUpdateStyle({ fontSize: opt.id })}
                        className={`min-h-[32px] rounded-lg border py-1 text-xs font-semibold transition ${
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
            )}

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
                    onUpdateStyle({ outlineColor: e.target.value.toUpperCase() })
                  }
                  className="h-6 w-8 cursor-pointer rounded border border-ink/15 bg-page p-0.5"
                />
              </div>
            </div>

            {/* Background Plate */}
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold uppercase tracking-wider text-ink-muted">
                  Background
                </span>
                <button
                  type="button"
                  aria-pressed={layout.backgroundEnabled}
                  onClick={() =>
                    onUpdateStyle({
                      backgroundEnabled: !layout.backgroundEnabled,
                      backgroundOpacity:
                        !layout.backgroundEnabled && layout.backgroundOpacity === 0
                          ? 75
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
                        onClick={() => onUpdateStyle({ backgroundColor: hex })}
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

            {/* Shadow Strength */}
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Shadow
              </span>
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
                      onClick={() => onUpdateStyle({ shadowStrength: opt.id })}
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
          </div>
        )}
      </div>
    </div>
  );
}
