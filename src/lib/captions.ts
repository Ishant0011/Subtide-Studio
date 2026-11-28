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
    description: "Crisp floating type with subtle outline and active word lift.",
  },
  {
    id: "boxed",
    name: "Boxed",
    description: "Deep-ink frosted plate for high legibility over bright frames.",
  },
  {
    id: "word-highlight",
    name: "Word Highlight",
    description: "Kinetic violet pill tracking every spoken word in real time.",
  },
];

export const SAMPLE_CLIP = {
  title: "Creator Hook — Sample Clip",
  filename: "sample-clip.mp4",
  src: "/sample-clip.mp4",
  poster: "/sample-poster.jpg",
  duration: 17.61,
  aspectLabel: "9:16 Portrait",
};

export const SAMPLE_CAPTIONS: CaptionCue[] = [
  {
    id: "cue-1",
    start: 0.64,
    end: 4.24,
    text: "Great short-form clips hook viewers in two seconds.",
    words: [
      { id: "c1-w1", text: "Great", start: 0.64, end: 0.96 },
      { id: "c1-w2", text: "short-form", start: 0.96, end: 1.68 },
      { id: "c1-w3", text: "clips", start: 1.68, end: 2.08 },
      { id: "c1-w4", text: "hook", start: 2.08, end: 2.48 },
      { id: "c1-w5", text: "viewers", start: 2.48, end: 2.8 },
      { id: "c1-w6", text: "in", start: 2.8, end: 3.2 },
      { id: "c1-w7", text: "two", start: 3.2, end: 3.52 },
      { id: "c1-w8", text: "seconds.", start: 3.52, end: 4.24 },
    ],
  },
  {
    id: "cue-2",
    start: 4.64,
    end: 7.12,
    text: "Most people watch with the sound turned off.",
    words: [
      { id: "c2-w1", text: "Most", start: 4.64, end: 4.96 },
      { id: "c2-w2", text: "people", start: 4.96, end: 5.2 },
      { id: "c2-w3", text: "watch", start: 5.2, end: 5.52 },
      { id: "c2-w4", text: "with", start: 5.52, end: 5.76 },
      { id: "c2-w5", text: "the", start: 5.76, end: 5.92 },
      { id: "c2-w6", text: "sound", start: 5.92, end: 6.24 },
      { id: "c2-w7", text: "turned", start: 6.24, end: 6.56 },
      { id: "c2-w8", text: "off.", start: 6.56, end: 7.12 },
    ],
  },
  {
    id: "cue-3",
    start: 7.52,
    end: 10.88,
    text: "Crisp timing turns every sentence into momentum.",
    words: [
      { id: "c3-w1", text: "Crisp", start: 7.52, end: 8.08 },
      { id: "c3-w2", text: "timing", start: 8.08, end: 8.56 },
      { id: "c3-w3", text: "turns", start: 8.56, end: 9.04 },
      { id: "c3-w4", text: "every", start: 9.04, end: 9.44 },
      { id: "c3-w5", text: "sentence", start: 9.44, end: 9.92 },
      { id: "c3-w6", text: "into", start: 9.92, end: 10.32 },
      { id: "c3-w7", text: "momentum.", start: 10.32, end: 10.88 },
    ],
  },
  {
    id: "cue-4",
    start: 11.68,
    end: 14.32,
    text: "Switch presets in one click to match your brand.",
    words: [
      { id: "c4-w1", text: "Switch", start: 11.68, end: 11.92 },
      { id: "c4-w2", text: "presets", start: 11.92, end: 12.48 },
      { id: "c4-w3", text: "in", start: 12.48, end: 12.64 },
      { id: "c4-w4", text: "one", start: 12.64, end: 12.88 },
      { id: "c4-w5", text: "click", start: 12.88, end: 13.12 },
      { id: "c4-w6", text: "to", start: 13.12, end: 13.36 },
      { id: "c4-w7", text: "match", start: 13.36, end: 13.52 },
      { id: "c4-w8", text: "your", start: 13.52, end: 13.76 },
      { id: "c4-w9", text: "brand.", start: 13.76, end: 14.32 },
    ],
  },
  {
    id: "cue-5",
    start: 14.8,
    end: 16.88,
    text: "Caption your clips. Keep your style.",
    words: [
      { id: "c5-w1", text: "Caption", start: 14.8, end: 15.2 },
      { id: "c5-w2", text: "your", start: 15.2, end: 15.44 },
      { id: "c5-w3", text: "clips.", start: 15.44, end: 16.08 },
      { id: "c5-w4", text: "Keep", start: 16.08, end: 16.4 },
      { id: "c5-w5", text: "your", start: 16.4, end: 16.56 },
      { id: "c5-w6", text: "style.", start: 16.56, end: 16.88 },
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
