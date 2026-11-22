import type { Metadata } from "next";
import { StudioWorkspace } from "@/components/StudioWorkspace";

export const metadata: Metadata = {
  title: "Sample Studio",
  description:
    "Try ClipCaptions without signing in: scrub word-synced portrait captions and switch between Clean, Boxed, and Word Highlight presets.",
  alternates: {
    canonical: "/studio",
  },
};

export default function StudioPage() {
  return <StudioWorkspace />;
}
