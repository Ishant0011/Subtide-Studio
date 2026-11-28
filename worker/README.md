# ClipCaptions Background Worker

Processes private media ingest (probe, preview transcode, Deepgram Nova-3 transcription) and revision-pinned H.264/AAC MP4 exports up to 4K (`2160p`).

## Verified HarfBuzz / Devanagari Renderer Selection

Hindi and other complex Indic scripts require FFmpeg built with **both** `--enable-libass` and `--enable-libharfbuzz`, plus `shaping=complex` and `Spacing=0` in the generated ASS style so HarfBuzz keeps vowel signs (matras) and conjuncts intact.

- **Windows Development**:
  - The bundled `ffmpeg-static` (`v6.1.1-essentials_build-www.gyan.dev`) already includes `--enable-libass --enable-libfribidi --enable-libharfbuzz`.
  - To override with a system FFmpeg build (e.g. `winget install Gyan.FFmpeg`), set `FFMPEG_PATH` and `FFPROBE_PATH` in `.env.local`.
- **Production Linux / Docker Worker**:
  - Use a Debian/Ubuntu/Alpine FFmpeg package built with `libass` + `libharfbuzz` + `libfribidi` (standard on `apt-get install ffmpeg` in Debian Bookworm / Ubuntu 22.04+), and verify with:
    ```bash
    ffmpeg -version | grep -E "enable-libass.*enable-libharfbuzz|enable-libharfbuzz.*enable-libass"
    ```
  - Mount or copy `public/fonts/` so `WORKER_FONTS_DIR` (or auto-discovered `public/fonts`) provides all 10 bundled SIL OFL 1.1 caption fonts, including `NotoSansDevanagari-Bold.ttf`.
- **Preflight Safety**:
  - Before rendering any caption containing complex/Indic script characters, `worker/src/render.ts` verifies that the active `ffmpegPath` reports `--enable-libass` and `--enable-libharfbuzz`. If missing, the export fails fast with an actionable error instead of producing broken dotted-circle captions.

## Smoke Test

Run the real render smoke test (plain Hindi, word-highlighted Hindi, mixed Hindi/English, English regression, and new OFL font verification):

```bash
pnpm --dir worker build
pnpm --dir worker test:hindi
```
