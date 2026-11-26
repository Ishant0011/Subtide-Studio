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
  duration: 13.75,
  aspectLabel: "9:16 Portrait",
};

export const SAMPLE_CAPTIONS: CaptionCue[] = [
  {
    id: "cue-1",
    start: 0.35,
    end: 2.83,
    text: "Great short-form clips hook viewers in two seconds.",
    words: [
      { id: "c1-w1", text: "Great", start: 0.35, end: 0.64 },
      { id: "c1-w2", text: "short-form", start: 0.64, end: 1.15 },
      { id: "c1-w3", text: "clips", start: 1.15, end: 1.44 },
      { id: "c1-w4", text: "hook", start: 1.44, end: 1.67 },
      { id: "c1-w5", text: "viewers", start: 1.67, end: 2.07 },
      { id: "c1-w6", text: "in", start: 2.07, end: 2.18 },
      { id: "c1-w7", text: "two", start: 2.18, end: 2.35 },
      { id: "c1-w8", text: "seconds.", start: 2.35, end: 2.83 },
    ],
  },
  {
    id: "cue-2",
    start: 3.15,
    end: 5.08,
    text: "Most people watch with the sound turned off.",
    words: [
      { id: "c2-w1", text: "Most", start: 3.15, end: 3.36 },
      { id: "c2-w2", text: "people", start: 3.36, end: 3.67 },
      { id: "c2-w3", text: "watch", start: 3.67, end: 3.93 },
      { id: "c2-w4", text: "with", start: 3.93, end: 4.14 },
      { id: "c2-w5", text: "the", start: 4.14, end: 4.29 },
      { id: "c2-w6", text: "sound", start: 4.29, end: 4.55 },
      { id: "c2-w7", text: "turned", start: 4.55, end: 4.86 },
      { id: "c2-w8", text: "off.", start: 4.86, end: 5.08 },
    ],
  },
  {
    id: "cue-3",
    start: 5.4,
    end: 7.78,
    text: "Crisp timing turns every sentence into momentum.",
    words: [
      { id: "c3-w1", text: "Crisp", start: 5.4, end: 5.68 },
      { id: "c3-w2", text: "timing", start: 5.68, end: 6.02 },
      { id: "c3-w3", text: "turns", start: 6.02, end: 6.3 },
      { id: "c3-w4", text: "every", start: 6.3, end: 6.58 },
      { id: "c3-w5", text: "sentence", start: 6.58, end: 7.03 },
      { id: "c3-w6", text: "into", start: 7.03, end: 7.25 },
      { id: "c3-w7", text: "momentum.", start: 7.25, end: 7.78 },
    ],
  },
  {
    id: "cue-4",
    start: 8.1,
    end: 10.37,
    text: "Switch presets in one click to match your brand.",
    words: [
      { id: "c4-w1", text: "Switch", start: 8.1, end: 8.44 },
      { id: "c4-w2", text: "presets", start: 8.44, end: 8.83 },
      { id: "c4-w3", text: "in", start: 8.83, end: 8.94 },
      { id: "c4-w4", text: "one", start: 8.94, end: 9.11 },
      { id: "c4-w5", text: "click", start: 9.11, end: 9.39 },
      { id: "c4-w6", text: "to", start: 9.39, end: 9.5 },
      { id: "c4-w7", text: "match", start: 9.5, end: 9.78 },
      { id: "c4-w8", text: "your", start: 9.78, end: 10.0 },
      { id: "c4-w9", text: "brand.", start: 10.0, end: 10.37 },
    ],
  },
  {
    id: "cue-5",
    start: 10.69,
    end: 13.2,
    text: "Caption your clips. Keep your style.",
    words: [
      { id: "c5-w1", text: "Caption", start: 10.69, end: 11.24 },
      { id: "c5-w2", text: "your", start: 11.24, end: 11.55 },
      { id: "c5-w3", text: "clips.", start: 11.55, end: 12.06 },
      { id: "c5-w4", text: "Keep", start: 12.06, end: 12.37 },
      { id: "c5-w5", text: "your", start: 12.37, end: 12.68 },
      { id: "c5-w6", text: "style.", start: 12.68, end: 13.2 },
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
