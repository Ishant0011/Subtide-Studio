import fs from "fs";
import type { TranscriptionAdapterMode } from "./config";
import { WorkerError } from "./media";

export interface NormalizedWord {
  id: string;
  text: string;
  start_ms: number;
  end_ms: number;
  confidence: number | null;
}

export interface NormalizedCue {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  words: NormalizedWord[];
}

export interface TranscriptionResult {
  source: "deepgram_nova3" | "fixture" | "no_speech";
  speechStatus: "speech" | "no_speech";
  language: string;
  words: NormalizedWord[];
  cues: NormalizedCue[];
}

/**
 * Computes normalized RMS amplitude (0..1) of a 16-bit PCM WAV file.
 * Used by the fixture adapter to detect genuine silence / no-speech clips.
 */
export function measureWavRms(wavPath: string): number {
  const buf = fs.readFileSync(wavPath);
  // Find 'data' chunk header
  let offset = 12;
  let dataStart = 44;
  let dataLen = Math.max(0, buf.length - 44);

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === "data") {
      dataStart = offset + 8;
      dataLen = Math.min(chunkSize, buf.length - dataStart);
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  const sampleCount = Math.floor(dataLen / 2);
  if (sampleCount === 0) return 0;

  let sumSq = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = buf.readInt16LE(dataStart + i * 2) / 32768;
    sumSq += sample * sample;
  }
  return Math.sqrt(sumSq / sampleCount);
}

export function normalizeWords(
  rawWords: Array<{ text: string; startSec: number; endSec: number; confidence?: number }>,
  durationMs: number
): NormalizedWord[] {
  const words: NormalizedWord[] = [];
  let prevEnd = 0;

  for (let i = 0; i < rawWords.length; i++) {
    const item = rawWords[i];
    const text = (item.text || "").trim();
    if (!text) continue;

    let startMs = Math.round(item.startSec * 1000);
    let endMs = Math.round(item.endSec * 1000);

    if (!Number.isFinite(startMs)) startMs = prevEnd;
    if (!Number.isFinite(endMs)) endMs = startMs + 120;

    startMs = Math.max(0, Math.min(durationMs, startMs));
    endMs = Math.max(startMs, Math.min(durationMs, endMs));
    if (startMs < prevEnd) startMs = prevEnd;
    if (endMs < startMs) endMs = startMs;

    prevEnd = endMs;
    words.push({
      id: `w-${i + 1}`,
      text,
      start_ms: startMs,
      end_ms: endMs,
      confidence:
        typeof item.confidence === "number" && Number.isFinite(item.confidence)
          ? Number(item.confidence.toFixed(3))
          : null,
    });
  }

  return words;
}

export function groupWordsIntoCues(words: NormalizedWord[]): NormalizedCue[] {
  if (words.length === 0) return [];

  const cues: NormalizedCue[] = [];
  let bucket: NormalizedWord[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const cueIndex = cues.length + 1;
    cues.push({
      id: `cue-${cueIndex}`,
      start_ms: bucket[0].start_ms,
      end_ms: bucket[bucket.length - 1].end_ms,
      text: bucket.map((w) => w.text).join(" "),
      words: bucket,
    });
    bucket = [];
  };

  for (const word of words) {
    if (bucket.length > 0) {
      const prev = bucket[bucket.length - 1];
      const gapMs = word.start_ms - prev.end_ms;
      const spanMs = word.end_ms - bucket[0].start_ms;
      if (bucket.length >= 6 || spanMs > 2800 || gapMs > 550) {
        flush();
      }
    }

    bucket.push(word);

    if (/[.!?]$/.test(word.text) && bucket.length >= 2) {
      flush();
    }
  }

  flush();
  return cues;
}

