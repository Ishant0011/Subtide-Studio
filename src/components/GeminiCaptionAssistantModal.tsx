"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Languages,
  Loader2,
  Share2,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { formatMsClock, type EditorCue } from "@/lib/caption-editor";
import type {
  GeminiAssistAction,
  GeminiCueUpdate,
  GeminiPolishResult,
  GeminiSocialResult,
  GeminiTranslateResult,
} from "@/lib/gemini";

interface GeminiCaptionAssistantModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  isSampleMode: boolean;
  projectTitle: string;
  cues: EditorCue[];
  onApplyCaptionUpdates: (
    updates: GeminiCueUpdate[],
    options: {
      notice: string;
      switchToDevanagariFont?: boolean;
      baseCueTextById?: Record<string, string>;
    }
  ) => void;
}

const TARGET_LANGUAGES = [
  "Spanish",
  "Hindi (Devanagari)",
  "Hinglish",
  "French",
  "German",
  "Portuguese",
  "Japanese",
  "Korean",
] as const;

export function GeminiCaptionAssistantModal({
  open,
  onClose,
  projectId,
  isSampleMode,
  projectTitle,
  cues,
  onApplyCaptionUpdates,
}: GeminiCaptionAssistantModalProps) {
  const [activeTab, setActiveTab] = useState<GeminiAssistAction>("polish");
  const [removeFillers, setRemoveFillers] = useState(true);
  const [targetLanguage, setTargetLanguage] = useState<string>("Hindi (Devanagari)");
  const [customLanguage, setCustomLanguage] = useState("");
  const [switchDevanagariFont, setSwitchDevanagariFont] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [polishResult, setPolishResult] = useState<GeminiPolishResult | null>(
    null
  );
  const [polishBaseTexts, setPolishBaseTexts] = useState<Record<string, string>>(
    {}
  );
  const [translateResult, setTranslateResult] =
    useState<GeminiTranslateResult | null>(null);
  const [translateBaseTexts, setTranslateBaseTexts] = useState<
    Record<string, string>
  >({});
  const [socialResult, setSocialResult] = useState<GeminiSocialResult | null>(
    null
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const cueById = useMemo(() => {
    const map = new Map<string, EditorCue>();
    for (const cue of cues) {
      map.set(cue.id, cue);
    }
    return map;
  }, [cues]);

  const polishChangedCount = useMemo(() => {
    if (!polishResult) return 0;
    return polishResult.cues.filter((u) => {
      const orig = cueById.get(u.id);
      return orig && orig.text.trim() !== u.text.trim();
    }).length;
  }, [polishResult, cueById]);

  const effectiveLanguage = customLanguage.trim() || targetLanguage;

  if (!open) return null;

  const runAssist = async (action: GeminiAssistAction) => {
    if (isSampleMode || !projectId) {
      setError("Sign in and open an uploaded project to use Gemini AI Assist.");
      return;
    }
    if (cues.length === 0) {
      setError("Add at least one caption cue before running Gemini AI Assist.");
      return;
    }

    const snapshotBaseTexts: Record<string, string> = {};
    for (const c of cues) {
      snapshotBaseTexts[c.id] = c.text;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          projectId,
          projectTitle,
          removeFillers,
          targetLanguage: action === "translate" ? effectiveLanguage : undefined,
          cues: cues.map((c) => ({
            id: c.id,
            start_ms: c.start_ms,
            end_ms: c.end_ms,
            text: c.text,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Gemini request failed. Please try again."
        );
        return;
      }

      if (action === "polish") {
        setPolishResult(data as GeminiPolishResult);
        setPolishBaseTexts(snapshotBaseTexts);
      } else if (action === "translate") {
        const translated = data as GeminiTranslateResult;
        setTranslateResult(translated);
        setTranslateBaseTexts(snapshotBaseTexts);
        setSwitchDevanagariFont(translated.suggestDevanagariFont);
      } else {
        setSocialResult(data as GeminiSocialResult);
      }
    } catch {
      setError("Network error while contacting Gemini AI Assist.");
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1800);
    } catch {
      // clipboard unavailable
    }
  };

  const applyPolish = () => {
    if (!polishResult) return;
    onApplyCaptionUpdates(polishResult.cues, {
      notice: `Applied Gemini polish to ${polishChangedCount || polishResult.cues.length} caption cues`,
      baseCueTextById: polishBaseTexts,
    });
    onClose();
  };

  const applyTranslation = () => {
    if (!translateResult) return;
    onApplyCaptionUpdates(translateResult.cues, {
      notice: `Translated captions to ${translateResult.targetLanguage}`,
      switchToDevanagariFont:
        translateResult.suggestDevanagariFont && switchDevanagariFont,
      baseCueTextById: translateBaseTexts,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gemini-assist-title"
      data-testid="gemini-assist-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cc-modal-enter flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink/15 bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-accent/35 bg-accent-soft text-accent-hover">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="gemini-assist-title"
                className="text-sm font-semibold tracking-tight text-ink sm:text-base"
              >
                Gemini AI Assist
              </h2>
              <p
                data-testid="gemini-privacy-disclosure"
                className="text-[11px] text-ink-muted"
              >
                Running AI Assist sends your caption text to Google · Preserves
                cue timing &amp; Undo history
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Gemini AI Assist"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink/12 bg-page text-ink-secondary transition hover:border-ink/25 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="border-b border-ink/10 bg-page/60 px-4 py-2.5 sm:px-5">
          <div
            role="tablist"
            aria-label="Gemini AI tools"
            className="grid grid-cols-3 gap-1.5 rounded-xl border border-ink/10 bg-page p-1"
          >
            {(
              [
                { id: "polish", label: "Polish", icon: Wand2 },
                { id: "translate", label: "Translate", icon: Languages },
                { id: "social", label: "Social Kit", icon: Share2 },
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`gemini-tab-${id}`}
                  onClick={() => {
                    setActiveTab(id);
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-accent-soft text-accent-hover ring-1 ring-accent/40"
                      : "text-ink-secondary hover:bg-panel hover:text-ink"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {isSampleMode && (
            <div
              data-testid="gemini-guest-notice"
              className="rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3.5 text-xs text-ink"
            >
              <p className="font-semibold">
                Sign in to run Gemini AI Assist on your own clips
              </p>
              <p className="mt-1 leading-relaxed text-ink-secondary">
                The public sample studio stays free to explore without using AI
                quota. Sign in and upload a clip to polish captions, translate
                to Hindi or Hinglish, and generate a Social Post Kit.
              </p>
              <a
                href="/upload"
                className="mt-3 inline-flex items-center rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-page transition hover:bg-accent-hover"
              >
                Upload a clip
              </a>
            </div>
          )}

          {error && (
            <div
              role="alert"
              data-testid="gemini-assist-error"
              className="flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* POLISH TAB */}
          {activeTab === "polish" && (
            <div className="space-y-3.5">
              <div className="rounded-xl border border-ink/10 bg-page p-3.5">
                <p className="text-xs leading-relaxed text-ink-secondary">
                  Clean up punctuation, capitalization, and transcription slips
                  across all{" "}
                  <span className="font-semibold text-ink">
                    {cues.length} cues
                  </span>{" "}
                  while keeping word-level karaoke timing intact.
                </p>

                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink">
                  <input
                    type="checkbox"
                    checked={removeFillers}
                    onChange={(e) => setRemoveFillers(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-ink/25 accent-[var(--accent)]"
                  />
                  <span>Remove spoken filler words (&ldquo;um&rdquo;, &ldquo;uh&rdquo;, &ldquo;like&rdquo;)</span>
                </label>

                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={loading || isSampleMode}
                      data-testid="gemini-run-polish-btn"
                    onClick={() => void runAssist("polish")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-page transition hover:bg-accent-hover disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {loading ? "Polishing captions..." : "Polish Captions"}
                    </span>
                  </button>
                </div>
              </div>

              {polishResult && (
                <div className="space-y-3 rounded-xl border border-accent/30 bg-page p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-ink">
                        Preview ({polishChangedCount} of{" "}
                        {polishResult.cues.length} cues refined)
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-secondary">
                        {polishResult.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="gemini-apply-polish-btn"
                      onClick={applyPolish}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-page transition hover:bg-accent-hover"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Apply to captions</span>
                    </button>
                  </div>

                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {polishResult.cues.map((updated) => {
                      const orig = cueById.get(updated.id);
                      if (!orig) return null;
                      const changed = orig.text.trim() !== updated.text.trim();
                      return (
                        <div
                          key={updated.id}
                          className={`rounded-lg border px-3 py-2 text-xs ${
                            changed
                              ? "border-accent/30 bg-panel"
                              : "border-ink/8 bg-panel/40 opacity-75"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between text-[10px] font-mono text-ink-muted">
                            <span>{formatMsClock(orig.start_ms)}</span>
                            <span>{changed ? "Updated" : "Unchanged"}</span>
                          </div>
                          {changed && (
                            <p className="text-[11px] text-ink-muted line-through">
                              {orig.text}
                            </p>
                          )}
                          <p className="font-medium text-ink">{updated.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TRANSLATE TAB */}
          {activeTab === "translate" && (
            <div className="space-y-3.5">
              <div className="rounded-xl border border-ink/10 bg-page p-3.5">
                <p className="text-xs leading-relaxed text-ink-secondary">
                  Translate all{" "}
                  <span className="font-semibold text-ink">
                    {cues.length} cues
                  </span>{" "}
                  while keeping subtitle timing and short-form pacing intact.
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {TARGET_LANGUAGES.map((lang) => {
                    const selected =
                      !customLanguage.trim() && targetLanguage === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          setTargetLanguage(lang);
                          setCustomLanguage("");
                        }}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          selected
                            ? "border-accent/55 bg-accent-soft text-accent-hover"
                            : "border-ink/12 bg-panel text-ink-secondary hover:border-ink/25 hover:text-ink"
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={customLanguage}
                    onChange={(e) => setCustomLanguage(e.target.value)}
                    placeholder="Or enter any language (e.g. Arabic, Italian, Tamil)..."
                    className="flex-1 rounded-xl border border-ink/12 bg-panel px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                  />
                    <button
                      type="button"
                      disabled={loading || isSampleMode || !effectiveLanguage}
                      data-testid="gemini-run-translate-btn"
                    onClick={() => void runAssist("translate")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-page transition hover:bg-accent-hover disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Languages className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {loading
                        ? "Translating..."
                        : `Translate to ${effectiveLanguage}`}
                    </span>
                  </button>
                </div>
              </div>

              {translateResult && (
                <div className="space-y-3 rounded-xl border border-accent/30 bg-page p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-ink">
                        {translateResult.targetLanguage} Preview
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-secondary">
                        {translateResult.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="gemini-apply-translate-btn"
                      onClick={applyTranslation}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-page transition hover:bg-accent-hover"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Apply translation</span>
                    </button>
                  </div>

                  {translateResult.suggestDevanagariFont && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-accent/25 bg-accent-soft/50 px-3 py-2 text-xs text-ink">
                      <input
                        type="checkbox"
                        checked={switchDevanagariFont}
                        onChange={(e) =>
                          setSwitchDevanagariFont(e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-ink/25 accent-[var(--accent)]"
                      />
                      <span>
                        Also switch caption font to{" "}
                        <strong>Noto Devanagari</strong> for crisp Hindi
                        rendering
                      </span>
                    </label>
                  )}

                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {translateResult.cues.map((updated) => {
                      const orig = cueById.get(updated.id);
                      if (!orig) return null;
                      return (
                        <div
                          key={updated.id}
                          className="rounded-lg border border-ink/10 bg-panel px-3 py-2 text-xs"
                        >
                          <div className="mb-1 text-[10px] font-mono text-ink-muted">
                            {formatMsClock(orig.start_ms)}
                          </div>
                          <p className="text-[11px] text-ink-muted">
                            {orig.text}
                          </p>
                          <p className="mt-0.5 font-medium text-ink">
                            {updated.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SOCIAL POST KIT TAB */}
          {activeTab === "social" && (
            <div className="space-y-3.5">
              <div className="rounded-xl border border-ink/10 bg-page p-3.5">
                <p className="text-xs leading-relaxed text-ink-secondary">
                  Turn your clip transcript into scroll-stopping title hooks, a
                  ready-to-paste description, hashtags, and timestamped chapters
                  for Reels, TikTok, and YouTube Shorts.
                </p>

                <div className="mt-3.5">
                    <button
                      type="button"
                      disabled={loading || isSampleMode}
                      data-testid="gemini-run-social-btn"
                    onClick={() => void runAssist("social")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-page transition hover:bg-accent-hover disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Share2 className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {loading ? "Generating Social Kit..." : "Generate Social Kit"}
                    </span>
                  </button>
                </div>
              </div>

              {socialResult && (
                <div className="space-y-3">
                  {/* Hooks */}
                  {socialResult.hooks.length > 0 && (
                    <div className="rounded-xl border border-ink/10 bg-page p-3.5">
                      <p className="text-xs font-semibold text-ink">
                        Hook &amp; Title Ideas
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {socialResult.hooks.map((hook, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 rounded-lg border border-ink/8 bg-panel px-3 py-2 text-xs text-ink"
                          >
                            <span>{hook}</span>
                            <button
                              type="button"
                              onClick={() => void copyText(`hook-${idx}`, hook)}
                              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink/12 bg-page px-2 py-1 text-[11px] text-ink-secondary hover:text-ink"
                            >
                              {copiedKey === `hook-${idx}` ? (
                                <Check className="h-3 w-3 text-accent" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              <span>
                                {copiedKey === `hook-${idx}`
                                  ? "Copied"
                                  : "Copy"}
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description & Hashtags */}
                  <div className="rounded-xl border border-ink/10 bg-page p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-ink">
                        Caption &amp; Hashtags
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            "desc",
                            `${socialResult.description}\n\n${socialResult.hashtags.join(" ")}`
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-ink/12 bg-panel px-2 py-1 text-[11px] text-ink-secondary hover:text-ink"
                      >
                        {copiedKey === "desc" ? (
                          <Check className="h-3 w-3 text-accent" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>
                          {copiedKey === "desc" ? "Copied" : "Copy all"}
                        </span>
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                      {socialResult.description}
                    </p>
                    {socialResult.hashtags.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {socialResult.hashtags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-hover"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chapters */}
                  {socialResult.chapters.length > 0 && (
                    <div className="rounded-xl border border-ink/10 bg-page p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-ink">
                          Key Moments / Chapters
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            void copyText(
                              "chapters",
                              socialResult.chapters
                                .map((c) => `${c.timestamp} ${c.title}`)
                                .join("\n")
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-ink/12 bg-panel px-2 py-1 text-[11px] text-ink-secondary hover:text-ink"
                        >
                          {copiedKey === "chapters" ? (
                            <Check className="h-3 w-3 text-accent" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          <span>
                            {copiedKey === "chapters" ? "Copied" : "Copy"}
                          </span>
                        </button>
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-ink-secondary">
                        {socialResult.chapters.map((ch, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="rounded bg-panel px-1.5 py-0.5 font-mono text-[11px] text-accent-hover">
                              {ch.timestamp}
                            </span>
                            <span className="text-ink">{ch.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
