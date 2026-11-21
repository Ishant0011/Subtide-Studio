# Subtide Studio

Word-synced caption studio for short-form portrait clips, built with Next.js App Router, TypeScript, Tailwind CSS, Supabase, FFmpeg/FFprobe, and pnpm.

## Implemented Phases

### Phase 1 — Public Sample Studio
- **Landing page (`/`)** featuring *"Caption your clips. Keep your style."* and a working **Try a sample** button.
- **Public Sample Studio (`/studio`)** with a bundled 9:16 portrait clip (`public/sample-clip.mp4`), hand-timed word-level captions (`src/lib/captions.ts`), play/pause/scrub/click-to-seek controls, and **Clean**, **Boxed**, and **Word Highlight** presets. Works without signing in.

### Phase 2 — Accounts & Private Resumable Uploads
- **Supabase Auth (`/login`)** with server-verified sessions (`supabase.auth.getUser()`).
- **Server-controlled database & private storage** (`public.projects`, `public.media_assets`, strict RLS, private `media` bucket up to `150 MiB`).
- **Browser-direct resumable TUS uploads** (`/upload`) with progress, pause, resume, retry, server-assigned object keys (`x-upsert: false`), and idempotent server-side completion verification.

### Phase 3 — Media & Transcription Worker
- **Durable Postgres ingest queue (`public.ingest_jobs`)** with single-transaction upload finalization + job enqueue (`finalize_upload_and_enqueue_ingest`), bounded retries, renewable leases, and attempt tokens preventing stale workers from publishing results.
- **Phase 2 backfill trigger (`POST /api/projects/[id]/process`)**: owners can start processing already-finalized Phase 2 clips (or retry failed jobs) without re-uploading.
- **Separate Node worker (`worker/`)** with FFmpeg and FFprobe:
  - Probes actual media bytes; enforces 3-minute duration limit and bounds on dimensions, streams, runtime, and output size.
  - Generates private browser-playable H.264/AAC previews on a zero-based clock with display rotation baked upright, and normalized MP3 previews for MP3/WAV audio-only clips (rendered on a 9:16 portrait stage in `/projects`).
  - Accounts for audio/video start offsets when extracting 16 kHz mono WAV for transcription.
- **Deepgram Nova-3 + Fixture transcription adapters** storing integer-millisecond word timestamps and grouped cues in `public.caption_revisions` (atomic revision #1). Distinctly handles corrupt media, missing audio, valid audio with no speech, and provider failures.
- **Live job stages on `/projects`** via authenticated polling with exponential backoff. *(Caption editing is deferred to Phase 4.)*

## Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project (local via Docker + Supabase CLI, or a hosted dev project)
- FFmpeg & FFprobe (included in `worker/Dockerfile` or via local binaries on Windows)

## Local Setup

1. Install web app and worker dependencies:

   ```bash
   pnpm install
   pnpm --dir worker install
   ```

2. Create `.env.local` from the tracked template:

   ```bash
   cp .env.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key), and `SUPABASE_SERVICE_ROLE_KEY` (server-only secret). Optionally set `DEEPGRAM_API_KEY` for real Nova-3 transcription, or set `TRANSCRIPTION_ADAPTER=fixture` for deterministic offline testing.

3. Apply migrations to your Supabase project:

   ```bash
   # Local Supabase
   supabase start
   supabase db reset

   # Or linked hosted dev project
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --remote
   ```

4. Start the Next.js app:

   ```bash
   pnpm dev
   ```

## Running the Phase 3 Worker

### Option A — Docker (Linux container with system FFmpeg & FFprobe)

```bash
docker build -t subtide-worker ./worker
docker run --rm --env-file .env.local subtide-worker
```

### Option B — Native Windows (using local `ffmpeg` and `ffprobe` binaries)

```powershell
pnpm --dir worker build
$env:FFMPEG_PATH = "C:\path\to\ffmpeg.exe"
$env:FFPROBE_PATH = "C:\path\to\ffprobe.exe"
$env:TRANSCRIPTION_ADAPTER = "auto" # or "fixture" / "deepgram"
pnpm --dir worker start
```

*(If `FFMPEG_PATH` / `FFPROBE_PATH` are omitted, the worker automatically falls back to the bundled `ffmpeg-static` / `ffprobe-static` binaries installed in `worker/node_modules`.)*

## Verification Commands

```bash
pnpm lint                   # Next.js ESLint checks
pnpm typecheck              # Next.js TypeScript strict typecheck
pnpm build                  # Next.js production build
pnpm --dir worker typecheck # Worker TypeScript typecheck
pnpm --dir worker build     # Worker compilation
```