async function transcribeWithDeepgramNova3(
  wavPath: string,
  apiKey: string,
  durationMs: number
): Promise<TranscriptionResult> {
  const audioBytes = fs.readFileSync(wavPath);
  const endpoint =
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "audio/wav",
      },
      body: audioBytes,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new WorkerError(
      "provider_failure",
      `Deepgram request failed: ${err instanceof Error ? err.message : String(err)}`,
      true
    );
  }
  clearTimeout(timer);

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    const retryable = response.status === 429 || response.status >= 500;
    throw new WorkerError(
      "provider_failure",
      `Deepgram Nova-3 returned HTTP ${response.status}: ${bodyText.slice(0, 200)}`,
      retryable
    );
  }

  const json = (await response.json()) as {
    results?: {
      channels?: Array<{
        detected_language?: string;
        alternatives?: Array<{
          words?: Array<{
            word?: string;
            punctuated_word?: string;
            start?: number;
            end?: number;
            confidence?: number;
          }>;
        }>;
      }>;
    };
  };

  const channel = json.results?.channels?.[0];
  const rawWords = channel?.alternatives?.[0]?.words ?? [];
  const language = channel?.detected_language || "en";

  const words = normalizeWords(
    rawWords.map((w) => ({
      text: w.punctuated_word || w.word || "",
      startSec: typeof w.start === "number" ? w.start : 0,
      endSec: typeof w.end === "number" ? w.end : 0,
      confidence: w.confidence,
    })),
    durationMs
  );

  if (words.length === 0) {
    return {
      source: "deepgram_nova3",
      speechStatus: "no_speech",
      language,
      words: [],
      cues: [],
    };
  }

  return {
    source: "deepgram_nova3",
    speechStatus: "speech",
    language,
    words,
    cues: groupWordsIntoCues(words),
  };
}

function transcribeWithFixture(
  wavPath: string,
  durationMs: number,
  originalFilename: string
): TranscriptionResult {
  if (
    process.env.FIXTURE_FORCE_ERROR === "provider_failure" ||
    (process.env.ALLOW_FIXTURE_FAILURE_TRIGGER === "true" &&
      /provider[-_]?fail/i.test(originalFilename))
  ) {
    throw new WorkerError(
      "provider_failure",
      "Simulated transcription provider failure (503 Service Unavailable).",
      true
    );
  }

  const rms = measureWavRms(wavPath);
  if (rms < 0.002 || /no[-_]?speech|silence/i.test(originalFilename)) {
    return {
      source: "fixture",
      speechStatus: "no_speech",
      language: "en",
      words: [],
      cues: [],
    };
  }

  const sampleTokens = [
    "Subtide",
    "Studio",
    "synced",
    "this",
    "clip.",
    "Every",
    "word",
    "lands",
    "right",
    "on",
    "beat.",
  ];

  const startFloor = Math.min(250, Math.floor(durationMs * 0.05));
  const usableSpan = Math.max(400, durationMs - startFloor - 200);
  const wordCount = Math.min(
    sampleTokens.length,
    Math.max(3, Math.floor(usableSpan / 320))
  );
  const stepMs = Math.floor(usableSpan / wordCount);

  const rawWords = sampleTokens.slice(0, wordCount).map((text, idx) => {
    const startMs = startFloor + idx * stepMs;
    const endMs = Math.min(durationMs, startMs + Math.max(120, stepMs - 40));
    return {
      text,
      startSec: startMs / 1000,
      endSec: endMs / 1000,
      confidence: 0.99,
    };
  });

  const words = normalizeWords(rawWords, durationMs);
  return {
    source: "fixture",
    speechStatus: "speech",
    language: "en",
    words,
    cues: groupWordsIntoCues(words),
  };
}

export async function transcribeAudio(input: {
  wavPath: string;
  durationMs: number;
  originalFilename: string;
  mode: TranscriptionAdapterMode;
  deepgramApiKey: string | null;
}): Promise<TranscriptionResult> {
  const useDeepgram =
    input.mode === "deepgram" ||
    (input.mode === "auto" && Boolean(input.deepgramApiKey));

  if (useDeepgram) {
    if (!input.deepgramApiKey) {
      throw new WorkerError(
        "provider_failure",
        "TRANSCRIPTION_ADAPTER=deepgram requires DEEPGRAM_API_KEY.",
        false
      );
    }
    return transcribeWithDeepgramNova3(
      input.wavPath,
      input.deepgramApiKey,
      input.durationMs
    );
  }

  return transcribeWithFixture(
    input.wavPath,
    input.durationMs,
    input.originalFilename
  );
}
