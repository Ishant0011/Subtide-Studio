"use client";

import { Sparkles } from "lucide-react";
import { CAPTION_PRESETS, type CaptionPresetId } from "@/lib/captions";
import {
  MAX_VERTICAL_POSITION,
  MIN_VERTICAL_POSITION,
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

function PresetSwatch({ id }: { id: CaptionPresetId }) {
  if (id === "clean") {
    return (
      <div
        aria-hidden="true"
        className="flex h-8 w-full items-center justify-center rounded-lg bg-[#070B10]/85 px-2 text-[11px] font-semibold tracking-tight"
      >
        <span className="text-[#F5F1E8]/80">Keep</span>
        <span className="mx-1 text-[#49E6B3]">your</span>
        <span className="text-[#F5F1E8]/80">style</span>
      </div>
    );
  }
  if (id === "boxed") {
    return (
      <div
        aria-hidden="true"
        className="flex h-8 w-full items-center justify-center rounded-lg bg-[#070B10]/85 px-2"
      >
        <span className="rounded-md border border-[#F5F1E8]/15 bg-[#0D131C] px-2 py-0.5 text-[11px] font-semibold text-[#F5F1E8]">
          Keep <span className="text-[#49E6B3] underline decoration-[#49E6B3]/70 underline-offset-2">your</span> style
        </span>
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-[#070B10]/85 px-2 text-[10px] font-extrabold uppercase tracking-wide"
    >
      <span className="text-[#F5F1E8]/75">KEEP</span>
      <span className="rounded bg-[#49E6B3] px-1.5 py-0.5 text-[#070B10]">YOUR</span>
      <span className="text-[#F5F1E8]/75">STYLE</span>
    </div>
  );
}

export function StudioStylePanel({
  style,
  onUpdateStyle,
  showSizeAndPosition = true,
  subtitle = "Live preview",
}: StudioStylePanelProps) {
  const positionPercent =
    ((style.verticalPosition - MIN_VERTICAL_POSITION) /
      (MAX_VERTICAL_POSITION - MIN_VERTICAL_POSITION)) *
    100;

  return (
    <div className="rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-4">
      <div className="flex items-center justify-between gap-2 border-b border-[#F5F1E8]/8 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-[#49E6B3]/30 bg-[#102E28] text-[#49E6B3]">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-[#F5F1E8]">
            Caption Style
          </h2>
        </div>
        <span className="text-[11px] text-[#7D7A72]">{subtitle}</span>
      </div>

      {/* Presets */}
      <div className="mt-3.5">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#7D7A72]">
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
                className={`group flex flex-col gap-2 rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3] ${
                  selected
                    ? "border-[#49E6B3] bg-[#102E28]/65 shadow-[0_0_0_1px_rgba(73,230,179,0.2)]"
                    : "border-[#F5F1E8]/10 bg-[#0A1018] hover:border-[#F5F1E8]/25 hover:bg-[#131C28]/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      selected ? "text-[#49E6B3]" : "text-[#F5F1E8]"
                    }`}
                  >
                    {item.name}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full transition ${
                      selected
                        ? "bg-[#49E6B3] shadow-[0_0_8px_rgba(73,230,179,0.85)]"
                        : "bg-[#F5F1E8]/20 group-hover:bg-[#F5F1E8]/40"
                    }`}
                  />
                </div>
                <PresetSwatch id={item.id} />
                <p className="text-[11px] leading-snug text-[#B6B0A4]">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {showSizeAndPosition && (
        <>
          {/* Font Size */}
          <div className="mt-4 border-t border-[#F5F1E8]/8 pt-4">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#7D7A72]">
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
                    className={`min-h-[36px] rounded-xl border py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49E6B3] ${
                      selected
                        ? "border-[#49E6B3] bg-[#102E28] text-[#49E6B3]"
                        : "border-[#F5F1E8]/10 bg-[#070B10] text-[#B6B0A4] hover:border-[#F5F1E8]/25 hover:text-[#F5F1E8]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vertical Position */}
          <div className="mt-4 border-t border-[#F5F1E8]/8 pt-4">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="vertical-position-slider"
                className="text-[11px] font-semibold uppercase tracking-wider text-[#7D7A72]"
              >
                Vertical position
              </label>
              <span className="rounded-md border border-[#49E6B3]/30 bg-[#102E28] px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#49E6B3]">
                {style.verticalPosition}%
              </span>
            </div>

            <div className="relative mt-2.5 flex h-6 items-center">
              <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-[#1A2636]">
                <div
                  className="h-full rounded-full bg-[#49E6B3]"
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

            <div className="mt-1 flex items-center justify-between text-[10px] text-[#7D7A72]">
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
