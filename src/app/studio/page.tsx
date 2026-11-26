import type { Metadata } from "next";
import { ProjectCaptionEditor } from "@/components/ProjectCaptionEditor";
import { DEFAULT_CAPTION_STYLE, type EditorCue } from "@/lib/caption-editor";
import { SAMPLE_CAPTIONS, SAMPLE_CLIP } from "@/lib/captions";

export const metadata: Metadata = {
  title: "Sample Studio",
  description:
    "Try ClipCaptions without signing in: scrub word-synced portrait captions and switch between Clean, Boxed, and Word Highlight presets.",
  alternates: {
    canonical: "/studio",
  },
};

function buildInitialSampleEditorCues(): EditorCue[] {
  return SAMPLE_CAPTIONS.map((cue) => ({
    id: cue.id,
    start_ms: Math.round(cue.start * 1000),
    end_ms: Math.round(cue.end * 1000),
    text: cue.text,
    timing_mode: "word",
    words: cue.words.map((w) => ({
      id: w.id,
      text: w.text,
      start_ms: Math.round(w.start * 1000),
      end_ms: Math.round(w.end * 1000),
      confidence: 0.99,
    })),
  }));
}

export default function StudioPage() {
  return (
    <ProjectCaptionEditor
      projectTitle="Sample Studio"
      mediaKind="video"
      previewUrl={SAMPLE_CLIP.src}
      previewPoster={SAMPLE_CLIP.poster}
      previewWidth={720}
      previewHeight={1280}
      durationMs={Math.round(SAMPLE_CLIP.duration * 1000)}
      initialCues={buildInitialSampleEditorCues()}
      initialStyle={DEFAULT_CAPTION_STYLE}
    />
  );
}
