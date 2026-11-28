import "server-only";

import { GoogleGenAI } from "@google/genai";

export const GEMINI_CAPTION_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";

const FALLBACK_CAPTION_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-4-hydrogen",
] as const;

const GEMINI_REQUEST_TIMEOUT_MS = 18_000;

export type GeminiErrorCode =
  | "gemini_not_configured"
  | "model_unavailable"
  | "timeout"
  | "quota_exceeded"
  | "auth_failed"
  | "provider_error";

export class GeminiServiceError extends Error {
  constructor(
    public readonly code: GeminiErrorCode,
    public readonly httpStatus: number,
    message: string
  ) {
    super(message);
    this.name = "GeminiServiceError";
  }
}

function classifyGeminiError(err: unknown): GeminiServiceError {
  if (err instanceof GeminiServiceError) return err;
  const status =
    typeof (err as { status?: unknown })?.status === "number"
      ? ((err as { status: number }).status)
      : null;
  const msg = err instanceof Error ? err.message : String(err ?? "");

  if (/timed out|timeout|aborted|AbortError/i.test(msg)) {
    return new GeminiServiceError(
      "timeout",
      504,
      "Gemini took too long to respond. Please try again in a moment."
    );
  }
  if (status === 429 || /quota|rate.?limit|resource_exhausted|429/i.test(msg)) {
    return new GeminiServiceError(
      "quota_exceeded",
      429,
      "Gemini API quota limit reached. Please wait a bit or check your API quota."
    );
  }
  if (
    status === 401 ||
    status === 403 ||
    /api key|unauthorized|permission|invalid.?key/i.test(msg)
  ) {
    return new GeminiServiceError(
      "auth_failed",
      502,
      "Gemini API authentication failed. Check that GEMINI_API_KEY is valid."
    );
  }
  if (
    status === 404 ||
    status === 503 ||
    /not found|no longer available|high demand|unavailable|overloaded/i.test(msg)
  ) {
    return new GeminiServiceError(
      "model_unavailable",
      503,
      "The configured Gemini model is temporarily unavailable. Please try again shortly."
    );
  }
  return new GeminiServiceError(
    "provider_error",
    502,
    "Gemini could not complete that request right now. Please try again."
  );
}

async function createInteractionWithFallback(
  client: GoogleGenAI,
  params: {
    system_instruction: string;
    input: string;
    response_format: {
      type: "text";
      mime_type: "application/json";
      schema: Record<string, unknown>;
    };
  }
): Promise<{ outputText: string | null | undefined; modelUsed: string }> {
  const candidates = Array.from(
    new Set<string>([GEMINI_CAPTION_MODEL, ...FALLBACK_CAPTION_MODELS])
  );
  let lastErr: GeminiServiceError | null = null;

  for (const model of candidates) {
    try {
      const interaction = await Promise.race([
        client.interactions.create({
          model,
          store: false,
          system_instruction: params.system_instruction,
          input: params.input,
          response_format: params.response_format,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Gemini request timed out")),
            GEMINI_REQUEST_TIMEOUT_MS
          )
        ),
      ]);
      return { outputText: interaction.output_text, modelUsed: model };
    } catch (err) {
      const classified = classifyGeminiError(err);
      lastErr = classified;
      if (
        classified.code === "model_unavailable" ||
        classified.code === "timeout"
      ) {
        continue;
      }
      throw classified;
    }
  }

  throw (
    lastErr ??
    new GeminiServiceError(
      "model_unavailable",
      503,
      "No Gemini caption model is available right now."
    )
  );
}

