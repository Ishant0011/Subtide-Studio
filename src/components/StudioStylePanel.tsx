"use client";

import { Sparkles } from "lucide-react";
import { CAPTION_PRESETS, type CaptionPresetId } from "@/lib/captions";
import {
  CAPTION_ACCENTS,
  MAX_VERTICAL_POSITION,
  MIN_VERTICAL_POSITION,
  computeCaptionLayout,
  type CaptionAccentId,
  type CaptionFontSize,
  type CaptionStyleConfig,
} from "@/lib/caption-editor";

interface StudioStylePanelProps {
  style: CaptionStyleConfig;
  onUpdateStyle: (patch: Partial<CaptionStyleConfig>) => void;
  showSizeAndPosition?: boolean;
  subtitle?: string;
}

const FONT_SIZE_OPTIONS: Array<{ id: CaptionFontSize; label: string }> = [
  { id: "sm", label: "Small" },
  { id: "md", label: "Medium" },
  { id: "lg", label: "Large" },
];

const ACCENT_OPTIONS: CaptionAccentId[] = ["violet", "mint"];

function PresetSwatch({
  id,
  accentHex,
}: {
  id: CaptionPresetId;
  accentHex: string;
}) {
  if (id === "clean") {
    return (
      <div
        aria-hidden="true"
        className="flex h-8 w-full items-center justify-center rounded-lg bg-page/90 px-2 text-[11px] font-semibold tracking-tight"
      >
        <span className="text-ink/80">Keep</span>
        <span className="mx-1" style={{ color: accentHex }}>
          your
        </span>
        <span className="text-ink/80">style</span>
      </div>
    );
  }
  if (id === "boxed") {
    return (
      <div
        aria-hidden="true"
        className="flex h-8 w-full items-center justify-center rounded-lg bg-page/90 px-2"
      >
        <span className="rounded-md border border-ink/15 bg-panel px-2 py-0.5 text-[11px] font-semibold text-ink">
          Keep{" "}
          <span
            className="underline underline-offset-2"
            style={{ color: accentHex, textDecorationColor: accentHex }}
          >
            your
          </span>{" "}
          style
        </span>
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-page/90 px-2 text-[10px] font-extrabold uppercase tracking-wide"
    >
      <span className="text-ink/75">KEEP</span>
      <span
        className="rounded px-1.5 py-0.5 text-page"
        style={{ backgroundColor: accentHex }}
      >
        YOUR
      </span>
      <span className="text-ink/75">STYLE</span>
    </div>
  );
}

export function StudioStylePanel({
  style,
  onUpdateStyle,
  showSizeAndPosition = true,
  subtitle = "Live preview",
}: StudioStylePanelProps) {
  const layout = computeCaptionLayout(style);
  const positionPercent =
    ((style.verticalPosition - MIN_VERTICAL_POSITION) /
      (MAX_VERTICAL_POSITION - MIN_VERTICAL_POSITION)) *
    100;

  return (
    <div className="rounded-2xl border border-ink/10 bg-panel p-4">
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

      {/* Presets */}
      <div className="mt-3.5">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Preset
        </span>
        <div
          role="group"
          aria-label="Caption presets"
          className="mt-2 flex flex-col gap-2"
        >
          {CAPTION_PRESETS.map((item) => {
            const selected = style.preset === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  onUpdateStyle({ preset: item.id as CaptionPresetId })
                }
                className={`group flex flex-col gap-2 rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
                    {item.name}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full transition ${
                      selected
                        ? "bg-accent shadow-[0_0_8px_rgba(167,139,250,0.85)]"
                        : "bg-ink/20 group-hover:bg-ink/40"
                    }`}
                  />
                </div>
                <PresetSwatch id={item.id} accentHex={layout.accentHex} />
                <p className="text-[11px] leading-snug text-ink-secondary">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Highlight Accent (preserves saved legacy styles while defaulting new projects to violet) */}
      <div className="mt-4 border-t border-ink/8 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Highlight color
          </span>
          <span className="font-mono text-[10px] text-ink-secondary">
            {layout.accentHex}
          </span>
        </div>
        <div
          role="group"
          aria-label="Caption highlight color"
          className="mt-2 grid grid-cols-2 gap-1.5"
        >
          {ACCENT_OPTIONS.map((accentId) => {
            const meta = CAPTION_ACCENTS[accentId];
            const selected = layout.accent === accentId;
            return (
              <button
                key={accentId}
                type="button"
                data-testid={`style-accent-${accentId}`}
                aria-pressed={selected}
                onClick={() => onUpdateStyle({ accent: accentId })}
                className={`inline-flex min-h-[34px] items-center justify-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selected
                    ? "border-accent bg-accent-soft text-accent-hover"
                    : "border-ink/10 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full border border-ink/20"
                  style={{ backgroundColor: meta.hex }}
                />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showSizeAndPosition && (
        <>
          {/* Font Size */}
          <div className="mt-4 border-t border-ink/8 pt-4">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Font size
            </span>
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
                    aria-pressed={selected}
                    onClick={() => onUpdateStyle({ fontSize: opt.id })}
                    className={`min-h-[36px] rounded-xl border py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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

          {/* Vertical Position */}
          <div className="mt-4 border-t border-ink/8 pt-4">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="vertical-position-slider"
                className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted"
              >
                Vertical position
              </label>
              <span className="rounded-md border border-accent/30 bg-accent-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-accent-hover">
                {style.verticalPosition}%
              </span>
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

            <div className="mt-1 flex items-center justify-between text-[10px] text-ink-muted">
              <span>Lower ({MIN_VERTICAL_POSITION}%)</span>
              <span>Mid</span>
              <span>Upper ({MAX_VERTICAL_POSITION}%)</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
