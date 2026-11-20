"use client";

import type { CaptionCue, CaptionPresetId, CaptionWord } from "@/lib/captions";

interface CaptionOverlayProps {
  activeCue: CaptionCue | null;
  activeWord: CaptionWord | null;
  preset: CaptionPresetId;
  currentTime: number;
}

export function CaptionOverlay({
  activeCue,
  activeWord,
  preset,
  currentTime,
}: CaptionOverlayProps) {
  if (!activeCue) {
    return null;
  }

  if (preset === "clean") {
    return (
      <div
        data-testid="caption-overlay"
        data-preset="clean"
        className="pointer-events-none absolute inset-x-4 bottom-[12%] z-20 flex justify-center"
      >
        <p className="max-w-[92%] text-center text-[1.15rem] font-semibold leading-snug tracking-[-0.01em] text-[#F5F1E8] [text-shadow:0_2px_10px_rgba(7,11,16,0.95),0_1px_2px_rgba(7,11,16,0.9)] sm:text-[1.25rem]">
          {activeCue.words.map((word, index) => {
            const isActive = activeWord?.id === word.id;
            const isPast = currentTime >= word.end;
            return (
              <span
                key={word.id}
                data-active-word={isActive ? "true" : "false"}
                className={`inline-block transition-all duration-100 ${
                  index < activeCue.words.length - 1 ? "mr-[0.28em]" : ""
                } ${
                  isActive
                    ? "scale-[1.04] text-[#49E6B3]"
                    : isPast
                      ? "text-[#F5F1E8]"
                      : "text-[#F5F1E8]/80"
                }`}
              >
                {word.text}
              </span>
            );
          })}
        </p>
      </div>
    );
  }

  if (preset === "boxed") {
    return (
      <div
        data-testid="caption-overlay"
        data-preset="boxed"
        className="pointer-events-none absolute inset-x-4 bottom-[12%] z-20 flex justify-center"
      >
        <div className="max-w-[94%] rounded-2xl border border-[#F5F1E8]/15 bg-[#070B10]/82 px-4 py-2.5 text-center shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <p className="text-[1.08rem] font-semibold leading-snug tracking-[-0.01em] sm:text-[1.18rem]">
            {activeCue.words.map((word, index) => {
              const isActive = activeWord?.id === word.id;
              const isPast = currentTime >= word.end;
              return (
                <span
                  key={word.id}
                  data-active-word={isActive ? "true" : "false"}
                  className={`inline-block transition-colors duration-100 ${
                    index < activeCue.words.length - 1 ? "mr-[0.28em]" : ""
                  } ${
                    isActive
                      ? "text-[#49E6B3] underline decoration-[#49E6B3]/70 decoration-2 underline-offset-4"
                      : isPast
                        ? "text-[#F5F1E8]"
                        : "text-[#F5F1E8]/72"
                  }`}
                >
                  {word.text}
                </span>
              );
            })}
          </p>
        </div>
      </div>
    );
  }

  // preset === "word-highlight"
  return (
    <div
      data-testid="caption-overlay"
      data-preset="word-highlight"
      className="pointer-events-none absolute inset-x-3 bottom-[11%] z-20 flex justify-center"
    >
      <p className="flex max-w-[96%] flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-[1.12rem] font-extrabold uppercase leading-tight tracking-[0.01em] sm:text-[1.22rem]">
        {activeCue.words.map((word) => {
          const isActive = activeWord?.id === word.id;
          const isPast = currentTime >= word.end;
          return (
            <span
              key={word.id}
              data-active-word={isActive ? "true" : "false"}
              className={`inline-block rounded-lg px-2 py-0.5 transition-all duration-100 ${
                isActive
                  ? "scale-[1.06] bg-[#49E6B3] text-[#070B10] shadow-[0_4px_18px_rgba(73,230,179,0.45)]"
                  : isPast
                    ? "bg-[#070B10]/55 text-[#F5F1E8] [text-shadow:0_2px_6px_rgba(7,11,16,0.9)]"
                    : "bg-[#070B10]/40 text-[#F5F1E8]/75 [text-shadow:0_2px_6px_rgba(7,11,16,0.9)]"
              }`}
            >
              {word.text}
            </span>
          );
        })}
      </p>
    </div>
  );
}