function parseTimestampToSeconds(ts: string): number | null {
  const m = ts.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  if (m[3] !== undefined) {
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatSecondsMmSs(totalSec: number): string {
  const clamped = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export type GeminiAssistAction = "polish" | "translate" | "social";

export interface GeminiCueInput {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
}

export interface GeminiCueUpdate {
  id: string;
  text: string;
}

export interface GeminiPolishResult {
  action: "polish";
  model: string;
  summary: string;
  cues: GeminiCueUpdate[];
}

export interface GeminiTranslateResult {
  action: "translate";
  model: string;
  targetLanguage: string;
  summary: string;
  suggestDevanagariFont: boolean;
  cues: GeminiCueUpdate[];
}

export interface GeminiSocialChapter {
  timestamp: string;
  title: string;
}

export interface GeminiSocialResult {
  action: "social";
  model: string;
  hooks: string[];
  description: string;
  hashtags: string[];
  chapters: GeminiSocialChapter[];
}

export type GeminiAssistResult =
  | GeminiPolishResult
  | GeminiTranslateResult
  | GeminiSocialResult;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on this server.");
  }
  return new GoogleGenAI({ apiKey });
}

function formatMsTimestamp(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildCueTranscriptLines(cues: GeminiCueInput[]): string {
  return cues
    .map(
      (cue, idx) =>
        `${idx + 1}. [id=${cue.id}] (${formatMsTimestamp(cue.start_ms)}-${formatMsTimestamp(cue.end_ms)}) ${cue.text}`
    )
    .join("\n");
}

function extractJsonObject(raw: string | undefined | null): unknown {
  if (!raw || !raw.trim()) {
    throw new Error("Gemini returned an empty response.");
  }
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    throw new Error("Gemini returned invalid JSON output.");
  }
}

function reconcileReturnedCues(
  originalCues: GeminiCueInput[],
  rawUpdates: unknown
): GeminiCueUpdate[] {
  const byId = new Map<string, string>();
  if (Array.isArray(rawUpdates)) {
    for (const item of rawUpdates) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { text?: unknown }).text === "string"
      ) {
        const id = (item as { id: string }).id.trim();
        const text = (item as { text: string }).text
          .replace(/\r\n?/g, "\n")
          .replace(/[ \t]+/g, " ")
          .trim();
        if (id && text) {
          byId.set(id, text);
        }
      }
    }
  }

  return originalCues.map((cue) => ({
    id: cue.id,
    text: byId.get(cue.id) ?? cue.text,
  }));
}

export async function runGeminiPolishCaptions(input: {
  cues: GeminiCueInput[];
  projectTitle?: string;
  removeFillers?: boolean;
}): Promise<GeminiPolishResult> {
  const client = getGeminiClient();
  const removeFillers = input.removeFillers !== false;

  const schema = {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "One concise sentence summarizing the caption improvements made.",
      },
      cues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            text: { type: "string" },
          },
          required: ["id", "text"],
        },
      },
    },
    required: ["summary", "cues"],
  };

  const { outputText, modelUsed } = await createInteractionWithFallback(client, {
    system_instruction: [
      "You are an expert short-form video caption editor for Subtide Studio.",
      "Polish the provided time-synced caption cues for readability, punctuation, capitalization, and spelling.",
      removeFillers
        ? 'Remove obvious spoken filler words ("um", "uh", "like" when purely filler) only when it does not leave a cue empty.'
        : "Keep the speaker's exact wording and only fix punctuation, capitalization, and clear transcription typos.",
      "CRITICAL RULES:",
      "- Return EVERY cue with its exact original `id` in the same order.",
      "- Preserve word count as closely as possible so word-level karaoke timing remains synced.",
      "- Never merge or split cues, and never return empty text for any cue.",
      "- Keep lines concise and natural for vertical video overlays.",
    ].join("\n"),
    input: [
      input.projectTitle ? `Project title: ${input.projectTitle}` : null,
      "Caption cues:",
      buildCueTranscriptLines(input.cues),
    ]
      .filter(Boolean)
      .join("\n\n"),
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema,
    },
  });

  const parsed = extractJsonObject(outputText) as {
    summary?: unknown;
    cues?: unknown;
  };

  return {
    action: "polish",
    model: modelUsed,
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "Polished punctuation, casing, and readability across your captions.",
    cues: reconcileReturnedCues(input.cues, parsed.cues),
  };
}

export async function runGeminiTranslateCaptions(input: {
  cues: GeminiCueInput[];
  targetLanguage: string;
  projectTitle?: string;
}): Promise<GeminiTranslateResult> {
  const client = getGeminiClient();
  const targetLanguage = input.targetLanguage.trim();

  const schema = {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "One concise sentence describing the translation style and tone.",
      },
      cues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            text: { type: "string" },
          },
          required: ["id", "text"],
        },
      },
    },
    required: ["summary", "cues"],
  };

  const { outputText, modelUsed } = await createInteractionWithFallback(client, {
    system_instruction: [
      "You are a professional subtitle translator for Subtide Studio.",
      `Translate every caption cue naturally into ${targetLanguage} while matching the speaker's tone and pacing for short-form video subtitles.`,
      "CRITICAL RULES:",
      "- Return EVERY cue with its exact original `id` in the same order.",
      "- Keep each translated cue concise enough to read comfortably within its time window.",
      "- Never merge or split cues, and never return empty text.",
      "- If the target language is Hindi (Devanagari), write natural Devanagari script.",
    ].join("\n"),
    input: [
      input.projectTitle ? `Project title: ${input.projectTitle}` : null,
      `Target language: ${targetLanguage}`,
      "Caption cues:",
      buildCueTranscriptLines(input.cues),
    ]
      .filter(Boolean)
      .join("\n\n"),
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema,
    },
  });

  const parsed = extractJsonObject(outputText) as {
    summary?: unknown;
    cues?: unknown;
  };
  const translatedCues = reconcileReturnedCues(input.cues, parsed.cues);
  const containsDevanagari = translatedCues.some((c) =>
    /[\u0900-\u097F]/.test(c.text)
  );

  return {
    action: "translate",
    model: modelUsed,
    targetLanguage,
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : `Translated ${translatedCues.length} caption cues into ${targetLanguage}.`,
    suggestDevanagariFont: containsDevanagari,
    cues: translatedCues,
  };
}

