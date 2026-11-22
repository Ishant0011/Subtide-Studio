# ClipCaptions

Add automatic captions to your videos. ClipCaptions is a word-synced caption editor and export studio built with Next.js App Router, TypeScript, Tailwind CSS, Supabase, FFmpeg/FFprobe, and pnpm.

## Features

- **Public Homepage & Interactive Demo (`/`, `/studio`)**: Play a bundled 9:16 portrait clip (`public/sample-clip.mp4`), toggle captions on/off, scrub word-synced cues, and switch between **Clean**, **Boxed**, and **Word Highlight** presets without signing in.
- **Private Accounts & Resumable Uploads (`/login`, `/upload`, `/projects`)**:
  - Server-verified Supabase Auth (`supabase.auth.getUser()`) with email login and environment-gated Google & Discord OAuth.
  - Browser-direct resumable TUS uploads for **MP4, MOV, MP3, and WAV** up to **150 MB** and **3 minutes** with progress, pause/resume, retry, server-assigned private keys, and live processing handoff straight to **Open editor**.
  - Project cards with video thumbnails, audio portrait artwork, real worker processing stages, and strict owner-only RLS.
- **Word-Synced Caption Studio (`/projects/[id]/editor`)**:
  - 3-column desktop studio workspace (9:16 preview + segmented cue timeline underneath, wide editable captions with clickable timestamps & active-word chips, separate style panel) and mobile-first accessible `Captions` / `Style` tabs.
  - Immutable revision autosave with optimistic concurrency (`409` stale-tab conflict recovery) and retry.
- **Revision-Pinned Exports (Phase 5)**:
  - **MP4 to post**: H.264/AAC video with styled captions burned in and source audio preserved (9:16 portrait stage for audio-only projects).
  - **SRT for subtitles**: Deterministic UTF-8 SubRip files preserving multiline text, Unicode, exact timing, and gaps.
  - **Transparent MOV for compositing**: Apple ProRes 4444 (`yuva444p10le`) with real alpha, captions only, no audio, and full clip duration including transparent gaps.
  - Durable Postgres export queue (`public.export_jobs`) with deduplication, bounded render resources, retries, stale-attempt tokens, and owner-only 60-second signed downloads.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project (local via Docker + Supabase CLI, or hosted dev project)
- FFmpeg & FFprobe (included in `worker/Dockerfile` or via bundled `ffmpeg-static` / `ffprobe-static` on Windows)

## Local Setup

1. Install web app and worker dependencies:

   ```bash
   pnpm install
   pnpm --dir worker install
   ```

2. Create `.env.local` from `.env.example`:

   ```bash
   cp .env.example .env.local
   ```

   Configure `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Optionally set `DEEPGRAM_API_KEY` for Deepgram Nova-3 transcription or `TRANSCRIPTION_ADAPTER=fixture` for offline testing.

3. Apply migrations to your Supabase project:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --remote
   ```

4. Start the Next.js app:

   ```bash
   pnpm dev
   ```

5. Start the media & export worker:

   ```powershell
   pnpm --dir worker build
   pnpm --dir worker start
   ```

   *(Or run via Docker: `docker build -t clipcaptions-worker ./worker && docker run --rm --env-file .env.local clipcaptions-worker`.)*

## Optional Social Login (Google & Discord)

- Add `<your-origin>/auth/callback` to **Authentication → URL Configuration → Redirect URLs** in Supabase.
- Enable **Google** and/or **Discord** in **Authentication → Providers** and keep Client IDs/Secrets strictly inside Supabase (never in `.env.local` or Git).
- Set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` and/or `NEXT_PUBLIC_AUTH_DISCORD_ENABLED=true` in `.env.local`.

## Verification Commands

```bash
pnpm lint                   # Next.js ESLint checks
pnpm typecheck              # Next.js TypeScript strict typecheck
pnpm build                  # Next.js production build
pnpm --dir worker typecheck # Worker TypeScript typecheck
pnpm --dir worker build     # Worker compilation
```
