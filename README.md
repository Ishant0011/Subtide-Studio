# Subtide Studio

Word-synced caption studio for short-form portrait clips, built with Next.js App Router, TypeScript, Tailwind CSS, Supabase, and pnpm.

## Implemented Phases

### Phase 1 — Public Sample Studio
- **Landing page (`/`)** featuring *"Caption your clips. Keep your style."* and a working **Try a sample** button.
- **Public Sample Studio (`/studio`)** with a bundled 9:16 portrait clip (`public/sample-clip.mp4`), hand-timed word-level captions (`src/lib/captions.ts`), play/pause/scrub/click-to-seek controls, and **Clean**, **Boxed**, and **Word Highlight** presets. Works without signing in.

### Phase 2 — Accounts & Private Resumable Uploads
- **Supabase Auth (`/login`)** with server-verified sessions (`supabase.auth.getUser()` in middleware, Server Components, and API routes).
- **Database & Storage Migrations (`supabase/migrations/`)** defining `public.projects`, `public.media_assets`, strict row-level security (RLS) policies, and a private `media` storage bucket (`150 MiB`, `video/mp4` & `video/quicktime`).
- **Projects (`/projects`) & Upload (`/upload`)** screens for signed-in users.
- **Browser-direct resumable TUS uploads** (`tus-js-client`) with live progress, pause, resume, and retry; MP4/MOV up to 150 MB; 3-minute processing limit notice; server-assigned collision-free object keys with no overwrite (`x-upsert: false` + pending-only storage UPDATE policy).
- **Verified idempotent completion (`POST /api/uploads/complete`)** checking user ownership, expected server-assigned object key, and stored file byte size via server-only credentials (`SUPABASE_SERVICE_ROLE_KEY`).

*(FFmpeg processing and transcription are deferred to Phase 3.)*

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop + [Supabase CLI](https://supabase.com/docs/guides/cli) (for local Auth, Postgres, and Storage)

## Local Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create your local environment file from the tracked template:

   ```bash
   cp .env.example .env.local
   ```

   `.env.local` is ignored by Git; keep real credentials out of version control and never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

3. Start local Supabase and apply migrations:

   ```bash
   supabase start
   supabase db reset
   ```

   Or apply pending migrations without resetting data:

   ```bash
   supabase migration up
   ```

4. Copy the local `API URL`, `anon key`, and `service_role key` printed by `supabase status` into `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
   ```

5. Start the Next.js development server:

   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000):
   - Click **Try a sample** to use the public sample studio (`/studio`) without signing in.
   - Open **Projects** (`/projects`) or **Sign in** (`/login`) to create an account and upload private MP4/MOV clips at `/upload`.

## Verification Commands

```bash
pnpm lint       # ESLint checks
pnpm typecheck  # TypeScript strict typecheck (tsc --noEmit)
pnpm build      # Production Next.js build
```