export async function runGeminiSocialKit(input: {
  cues: GeminiCueInput[];
  projectTitle?: string;
  clipDurationMs?: number;
}): Promise<GeminiSocialResult> {
  const client = getGeminiClient();
  const maxCueEndMs = input.cues.reduce(
    (max, c) => Math.max(max, c.end_ms),
    0
  );
  const maxDurationSec = Math.max(
    1,
    Math.floor(
      Math.max(input.clipDurationMs ?? 0, maxCueEndMs) / 1000
    )
  );

  const schema = {
    type: "object",
    properties: {
      hooks: {
        type: "array",
        description: "3 punchy, scroll-stopping title or hook options.",
        items: { type: "string" },
      },
      description: {
        type: "string",
        description:
          "A ready-to-post social caption/description (2-4 concise sentences).",
      },
      hashtags: {
        type: "array",
        description: "5 to 8 relevant hashtags starting with #.",
        items: { type: "string" },
      },
      chapters: {
        type: "array",
        description:
          "2 to 5 key moments/chapters using MM:SS timestamps grounded in the cues.",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "string" },
            title: { type: "string" },
          },
          required: ["timestamp", "title"],
        },
      },
    },
    required: ["hooks", "description", "hashtags", "chapters"],
  };

  const { outputText, modelUsed } = await createInteractionWithFallback(client, {
    system_instruction: [
      "You are a short-form video strategist and copywriter for Subtide Studio.",
      "From the timestamped transcript, generate a high-performing Social Post Kit for Reels, Shorts, TikTok, and YouTube.",
      `Ground all hooks, descriptions, hashtags, and MM:SS chapters strictly in what is actually said in the transcript, keeping every chapter timestamp between 00:00 and ${formatSecondsMmSs(maxDurationSec)}.`,
    ].join("\n"),
    input: [
      input.projectTitle ? `Project title: ${input.projectTitle}` : null,
      "Timestamped transcript:",
      buildCueTranscriptLines(input.cues),
    ]
      .filter(Boolean)
      .join("\n\n"),
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema,
    },
  });

  const parsed = extractJsonObject(outputText) as {
    hooks?: unknown;
    description?: unknown;
    hashtags?: unknown;
    chapters?: unknown;
  };

  const hooks = Array.isArray(parsed.hooks)
    ? parsed.hooks
        .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
        .map((h) => h.trim())
        .slice(0, 5)
    : [];

  const description =
    typeof parsed.description === "string" ? parsed.description.trim() : "";

  const hashtags = Array.isArray(parsed.hashtags)
    ? parsed.hashtags
        .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
        .map((h) => {
          const clean = h.trim().replace(/\s+/g, "");
          return clean.startsWith("#") ? clean : `#${clean}`;
        })
        .slice(0, 10)
    : [];

  const chapters: GeminiSocialChapter[] = Array.isArray(parsed.chapters)
    ? parsed.chapters
        .filter(
          (ch): ch is { timestamp: string; title: string } =>
            Boolean(ch) &&
            typeof ch === "object" &&
            typeof (ch as { timestamp?: unknown }).timestamp === "string" &&
            typeof (ch as { title?: unknown }).title === "string"
        )
        .map((ch) => {
          const parsedSec = parseTimestampToSeconds(ch.timestamp);
          const clampedSec =
            parsedSec === null
              ? 0
              : Math.max(0, Math.min(maxDurationSec, parsedSec));
          return {
            timestamp: formatSecondsMmSs(clampedSec),
            title: ch.title.trim(),
          };
        })
        .filter((ch) => ch.timestamp && ch.title)
        .slice(0, 8)
    : [];

  return {
    action: "social",
    model: modelUsed,
    hooks,
    description,
    hashtags,
    chapters,
  };
}
