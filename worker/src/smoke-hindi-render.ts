import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import {
  buildAssScript,
  renderExportArtifact,
  verifyFfmpegComplexShaping,
} from "./render";

async function main() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const ffmpegPath =
    process.env.FFMPEG_PATH?.trim() ||
    (typeof ffmpegStatic === "string" ? ffmpegStatic : "ffmpeg");
  const ffprobePath =
    process.env.FFPROBE_PATH?.trim() ||
    (ffprobeStatic?.path ? ffprobeStatic.path : "ffprobe");
  const fontsDir = path.join(repoRoot, "public", "fonts");
  const sampleClip = path.join(repoRoot, "public", "sample-clip.mp4");

  const hasShaping = await verifyFfmpegComplexShaping(ffmpegPath, repoRoot);
  if (!hasShaping) {
    throw new Error(
      `FFmpeg binary at ${ffmpegPath} does not report --enable-libass and --enable-libharfbuzz.`
    );
  }

  const workDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "clipcaptions-hindi-smoke-")
  );
  try {
    const hindiCues = [
      {
        id: "h-1",
        start_ms: 400,
        end_ms: 3600,
        text: "बेहतरीन शॉर्ट-फॉर्म क्लिप्स दर्शकों को जोड़ते हैं · Pro",
        timing_mode: "word" as const,
        words: [
          { id: "w1", text: "बेहतरीन", start_ms: 400, end_ms: 1000 },
          { id: "w2", text: "शॉर्ट-फॉर्म", start_ms: 1000, end_ms: 1600 },
          { id: "w3", text: "क्लिप्स", start_ms: 1600, end_ms: 2100 },
          { id: "w4", text: "दर्शकों", start_ms: 2100, end_ms: 2600 },
          { id: "w5", text: "को", start_ms: 2600, end_ms: 2900 },
          { id: "w6", text: "जोड़ते", start_ms: 2900, end_ms: 3200 },
          { id: "w7", text: "हैं", start_ms: 3200, end_ms: 3400 },
          { id: "w8", text: "·", start_ms: 3400, end_ms: 3500 },
          { id: "w9", text: "Pro", start_ms: 3500, end_ms: 3600 },
        ],
      },
      {
        id: "h-2",
        start_ms: 3800,
        end_ms: 6800,
        text: "क्षत्रिय ज्ञान और स्पष्ट प्रभाव के साथ ClipCaptions",
        timing_mode: "cue" as const,
        words: [],
      },
    ];

    const ass = buildAssScript({
      width: 720,
      height: 1280,
      style: {
        preset: "word-highlight",
        fontSize: "md",
        verticalPosition: 16,
        fontFamily: "noto-devanagari",
        textColor: "#FFFFFF",
        activeWordColor: "#A99AF2",
        highlightBgColor: "#34304A",
        highlightBgOpacity: 95,
        letterSpacing: "wide",
      },
      cues: hindiCues,
      fontName: "Noto Sans Devanagari",
    });

    if (!ass.includes(",100,100,0,0,")) {
      throw new Error("Expected ASS Spacing=0 for Devanagari script.");
    }
    if (!ass.includes("शॉर्ट-फॉर्म") || !ass.includes("क्षत्रिय")) {
      throw new Error("Devanagari word clusters were altered in ASS output.");
    }

    const hindiRes = await renderExportArtifact({
      format: "mp4",
      resolutionTier: "720p",
      mediaKind: "video",
      sourceMediaPath: sampleClip,
      usedPreviewSource: false,
      sourceRotationDeg: 0,
      durationMs: 7000,
      style: {
        preset: "word-highlight",
        fontSize: "md",
        verticalPosition: 16,
        fontFamily: "noto-devanagari",
        textColor: "#FFFFFF",
        activeWordColor: "#A99AF2",
        highlightBgColor: "#34304A",
        highlightBgOpacity: 95,
      },
      cues: hindiCues,
      workDir,
      ffmpegPath,
      ffprobePath,
      maxRuntimeMs: 60_000,
      maxOutputBytes: 100 * 1024 * 1024,
      renderThreads: 2,
      fontName: "Noto Sans Devanagari",
      fontsDir,
    });

    const engDir = path.join(workDir, "eng");
    fs.mkdirSync(engDir, { recursive: true });
    const engRes = await renderExportArtifact({
      format: "mp4",
      resolutionTier: "480p",
      mediaKind: "video",
      sourceMediaPath: sampleClip,
      usedPreviewSource: false,
      sourceRotationDeg: 0,
      durationMs: 4000,
      style: {
        preset: "clean",
        fontSize: "md",
        verticalPosition: 14,
        fontFamily: "playfair-display",
        textColor: "#F2F1F6",
        activeWordColor: "#A99AF2",
      },
      cues: [
        {
          id: "e-1",
          start_ms: 400,
          end_ms: 3200,
          text: "Make every word land in Playfair Display.",
          timing_mode: "word",
          words: [
            { id: "ew1", text: "Make", start_ms: 400, end_ms: 900 },
            { id: "ew2", text: "every", start_ms: 900, end_ms: 1400 },
            { id: "ew3", text: "word", start_ms: 1400, end_ms: 1900 },
            { id: "ew4", text: "land", start_ms: 1900, end_ms: 2300 },
            { id: "ew5", text: "in", start_ms: 2300, end_ms: 2500 },
            { id: "ew6", text: "Playfair", start_ms: 2500, end_ms: 2900 },
            { id: "ew7", text: "Display.", start_ms: 2900, end_ms: 3200 },
          ],
        },
      ],
      workDir: engDir,
      ffmpegPath,
      ffprobePath,
      maxRuntimeMs: 60_000,
      maxOutputBytes: 100 * 1024 * 1024,
      renderThreads: 2,
      fontName: "Playfair Display",
      fontsDir,
    });

    const outFrame = process.env.SMOKE_OUT_FRAME?.trim();
    if (outFrame) {
      execFileSync(
        ffmpegPath,
        [
          "-y",
          "-ss",
          "1.2",
          "-i",
          hindiRes.outputPath,
          "-frames:v",
          "1",
          "-q:v",
          "2",
          outFrame,
        ],
        { stdio: "ignore" }
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          ffmpegPath,
          hasHarfBuzzComplexShaping: hasShaping,
          hindiMp4: {
            width: hindiRes.width,
            height: hindiRes.height,
            bytes: hindiRes.sizeBytes,
          },
          englishPlayfairMp4: {
            width: engRes.width,
            height: engRes.height,
            bytes: engRes.sizeBytes,
          },
        },
        null,
        2
      )
    );
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("HINDI_SMOKE_FAILED:", err);
  process.exit(1);
});
