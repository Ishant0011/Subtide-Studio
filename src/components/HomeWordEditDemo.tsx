"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";

const INITIAL_WORD = "too";
const EXPECTED_WORD = "two";

export function HomeWordEditDemo() {
  const [word, setWord] = useState(INITIAL_WORD);

  const cleaned = word.trim() || "___";
  const isFixed = word.trim().toLowerCase() === EXPECTED_WORD;
  const isModified = word !== INITIAL_WORD;

  return (
    <div
      data-testid="home-word-edit-demo"
      className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)] lg:gap-10"
    >
      {/* Interactive Transcript Correction Card */}
      <div className="rounded-2xl bg-[#1D1D27] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold text-ink-secondary">
            Cue #1 · 0:00.6 – 0:04.2
          </span>
          {isFixed ? (
            <span
              data-testid="word-edit-status"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300"
            >
              <Check className="h-3 w-3" />
              <span>Caption updated</span>
            </span>
          ) : (
            <span
              data-testid="word-edit-status"
              className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200"
            >
              <span>1 misheard word</span>
            </span>
          )}
        </div>

        <p className="mt-4 text-base leading-relaxed text-ink sm:text-lg">
          <span>Great short-form clips hook viewers in </span>
          <label htmlFor="home-word-edit-input" className="sr-only">
            Fix the misheard word
          </label>
          <input
            id="home-word-edit-input"
            data-testid="word-edit-input"
            type="text"
            value={word}
            maxLength={20}
            onChange={(e) => setWord(e.target.value)}
            aria-label="Edit misheard word"
            className={`mx-0.5 inline-block w-24 rounded-lg border px-2 py-0.5 text-center font-bold text-ink transition focus:outline-none focus:ring-2 focus:ring-accent ${
              isFixed
                ? "border-emerald-400/60 bg-emerald-500/15"
                : "border-accent bg-accent/18"
            }`}
          />
          <span> seconds.</span>
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {!isFixed && (
            <button
              type="button"
              data-testid="word-edit-suggestion"
              onClick={() => setWord(EXPECTED_WORD)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-[#101014] transition hover:bg-accent-hover"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Fix to &ldquo;two&rdquo;</span>
            </button>
          )}

          <button
            type="button"
            data-testid="word-edit-reset"
            disabled={!isModified}
            onClick={() => setWord(INITIAL_WORD)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#14141C] px-3.5 py-2 text-xs font-semibold text-ink-secondary transition hover:border-white/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset sample</span>
          </button>

          <Link
            href="/studio"
            data-testid="word-edit-try-sample"
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-accent transition hover:text-accent-hover"
          >
            <span>Try a sample</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Live Video Frame Preview Updating Immediately */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-[#101014] shadow-[0_20px_48px_rgba(0,0,0,0.45)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sample-poster.jpg"
          alt="Live caption preview updating as you edit a word"
          loading="lazy"
          className="h-full w-full object-cover object-[50%_28%]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div
          data-testid="word-edit-preview-caption"
          className="pointer-events-none absolute inset-x-4 bottom-5 flex flex-wrap justify-center gap-1.5 text-center text-sm font-extrabold uppercase tracking-tight sm:text-base"
        >
          <span className="rounded bg-black/75 px-1.5 py-0.5 text-ink">
            HOOK VIEWERS IN
          </span>
          <span className="rounded bg-accent px-2 py-0.5 text-[#101014] shadow-md">
            {cleaned.toUpperCase()}
          </span>
          <span className="rounded bg-black/75 px-1.5 py-0.5 text-ink">
            SECONDS.
          </span>
        </div>
      </div>
    </div>
  );
}
