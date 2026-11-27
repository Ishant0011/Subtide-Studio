"use client";

import { useRef } from "react";
import { Captions, Clock, SlidersHorizontal } from "lucide-react";

export type StudioMobileTab = "captions" | "style";

interface StudioTabsProps {
  activeTab: StudioMobileTab;
  onChange: (tab: StudioMobileTab) => void;
  cueCount: number;
  activePresetName: string;
  idPrefix: string;
  onOpenTimeline?: () => void;
}

const TAB_ORDER: StudioMobileTab[] = ["captions", "style"];

export function StudioTabs({
  activeTab,
  onChange,
  cueCount,
  activePresetName,
  idPrefix,
  onOpenTimeline,
}: StudioTabsProps) {
  const tabRefs = useRef<Record<StudioMobileTab, HTMLButtonElement | null>>({
    captions: null,
    style: null,
  });

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    current: StudioMobileTab
  ) => {
    const idx = TAB_ORDER.indexOf(current);
    let nextTab: StudioMobileTab | null = null;

    if (event.key === "ArrowRight") {
      nextTab = TAB_ORDER[(idx + 1) % TAB_ORDER.length];
    } else if (event.key === "ArrowLeft") {
      nextTab = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    } else if (event.key === "Home") {
      nextTab = TAB_ORDER[0];
    } else if (event.key === "End") {
      nextTab = TAB_ORDER[TAB_ORDER.length - 1];
    }

    if (nextTab) {
      event.preventDefault();
      onChange(nextTab);
      tabRefs.current[nextTab]?.focus();
    }
  };

  return (
    <div className="flex items-center gap-1.5 lg:hidden">
      <div
        role="tablist"
        aria-label="Workspace panels"
        data-testid="mobile-panel-tabs"
        className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-2xl border border-ink/10 bg-panel p-1"
      >
        <button
          ref={(el) => {
            tabRefs.current.captions = el;
          }}
          id={`${idPrefix}-tab-captions`}
          role="tab"
          type="button"
          data-testid="tab-captions"
          aria-selected={activeTab === "captions"}
          aria-controls={`${idPrefix}-panel-captions`}
          tabIndex={activeTab === "captions" ? 0 : -1}
          onClick={() => onChange("captions")}
          onKeyDown={(e) => handleKeyDown(e, "captions")}
          className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            activeTab === "captions"
              ? "bg-accent-soft text-accent-hover ring-1 ring-accent/40"
              : "text-ink-secondary hover:bg-elevated hover:text-ink"
          }`}
        >
          <Captions className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Captions</span>
          <span
            className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
              activeTab === "captions"
                ? "bg-accent/20 text-accent-hover"
                : "bg-elevated text-ink-muted"
            }`}
          >
            {cueCount}
          </span>
        </button>

        <button
          ref={(el) => {
            tabRefs.current.style = el;
          }}
          id={`${idPrefix}-tab-style`}
          role="tab"
          type="button"
          data-testid="tab-style"
          aria-selected={activeTab === "style"}
          aria-controls={`${idPrefix}-panel-style`}
          tabIndex={activeTab === "style" ? 0 : -1}
          onClick={() => onChange("style")}
          onKeyDown={(e) => handleKeyDown(e, "style")}
          className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            activeTab === "style"
              ? "bg-accent-soft text-accent-hover ring-1 ring-accent/40"
              : "text-ink-secondary hover:bg-elevated hover:text-ink"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Style</span>
          <span
            className={`hidden max-w-[68px] truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:inline-block ${
              activeTab === "style"
                ? "bg-accent/20 text-accent-hover"
                : "bg-elevated text-ink-muted"
            }`}
          >
            {activePresetName}
          </span>
        </button>
      </div>

      {onOpenTimeline && (
        <button
          type="button"
          data-testid="mobile-open-timeline-btn"
          onClick={onOpenTimeline}
          className="inline-flex min-h-[46px] shrink-0 items-center gap-1.5 rounded-2xl border border-ink/12 bg-panel px-3 py-2 text-xs font-semibold text-ink-secondary transition hover:border-accent/50 hover:text-ink"
        >
          <Clock className="h-3.5 w-3.5 text-accent" />
          <span>Timeline</span>
        </button>
      )}
    </div>
  );
}
