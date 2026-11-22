export interface CaptionWord {
  id: string;
  text: string;
  start: number;
  end: number;
}

export interface CaptionCue {
  id: string;
  start: number;
  end: number;
  text: string;
  words: CaptionWord[];
}

export type CaptionPresetId = "clean" | "boxed" | "word-highlight";

export interface CaptionPreset {
  id: CaptionPresetId;
  name: string;
  description: string;
}

export const CAPTION_PRESETS: CaptionPreset[] = [
  {
    id: "clean",
    name: "Clean",
    description: "Crisp floating type with subtle shadow and active word lift.",
  },
  {
    id: "boxed",
    name: "Boxed",
    description: "Deep-ink frosted plate for high legibility over bright frames.",
  },
  {
    id: "word-highlight",
    name: "Word Highlight",
    description: "Kinetic mint pill tracking every spoken word in real time.",
  },
];

export const SAMPLE_CLIP = {
  title: "Creator Hook — Sample Clip",
  filename: "sample-clip.mp4",
  src: "/sample-clip.mp4",
  duration: 15.0,
  aspectLabel: "9:16 Portrait",
};

export const SAMPLE_CAPTIONS: CaptionCue[] = [
  {
    id: "cue-1",
    start: 0.4,
    end: 3.1,
    text: "Great short-form clips hook viewers in two seconds.",
    words: [
      { id: "c1-w1", text: "Great", start: 0.4, end: 0.72 },
      { id: "c1-w2", text: "short-form", start: 0.72, end: 1.22 },
      { id: "c1-w3", text: "clips", start: 1.22, end: 1.56 },
      { id: "c1-w4", text: "hook", start: 1.56, end: 1.88 },
      { id: "c1-w5", text: "viewers", start: 1.88, end: 2.28 },
      { id: "c1-w6", text: "in", start: 2.28, end: 2.46 },
      { id: "c1-w7", text: "two", start: 2.46, end: 2.72 },
      { id: "c1-w8", text: "seconds.", start: 2.72, end: 3.1 },
    ],
  },
  {
    id: "cue-2",
    start: 3.4,
    end: 6.2,
    text: "Most people watch with the sound turned off.",
    words: [
      { id: "c2-w1", text: "Most", start: 3.4, end: 3.74 },
      { id: "c2-w2", text: "people", start: 3.74, end: 4.14 },
      { id: "c2-w3", text: "watch", start: 4.14, end: 4.54 },
      { id: "c2-w4", text: "with", start: 4.54, end: 4.82 },
      { id: "c2-w5", text: "the", start: 4.82, end: 5.02 },
      { id: "c2-w6", text: "sound", start: 5.02, end: 5.44 },
      { id: "c2-w7", text: "turned", start: 5.44, end: 5.82 },
      { id: "c2-w8", text: "off.", start: 5.82, end: 6.2 },
    ],
  },
  {
    id: "cue-3",
    start: 6.5,
    end: 9.4,
    text: "Crisp timing turns every sentence into momentum.",
    words: [
      { id: "c3-w1", text: "Crisp", start: 6.5, end: 6.88 },
      { id: "c3-w2", text: "timing", start: 6.88, end: 7.32 },
      { id: "c3-w3", text: "turns", start: 7.32, end: 7.68 },
      { id: "c3-w4", text: "every", start: 7.68, end: 8.06 },
      { id: "c3-w5", text: "sentence", start: 8.06, end: 8.58 },
      { id: "c3-w6", text: "into", start: 8.58, end: 8.86 },
      { id: "c3-w7", text: "momentum.", start: 8.86, end: 9.4 },
    ],
  },
  {
    id: "cue-4",
    start: 9.7,
    end: 12.3,
    text: "Switch presets in one click to match your brand.",
    words: [
      { id: "c4-w1", text: "Switch", start: 9.7, end: 10.08 },
      { id: "c4-w2", text: "presets", start: 10.08, end: 10.54 },
      { id: "c4-w3", text: "in", start: 10.54, end: 10.74 },
      { id: "c4-w4", text: "one", start: 10.74, end: 11.02 },
      { id: "c4-w5", text: "click", start: 11.02, end: 11.38 },
      { id: "c4-w6", text: "to", start: 11.38, end: 11.56 },
      { id: "c4-w7", text: "match", start: 11.56, end: 11.88 },
      { id: "c4-w8", text: "your", start: 11.88, end: 12.06 },
      { id: "c4-w9", text: "brand.", start: 12.06, end: 12.3 },
    ],
  },
  {
    id: "cue-5",
    start: 12.55,
    end: 14.7,
    text: "Caption your clips. Keep your style.",
    words: [
      { id: "c5-w1", text: "Caption", start: 12.55, end: 13.02 },
      { id: "c5-w2", text: "your", start: 13.02, end: 13.28 },
      { id: "c5-w3", text: "clips.", start: 13.28, end: 13.72 },
      { id: "c5-w4", text: "Keep", start: 13.78, end: 14.08 },
      { id: "c5-w5", text: "your", start: 14.08, end: 14.32 },
      { id: "c5-w6", text: "style.", start: 14.32, end: 14.7 },
    ],
  },
];

export function getActiveCue(
  cues: CaptionCue[],
  currentTime: number
): CaptionCue | null {
  for (const cue of cues) {
    if (currentTime >= cue.start && currentTime <= cue.end) {
      return cue;
    }
  }
  return null;
}

export function getActiveWord(
  cue: CaptionCue | null,
  currentTime: number
): CaptionWord | null {
  if (!cue) return null;
  for (const word of cue.words) {
    if (currentTime >= word.start && currentTime < word.end) {
      return word;
    }
  }
  // If we're exactly at the cue end boundary, highlight the last word
  const lastWord = cue.words[cue.words.length - 1];
  if (lastWord && currentTime >= lastWord.start && currentTime <= lastWord.end) {
    return lastWord;
  }
  return null;
}

export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const totalTenths = Math.round(safe * 10);
  const totalSecs = Math.floor(totalTenths / 10);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const tenths = totalTenths % 10;
  return `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
}
